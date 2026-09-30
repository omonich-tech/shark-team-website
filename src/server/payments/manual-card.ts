import {
  LeadStatus,
  NotificationStatus,
  NotificationType,
  PaymentProvider,
  PaymentStatus,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

function envMinutes(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

async function leadIdsForTelegramUser(telegramUserId: bigint) {
  const prisma = getPrisma();
  const contact = await prisma.telegramContact.findUnique({
    where: { telegramUserId }
  });

  if (!contact) {
    return { contact: null, leadIds: [] as string[] };
  }

  const leadIds = contact.leadId ? [contact.leadId] : [];

  if (contact.parentId) {
    const parentLeads = await prisma.lead.findMany({
      where: { parentId: contact.parentId },
      select: { id: true }
    });
    leadIds.push(...parentLeads.map((lead) => lead.id));
  }

  return {
    contact,
    leadIds: Array.from(new Set(leadIds))
  };
}

export async function submitManualCardReceipt(input: {
  telegramUserId: bigint;
  telegramFileId: string;
  receiptMimeType?: string | null;
  receiptSize?: number | null;
}) {
  const prisma = getPrisma();
  const now = new Date();
  const { contact, leadIds } = await leadIdsForTelegramUser(
    input.telegramUserId
  );

  if (!contact || leadIds.length === 0) {
    return { ok: false as const, error: "CONTACT_NOT_LINKED" as const };
  }

  const booking = await prisma.trialBooking.findFirst({
    where: {
      leadId: { in: leadIds },
      status: {
        in: [
          TrialBookingStatus.HOLD,
          TrialBookingStatus.PAYMENT_PENDING,
          TrialBookingStatus.CONFIRMED
        ]
      },
      session: {
        startsAt: { gt: now }
      }
    },
    include: {
      payment: true,
      lead: true,
      session: {
        include: {
          group: {
            include: {
              branch: true,
              sport: true,
              primaryCoach: true
            }
          }
        }
      }
    },
    orderBy: {
      session: {
        startsAt: "asc"
      }
    }
  });

  if (!booking || !booking.payment) {
    return { ok: false as const, error: "PAYMENT_NOT_FOUND" as const };
  }

  if (booking.payment.provider !== PaymentProvider.MANUAL_CARD) {
    return {
      ok: false as const,
      error: "PAYMENT_PROVIDER_MISMATCH" as const
    };
  }

  if (booking.payment.status === PaymentStatus.PAID) {
    return {
      ok: true as const,
      alreadyPaid: true as const,
      payment: booking.payment,
      booking
    };
  }

  if (
    booking.status === TrialBookingStatus.HOLD &&
    booking.expiresAt <= now
  ) {
    await prisma.trialBooking.update({
      where: { id: booking.id },
      data: { status: TrialBookingStatus.EXPIRED }
    });

    return { ok: false as const, error: "BOOKING_EXPIRED" as const };
  }

  const updatedPayment = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { id: booking.payment!.id },
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
    });

    await tx.trialBooking.update({
      where: { id: booking.id },
      data: {
        status: TrialBookingStatus.PAYMENT_PENDING
      }
    });

    return payment;
  });

  return {
    ok: true as const,
    alreadyPaid: false as const,
    payment: updatedPayment,
    booking
  };
}

