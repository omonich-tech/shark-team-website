import {
  EnrollmentStatus,
  LeadStatus,
  LifecycleStatus,
  PaymentProvider,
  PaymentStatus,
  PriceProductType,
  StudentEnrollmentStatus,
  SubscriptionStatus,
  TrialBookingStatus,
  TrialConversionStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/server/telegram/send-message";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatCard(value: string) {
  const digits = value.replace(/\s+/g, "");
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function daysInUtcMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function addSubscriptionMonth(value: Date) {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const targetMonth = month + 1;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;
  const day = Math.min(
    value.getUTCDate(),
    daysInUtcMonth(targetYear, normalizedMonth)
  );

  return new Date(
    Date.UTC(
      targetYear,
      normalizedMonth,
      day,
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds()
    )
  );
}

function subscriptionGraceDays() {
  const configured = Number(process.env.SUBSCRIPTION_GRACE_DAYS ?? "3");

  return Number.isInteger(configured) && configured >= 0 && configured <= 30
    ? configured
    : 3;
}

function addDays(value: Date, amount: number) {
  return new Date(value.getTime() + amount * 24 * 60 * 60 * 1000);
}

async function findSubscriptionPrice(groupId: string) {
  const prisma = getPrisma();
  const now = new Date();
  const group = await prisma.trainingGroup.findUnique({ where: { id: groupId } });

  if (!group) return null;

  const prices = await prisma.price.findMany({
    where: {
      productType: PriceProductType.SUBSCRIPTION,
      status: LifecycleStatus.ACTIVE,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gt: now } }],
      AND: [{
        OR: [
          { groupId: group.id },
          { groupId: null, branchId: group.branchId, sportId: group.sportId },
          { groupId: null, branchId: group.branchId, sportId: null },
          { groupId: null, branchId: null, sportId: group.sportId }
        ]
      }]
    },
    orderBy: { validFrom: "desc" }
  });

  return (
    prices.find((item) => item.groupId === group.id) ??
    prices.find((item) => item.branchId === group.branchId && item.sportId === group.sportId) ??
    prices.find((item) => item.branchId === group.branchId) ??
    prices.find((item) => item.sportId === group.sportId) ??
    null
  );
}

export async function ensureTrialConversionReady(trialBookingId: string) {
  const prisma = getPrisma();
  const booking = await prisma.trialBooking.findUnique({
    where: { id: trialBookingId },
    include: {
      lead: true,
      assessment: true,
      feedback: true,
      conversion: true,
      session: true
    }
  });

  if (
    !booking ||
    booking.status !== TrialBookingStatus.ATTENDED ||
    !booking.assessment ||
    !booking.feedback?.completedAt ||
    !booking.lead.childId
  ) {
    return { ok: false as const, error: "TRIAL_NOT_READY" as const };
  }

  if (booking.conversion) {
    return { ok: true as const, conversion: booking.conversion };
  }

  const conversion = await prisma.trialConversion.upsert({
    where: {
      trialBookingId: booking.id
    },
    update: {},
    create: {
      trialBookingId: booking.id,
      childId: booking.lead.childId,
      groupId: booking.session.groupId,
      status: TrialConversionStatus.READY
    }
  });

  return { ok: true as const, conversion };
}

export async function setTrialConversionDecision(input: {
  trialBookingId: string;
  status: "READY" | "THINKING" | "DECLINED";
  adminNote?: string | null;
}) {
  const ready = await ensureTrialConversionReady(input.trialBookingId);
  if (!ready.ok) return ready;

  const prisma = getPrisma();
  const current = await prisma.trialConversion.findUnique({
    where: { id: ready.conversion.id },
    include: {
      payments: {
        orderBy: { sequence: "desc" },
        take: 1
      }
    }
  });

  if (!current) {
    return { ok: false as const, error: "CONVERSION_NOT_FOUND" as const };
  }

  if (current.status === TrialConversionStatus.ENROLLED) {
    return { ok: false as const, error: "ALREADY_ENROLLED" as const };
  }

  const latestPayment = current.payments[0];

  if (
    current.status === TrialConversionStatus.PAYMENT_PENDING ||
    latestPayment?.status === PaymentStatus.UNDER_REVIEW
  ) {
    return {
      ok: false as const,
      error: "PAYMENT_UNDER_REVIEW" as const
    };
  }

  if (
    current.status === TrialConversionStatus.OFFERED &&
    input.status === "THINKING"
  ) {
    return {
      ok: false as const,
      error: "OFFER_ALREADY_SENT" as const
    };
  }

  const conversion = await prisma.$transaction(async (tx) => {
    if (
      input.status === "DECLINED" &&
      latestPayment &&
      latestPayment.status !== PaymentStatus.PAID
    ) {
      await tx.subscriptionPayment.update({
        where: { id: latestPayment.id },
        data: {
          status: PaymentStatus.CANCELLED
        }
      });
    }

    return tx.trialConversion.update({
      where: { id: ready.conversion.id },
      data: {
        status: TrialConversionStatus[input.status],
        adminNote: input.adminNote?.trim().slice(0, 1000) || null,
        declinedAt:
          input.status === "DECLINED" ? new Date() : null
      }
    });
  });

  return { ok: true as const, conversion };
}

