import {
  PaymentStatus,
  StudentEnrollmentStatus,
  SubscriptionStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { ensureRenewalPayment } from "@/server/billing/subscription-lifecycle";

type Locale = "ru" | "uz";

function localeOf(value: string | null | undefined): Locale {
  return value === "uz" ? "uz" : "ru";
}

function formatCard(value: string) {
  const digits = value.replace(/\s+/g, "");
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatDay(value: Date | null, locale: Locale) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(locale === "uz" ? "uz-UZ" : "ru-RU", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function prepareParentSubscriptionPayment(input: {
  telegramUserId: bigint;
  enrollmentId: string;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();

  const contact = await prisma.telegramContact.findUnique({
    where: { telegramUserId: input.telegramUserId }
  });

  const locale = localeOf(contact?.locale);

  if (!contact?.parentId) {
    return {
      ok: false as const,
      error: "PARENT_NOT_LINKED" as const,
      locale
    };
  }

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      id: input.enrollmentId,
      child: { parentId: contact.parentId },
      status: {
        in: [
          StudentEnrollmentStatus.ACTIVE,
          StudentEnrollmentStatus.PAUSED
        ]
      }
    },
    include: {
      child: true,
      group: {
        include: {
          sport: true,
          branch: true,
          primaryCoach: true
        }
      },
      payments: {
        orderBy: { sequence: "desc" },
        take: 3
      }
    }
  });

  if (!enrollment) {
    return {
      ok: false as const,
      error: "ENROLLMENT_NOT_AVAILABLE" as const,
      locale
    };
  }

  const latest = enrollment.payments[0];
  const renewalStatuses: PaymentStatus[] = [
    PaymentStatus.PENDING,
    PaymentStatus.REJECTED,
    PaymentStatus.UNDER_REVIEW
  ];
  const payableSubscriptionStatuses: SubscriptionStatus[] = [
    SubscriptionStatus.PAYMENT_DUE,
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.PAUSED
  ];

  const renewalInProgress =
    latest &&
    latest.sequence > 1 &&
    latest.enrollmentId === enrollment.id &&
    renewalStatuses.includes(latest.status);

  const dueStatus = payableSubscriptionStatuses.includes(
    enrollment.subscriptionStatus ?? SubscriptionStatus.ACTIVE
  );

  if (!renewalInProgress && !dueStatus) {
    return {
      ok: false as const,
      error: "PAYMENT_NOT_DUE" as const,
      locale,
      enrollment
    };
  }

  let payment = latest ?? null;

  if (!renewalInProgress) {
    const prepared = await ensureRenewalPayment(enrollment, now);

    if (!prepared.ok) {
      return {
        ok: false as const,
        error: prepared.error,
        locale
      };
    }

    payment = await prisma.subscriptionPayment.findUnique({
      where: { id: prepared.payment.id }
    });
  }

  if (!payment) {
    return {
      ok: false as const,
      error: "PAYMENT_NOT_FOUND" as const,
      locale
    };
  }

  if (payment.status === PaymentStatus.UNDER_REVIEW) {
    return {
      ok: false as const,
      error: "PAYMENT_UNDER_REVIEW" as const,
      locale,
      payment
    };
  }

  if (payment.status === PaymentStatus.PAID) {
    return {
      ok: false as const,
      error: "ALREADY_PAID" as const,
      locale,
      payment
    };
  }

  if (
    payment.status !== PaymentStatus.PENDING &&
    payment.status !== PaymentStatus.REJECTED
  ) {
    return {
      ok: false as const,
      error: "PAYMENT_NOT_AVAILABLE" as const,
      locale,
      payment
    };
  }

  if (payment.status === PaymentStatus.REJECTED) {
    payment = await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PENDING,
        receiptTelegramFileId: null,
        receiptMimeType: null,
        receiptSize: null,
        submittedAt: null,
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null
      }
    });
  }

  const cardNumber = process.env.MANUAL_PAYMENT_CARD_NUMBER?.trim();

  if (!cardNumber) {
    return {
      ok: false as const,
      error: "MANUAL_CARD_NOT_CONFIGURED" as const,
      locale
    };
  }

  await prisma.telegramContact.update({
    where: { id: contact.id },
    data: {
      selectedSubscriptionPaymentId: payment.id,
      selectedSubscriptionPaymentAt: now
    }
  });

  const sportName =
    locale === "uz"
      ? enrollment.group.sport.nameUz
      : enrollment.group.sport.nameRu;
  const branchName =
    locale === "uz"
      ? enrollment.group.branch.publicNameUz
      : enrollment.group.branch.publicNameRu;
  const holder = process.env.MANUAL_PAYMENT_CARD_HOLDER?.trim();
  const card = formatCard(cardNumber);

  const text =
    locale === "uz"
      ? [
          "💳 <b>SHARK TEAM abonementini uzaytirish</b>",
          "",
          "Bola: <b>" + escapeHtml(enrollment.child.name) + "</b>",
          "Yo‘nalish: " + escapeHtml(sportName),
          "Guruh: " + escapeHtml(enrollment.group.internalName),
          "Filial: " + escapeHtml(branchName),
          "",
          "To‘lov: <b>" + formatMoney(payment.amountUzs) + " so‘m</b>",
          "Davr: " +
            escapeHtml(formatDay(payment.periodStart, locale)) +
            " → " +
            escapeHtml(formatDay(payment.periodEnd, locale)),
          "Karta: <code>" + card + "</code>",
          holder ? "Karta egasi: " + escapeHtml(holder) : "",
          "",
          "Endi aynan shu abonement uchun chek yoki skrinshotni shu chatga yuboring."
        ].filter(Boolean).join("\n")
      : [
          "💳 <b>Продление абонемента SHARK TEAM</b>",
          "",
          "Ребёнок: <b>" + escapeHtml(enrollment.child.name) + "</b>",
          "Направление: " + escapeHtml(sportName),
          "Группа: " + escapeHtml(enrollment.group.internalName),
          "Филиал: " + escapeHtml(branchName),
          "",
          "К оплате: <b>" + formatMoney(payment.amountUzs) + " сум</b>",
          "Период: " +
            escapeHtml(formatDay(payment.periodStart, locale)) +
            " → " +
            escapeHtml(formatDay(payment.periodEnd, locale)),
          "Карта: <code>" + card + "</code>",
          holder ? "Получатель: " + escapeHtml(holder) : "",
          "",
          "Теперь отправьте чек или скриншот прямо сюда — он будет привязан именно к этому абонементу."
        ].filter(Boolean).join("\n");

  return {
    ok: true as const,
    locale,
    childId: enrollment.childId,
    enrollmentId: enrollment.id,
    paymentId: payment.id,
    payment,
    text
  };
}