export async function reviewManualCardPayment(input: {
  paymentId: string;
  approve: boolean;
  reviewedBy: string;
  rejectionReason?: string | null;
}) {
  const prisma = getPrisma();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "Payment"
      WHERE "id" = ${input.paymentId}
      FOR UPDATE
    `;

    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        trialBooking: {
          include: {
            lead: true,
            session: {
              include: {
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
        }
      }
    });

    if (!payment) {
      return { ok: false as const, error: "PAYMENT_NOT_FOUND" as const };
    }

    if (payment.provider !== PaymentProvider.MANUAL_CARD) {
      return {
        ok: false as const,
        error: "PAYMENT_PROVIDER_MISMATCH" as const
      };
    }

    if (payment.status === PaymentStatus.PAID) {
      return {
        ok: true as const,
        alreadyProcessed: true as const,
        approved: true as const,
        payment,
        booking: payment.trialBooking
      };
    }

    if (payment.status !== PaymentStatus.UNDER_REVIEW) {
      return {
        ok: false as const,
        error: "PAYMENT_NOT_UNDER_REVIEW" as const
      };
    }

    const booking = payment.trialBooking;

    if (input.approve) {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          paidAt: now,
          reviewedAt: now,
          reviewedBy: input.reviewedBy,
          rejectionReason: null
        }
      });

      const updatedBooking = await tx.trialBooking.update({
        where: { id: booking.id },
        data: {
          status: TrialBookingStatus.CONFIRMED,
          confirmedAt: now
        }
      });

      const lead = booking.lead;

      const parent = await tx.parent.upsert({
        where: { phone: lead.phone },
        update: {
          name: lead.parentName,
          locale: lead.locale
        },
        create: {
          name: lead.parentName,
          phone: lead.phone,
          locale: lead.locale
        }
      });

      let childId = lead.childId;

      if (!childId) {
        const existingChild = await tx.child.findFirst({
          where: {
            parentId: parent.id,
            name: lead.childName
          },
          orderBy: {
            createdAt: "asc"
          }
        });

        childId = existingChild
          ? existingChild.id
          : (
              await tx.child.create({
                data: {
                  parentId: parent.id,
                  name: lead.childName,
                  ageAtRegistration: lead.childAge
                }
              })
            ).id;
      }

      await tx.lead.update({
        where: { id: booking.leadId },
        data: {
          status: LeadStatus.TRIAL_CONFIRMED,
          parentId: parent.id,
          childId
        }
      });

      await tx.telegramContact.updateMany({
        where: {
          leadId: booking.leadId
        },
        data: {
          parentId: parent.id
        }
      });

      const reminderMinutes = envMinutes("TRIAL_REMINDER_MINUTES", 180);
      const feedbackMinutes = envMinutes("POST_TRIAL_FEEDBACK_MINUTES", 30);
      const reminderAtRaw = new Date(
        booking.session.startsAt.getTime() - reminderMinutes * 60_000
      );
      const reminderAt = reminderAtRaw > now ? reminderAtRaw : now;
      const feedbackAt = new Date(
        booking.session.endsAt.getTime() + feedbackMinutes * 60_000
      );

      await tx.notification.upsert({
        where: {
          dedupeKey: "trial:" + booking.id + ":reminder"
        },
        update: {
          leadId: booking.leadId,
          parentId: parent.id,
          scheduledAt: reminderAt,
          status: NotificationStatus.PENDING,
          lastError: null
        },
        create: {
          type: NotificationType.TRIAL_REMINDER,
          leadId: booking.leadId,
          parentId: parent.id,
          trialBookingId: booking.id,
          scheduledAt: reminderAt,
          dedupeKey: "trial:" + booking.id + ":reminder"
        }
      });

      await tx.notification.upsert({
        where: {
          dedupeKey: "trial:" + booking.id + ":feedback"
        },
        update: {
          leadId: booking.leadId,
          parentId: parent.id,
          scheduledAt: feedbackAt,
          status: NotificationStatus.PENDING,
          lastError: null
        },
        create: {
          type: NotificationType.POST_TRIAL_FEEDBACK,
          leadId: booking.leadId,
          parentId: parent.id,
          trialBookingId: booking.id,
          scheduledAt: feedbackAt,
          dedupeKey: "trial:" + booking.id + ":feedback"
        }
      });

      return {
        ok: true as const,
        alreadyProcessed: false as const,
        approved: true as const,
        payment: updatedPayment,
        booking: {
          ...booking,
          status: updatedBooking.status,
          confirmedAt: updatedBooking.confirmedAt
        }
      };
    }

    const nextBookingStatus =
      booking.expiresAt > now
        ? TrialBookingStatus.HOLD
        : TrialBookingStatus.EXPIRED;

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.REJECTED,
        reviewedAt: now,
        reviewedBy: input.reviewedBy,
        rejectionReason: input.rejectionReason ?? "NOT_VERIFIED"
      }
    });

    const updatedBooking = await tx.trialBooking.update({
      where: { id: booking.id },
      data: {
        status: nextBookingStatus
      }
    });

    await tx.lead.update({
      where: { id: booking.leadId },
      data: {
        status:
          nextBookingStatus === TrialBookingStatus.HOLD
            ? LeadStatus.TRIAL_HELD
            : LeadStatus.TRIAL_SELECTED
      }
    });

    return {
      ok: true as const,
      alreadyProcessed: false as const,
      approved: false as const,
      payment: updatedPayment,
      booking: {
        ...booking,
        status: updatedBooking.status
      }
    };
  });
}