export async function offerTrialSubscription(input: {
  trialBookingId: string;
  adminNote?: string | null;
}) {
  const ready = await ensureTrialConversionReady(input.trialBookingId);
  if (!ready.ok) return ready;

  const prisma = getPrisma();
  const conversion = await prisma.trialConversion.findUnique({
    where: { id: ready.conversion.id },
    include: {
      child: { include: { parent: true } },
      group: {
        include: {
          branch: true,
          sport: true,
          primaryCoach: true,
          enrollments: {
            where: { status: StudentEnrollmentStatus.ACTIVE },
            select: { id: true }
          }
        }
      },
      payments: {
        orderBy: { sequence: "desc" },
        take: 1
      }
    }
  });

  if (!conversion) {
    return { ok: false as const, error: "CONVERSION_NOT_FOUND" as const };
  }

  if (conversion.status === TrialConversionStatus.ENROLLED) {
    return { ok: false as const, error: "ALREADY_ENROLLED" as const };
  }

  if (conversion.group.enrollmentStatus !== EnrollmentStatus.OPEN) {
    return { ok: false as const, error: "GROUP_NOT_OPEN" as const };
  }

  const existingEnrollment = await prisma.studentEnrollment.findFirst({
    where: {
      childId: conversion.childId,
      groupId: conversion.groupId,
      status: StudentEnrollmentStatus.ACTIVE
    }
  });

  if (existingEnrollment) {
    return { ok: false as const, error: "ALREADY_ENROLLED" as const };
  }

  const latestPayment = conversion.payments[0];

  if (
    conversion.status === TrialConversionStatus.PAYMENT_PENDING ||
    latestPayment?.status === PaymentStatus.UNDER_REVIEW
  ) {
    return {
      ok: false as const,
      error: "PAYMENT_UNDER_REVIEW" as const
    };
  }

  if (
    conversion.group.enrollments.length >= conversion.group.capacityRegular
  ) {
    return { ok: false as const, error: "GROUP_FULL" as const };
  }

  const price = await findSubscriptionPrice(conversion.groupId);
  if (!price) {
    return { ok: false as const, error: "SUBSCRIPTION_PRICE_NOT_FOUND" as const };
  }

  const cardNumber = process.env.MANUAL_PAYMENT_CARD_NUMBER?.trim();
  if (!cardNumber) {
    return { ok: false as const, error: "MANUAL_CARD_NOT_CONFIGURED" as const };
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const updatedConversion = await tx.trialConversion.update({
      where: { id: conversion.id },
      data: {
        status: TrialConversionStatus.OFFERED,
        amountUzs: price.amount,
        currency: price.currency,
        offeredAt: now,
        declinedAt: null,
        adminNote: input.adminNote?.trim().slice(0, 1000) || conversion.adminNote
      }
    });

    const payment = await tx.subscriptionPayment.upsert({
      where: {
        trialConversionId_sequence: {
          trialConversionId: conversion.id,
          sequence: 1
        }
      },
      create: {
        trialConversionId: conversion.id,
        sequence: 1,
        provider: PaymentProvider.MANUAL_CARD,
        status: PaymentStatus.PENDING,
        amountUzs: price.amount,
        currency: price.currency
      },
      update: {
        provider: PaymentProvider.MANUAL_CARD,
        status: PaymentStatus.PENDING,
        amountUzs: price.amount,
        currency: price.currency,
        enrollmentId: null,
        periodStart: null,
        periodEnd: null,
        dueAt: null,
        receiptMimeType: null,
        receiptSize: null,
        receiptTelegramFileId: null,
        submittedAt: null,
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
        paidAt: null
      }
    });

    return {
      ...updatedConversion,
      payment
    };
  });

  const contact = await prisma.telegramContact.findFirst({
    where: { parentId: conversion.child.parentId },
    orderBy: { verifiedAt: "desc" }
  });

  if (!contact) {
    return {
      ok: true as const,
      conversion: updated,
      telegramSent: false as const,
      warning: "NO_TELEGRAM_CONTACT" as const
    };
  }

  const locale = contact.locale === "uz" ? "uz" : "ru";
  const coachName = [
    conversion.group.primaryCoach.firstName,
    conversion.group.primaryCoach.lastName
  ].filter(Boolean).join(" ");
  const holder = process.env.MANUAL_PAYMENT_CARD_HOLDER?.trim();
  const card = formatCard(cardNumber);

  const text =
    locale === "uz"
      ? [
          "🏀 <b>SHARK TEAM abonementi</b>",
          "",
          "Bola: <b>" + escapeHtml(conversion.child.name) + "</b>",
          "Guruh: " + escapeHtml(conversion.group.internalName),
          "Murabbiy: " + escapeHtml(coachName || "—"),
          "Filial: " + escapeHtml(conversion.group.branch.publicNameUz),
          "",
          "1 oylik abonement: <b>" + formatMoney(price.amount) + " so‘m</b>",
          "Karta: <code>" + card + "</code>",
          holder ? "Karta egasi: " + escapeHtml(holder) : "",
          "",
          "To‘lovdan so‘ng chek yoki skrinshotni shu chatga yuboring. To‘lov tasdiqlangach, bola guruhga qo‘shiladi."
        ].filter(Boolean).join("\n")
      : [
          "🏀 <b>Абонемент SHARK TEAM</b>",
          "",
          "Ребёнок: <b>" + escapeHtml(conversion.child.name) + "</b>",
          "Группа: " + escapeHtml(conversion.group.internalName),
          "Тренер: " + escapeHtml(coachName || "—"),
          "Филиал: " + escapeHtml(conversion.group.branch.publicNameRu),
          "",
          "Абонемент на месяц: <b>" + formatMoney(price.amount) + " сум</b>",
          "Карта: <code>" + card + "</code>",
          holder ? "Получатель: " + escapeHtml(holder) : "",
          "",
          "После перевода отправьте чек или скриншот прямо сюда. После подтверждения оплаты ребёнок будет зачислен в группу."
        ].filter(Boolean).join("\n");

  const sent = await sendTelegramMessage({ chatId: contact.chatId, text });

  return {
    ok: true as const,
    conversion: updated,
    telegramSent: sent.ok
  };
}

export async function submitSubscriptionReceipt(input: {
  telegramUserId: bigint;
  telegramFileId: string;
  receiptMimeType?: string | null;
  receiptSize?: number | null;
}) {
  const prisma = getPrisma();
  const contact = await prisma.telegramContact.findUnique({
    where: { telegramUserId: input.telegramUserId }
  });

  if (!contact?.parentId) {
    return { ok: false as const, error: "NO_ACTIVE_SUBSCRIPTION" as const };
  }

  const conversions = await prisma.trialConversion.findMany({
    where: {
      child: { parentId: contact.parentId },
      status: {
        in: [
          TrialConversionStatus.OFFERED,
          TrialConversionStatus.PAYMENT_PENDING
        ]
      }
    },
    include: {
      payments: {
        where: { sequence: 1 },
        orderBy: { createdAt: "desc" },
        take: 1
      },
      child: { include: { parent: true } },
      group: {
        include: {
          branch: true,
          sport: true,
          primaryCoach: true
        }
      }
    },
    orderBy: { updatedAt: "desc" },
    take: 2
  });

  if (conversions.length === 0) {
    return { ok: false as const, error: "NO_ACTIVE_SUBSCRIPTION" as const };
  }

  if (conversions.length > 1) {
    return { ok: false as const, error: "MULTIPLE_ACTIVE_SUBSCRIPTIONS" as const };
  }

  const conversion = conversions[0];
  const payment = conversion.payments[0];

  if (!payment) {
    return { ok: false as const, error: "PAYMENT_NOT_FOUND" as const };
  }

  if (payment.status === PaymentStatus.PAID) {
    return {
      ok: true as const,
      alreadyPaid: true as const,
      conversion,
      payment
    };
  }

  const now = new Date();
  const [updatedPayment] = await prisma.$transaction([
    prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.UNDER_REVIEW,
        receiptTelegramFileId: input.telegramFileId,
        receiptMimeType: input.receiptMimeType ?? null,
        receiptSize: input.receiptSize ?? null,
        submittedAt: now,
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null
      }
    }),
    prisma.trialConversion.update({
      where: { id: conversion.id },
      data: { status: TrialConversionStatus.PAYMENT_PENDING }
    })
  ]);

  return {
    ok: true as const,
    alreadyPaid: false as const,
    conversion,
    payment: updatedPayment
  };
}

export async function reviewSubscriptionPayment(input: {
  paymentId: string;
  approve: boolean;
  reviewedBy: string;
  rejectionReason?: string | null;
}) {
  const prisma = getPrisma();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`\n      SELECT "id"\n      FROM "SubscriptionPayment"\n      WHERE "id" = ${input.paymentId}\n      FOR UPDATE\n    `;

    const payment = await tx.subscriptionPayment.findUnique({
      where: { id: input.paymentId },
      include: {
        trialConversion: {
          include: {
            trialBooking: { include: { lead: true } },
            child: { include: { parent: true } },
            group: {
              include: {
                branch: true,
                sport: true,
                primaryCoach: true
              }
            }
          }
        }
      }
    });

    if (!payment) {
      return { ok: false as const, error: "PAYMENT_NOT_FOUND" as const };
    }

    if (payment.status === PaymentStatus.PAID) {
      return {
        ok: true as const,
        alreadyProcessed: true as const,
        approved: true as const,
        payment,
        conversion: payment.trialConversion
      };
    }

    if (payment.status !== PaymentStatus.UNDER_REVIEW) {
      return { ok: false as const, error: "PAYMENT_NOT_UNDER_REVIEW" as const };
    }

    const conversion = payment.trialConversion;

    if (!input.approve) {
      const updatedPayment = await tx.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REJECTED,
          reviewedAt: now,
          reviewedBy: input.reviewedBy,
          rejectionReason: input.rejectionReason ?? "NOT_VERIFIED"
        }
      });

      const updatedConversion = await tx.trialConversion.update({
        where: { id: conversion.id },
        data: { status: TrialConversionStatus.OFFERED }
      });

      return {
        ok: true as const,
        alreadyProcessed: false as const,
        approved: false as const,
        payment: updatedPayment,
        conversion: { ...conversion, status: updatedConversion.status }
      };
    }

    const existingEnrollment = await tx.studentEnrollment.findFirst({
      where: {
        childId: conversion.childId,
        groupId: conversion.groupId,
        status: StudentEnrollmentStatus.ACTIVE
      }
    });

    if (!existingEnrollment) {
      await tx.$queryRaw`
        SELECT "id"
        FROM "TrainingGroup"
        WHERE "id" = ${conversion.groupId}
        FOR UPDATE
      `;

      const group = await tx.trainingGroup.findUnique({
        where: { id: conversion.groupId },
        include: {
          enrollments: {
            where: { status: StudentEnrollmentStatus.ACTIVE },
            select: { id: true }
          }
        }
      });

      if (
        !group ||
        group.enrollmentStatus !== EnrollmentStatus.OPEN ||
        group.enrollments.length >= group.capacityRegular
      ) {
        return { ok: false as const, error: "GROUP_FULL" as const };
      }

      await tx.studentEnrollment.create({
        data: {
          childId: conversion.childId,
          groupId: conversion.groupId,
          status: StudentEnrollmentStatus.ACTIVE,
          startDate: now
        }
      });
    }

    const updatedPayment = await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        paidAt: now,
        reviewedAt: now,
        reviewedBy: input.reviewedBy,
        rejectionReason: null
      }
    });

    const updatedConversion = await tx.trialConversion.update({
      where: { id: conversion.id },
      data: {
        status: TrialConversionStatus.ENROLLED,
        enrolledAt: now
      }
    });

    await tx.lead.update({
      where: { id: conversion.trialBooking.leadId },
      data: { status: LeadStatus.CLOSED }
    });

    return {
      ok: true as const,
      alreadyProcessed: false as const,
      approved: true as const,
      payment: updatedPayment,
      conversion: {
        ...conversion,
        status: updatedConversion.status,
        enrolledAt: updatedConversion.enrolledAt
      }
    };
  });
}


export async function backfillReadyTrialConversions(limit = 200) {
  const prisma = getPrisma();
  const bookings = await prisma.trialBooking.findMany({
    where: {
      status: TrialBookingStatus.ATTENDED,
      assessment: { isNot: null },
      feedback: {
        is: {
          completedAt: { not: null }
        }
      },
      conversion: { is: null },
      lead: {
        childId: { not: null }
      }
    },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: limit
  });

  let created = 0;

  for (const booking of bookings) {
    const result = await ensureTrialConversionReady(booking.id);
    if (result.ok) created += 1;
  }

  return created;
}
