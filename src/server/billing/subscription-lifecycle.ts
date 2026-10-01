import {
  NotificationStatus,
  NotificationType,
  PaymentProvider,
  PaymentStatus,
  StudentEnrollmentStatus,
  SubscriptionStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { resumeExpiredManualFreezes } from "@/server/billing/subscription-controls";
import {
  addSubscriptionMonth,
  subscriptionReminderDays
} from "@/server/billing/subscription-period";
import { findSubscriptionPrice } from "@/server/billing/subscription-price";
import { refreshAllPaymentAttentionAlerts } from "@/server/billing/payment-alerts";

async function queueSubscriptionNotification(input: {
  type:
    | "SUBSCRIPTION_RENEWAL_REMINDER"
    | "SUBSCRIPTION_PAST_DUE"
    | "SUBSCRIPTION_PAUSED";
  enrollmentId: string;
  paymentId: string;
  parentId: string;
  sequence: number;
  scheduledAt: Date;
}) {
  const prisma = getPrisma();
  const suffix =
    input.type === "SUBSCRIPTION_RENEWAL_REMINDER"
      ? "renewal"
      : input.type === "SUBSCRIPTION_PAST_DUE"
        ? "past-due"
        : "paused";

  return prisma.notification.upsert({
    where: {
      dedupeKey:
        "subscription:" +
        input.enrollmentId +
        ":" +
        input.sequence +
        ":" +
        suffix
    },
    update: {
      type: NotificationType[input.type],
      parentId: input.parentId,
      enrollmentId: input.enrollmentId,
      subscriptionPaymentId: input.paymentId,
      scheduledAt: input.scheduledAt,
      status: NotificationStatus.PENDING,
      sentAt: null,
      attempts: 0,
      lastError: null
    },
    create: {
      type: NotificationType[input.type],
      parentId: input.parentId,
      enrollmentId: input.enrollmentId,
      subscriptionPaymentId: input.paymentId,
      scheduledAt: input.scheduledAt,
      dedupeKey:
        "subscription:" +
        input.enrollmentId +
        ":" +
        input.sequence +
        ":" +
        suffix
    }
  });
}

async function ensureRenewalPayment(
  enrollment: {
    id: string;
    groupId: string;
    currentPeriodEnd: Date | null;
    nextPaymentDueAt: Date | null;
    child: { parentId: string };
    payments: Array<{
      id: string;
      trialConversionId: string;
      sequence: number;
      status: PaymentStatus;
      periodStart: Date | null;
      periodEnd: Date | null;
      dueAt: Date | null;
    }>;
  },
  now: Date
) {
  const prisma = getPrisma();
  const latest = enrollment.payments[0];

  if (!latest || !enrollment.currentPeriodEnd) {
    return {
      ok: false as const,
      error: "BILLING_HISTORY_MISSING" as const
    };
  }

  if (
    latest.sequence > 1 &&
    latest.periodStart?.getTime() === enrollment.currentPeriodEnd.getTime() &&
    latest.status !== PaymentStatus.PAID &&
    latest.status !== PaymentStatus.CANCELLED
  ) {
    return {
      ok: true as const,
      created: false as const,
      payment: latest
    };
  }

  const price = await findSubscriptionPrice(enrollment.groupId, now);

  if (!price) {
    return {
      ok: false as const,
      error: "SUBSCRIPTION_PRICE_NOT_FOUND" as const
    };
  }

  const sequence = latest.sequence + 1;
  const periodStart = enrollment.currentPeriodEnd;
  const periodEnd = addSubscriptionMonth(periodStart);

  const payment = await prisma.subscriptionPayment.upsert({
    where: {
      trialConversionId_sequence: {
        trialConversionId: latest.trialConversionId,
        sequence
      }
    },
    update: {
      enrollmentId: enrollment.id,
      provider: PaymentProvider.MANUAL_CARD,
      amountUzs: price.amount,
      currency: price.currency,
      periodStart,
      periodEnd,
      dueAt: periodStart
    },
    create: {
      trialConversionId: latest.trialConversionId,
      enrollmentId: enrollment.id,
      sequence,
      provider: PaymentProvider.MANUAL_CARD,
      status: PaymentStatus.PENDING,
      amountUzs: price.amount,
      currency: price.currency,
      periodStart,
      periodEnd,
      dueAt: periodStart
    }
  });

  return {
    ok: true as const,
    created: true as const,
    payment
  };
}

export async function advanceSubscriptionLifecycle(
  now = new Date(),
  limit = 200
) {
  const prisma = getPrisma();
  const manualFreezes = await resumeExpiredManualFreezes(now, limit);
  const reminderCutoff = new Date(
    now.getTime() +
      subscriptionReminderDays() * 24 * 60 * 60 * 1000
  );

  const renewalCandidates = await prisma.studentEnrollment.findMany({
    where: {
      status: StudentEnrollmentStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      nextPaymentDueAt: {
        not: null,
        lte: reminderCutoff
      },
      currentPeriodEnd: {
        not: null
      }
    },
    include: {
      child: true,
      payments: {
        orderBy: {
          sequence: "desc"
        },
        take: 1
      }
    },
    orderBy: {
      nextPaymentDueAt: "asc"
    },
    take: limit
  });

  let renewalsCreated = 0;
  let renewalRemindersQueued = 0;
  let pastDueMarked = 0;
  let pastDueNotificationsQueued = 0;
  let paused = 0;
  let pauseNotificationsQueued = 0;
  let errors = 0;

  for (const enrollment of renewalCandidates) {
    const result = await ensureRenewalPayment(enrollment, now);

    if (!result.ok) {
      errors += 1;
      continue;
    }

    await prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        subscriptionStatus: SubscriptionStatus.PAYMENT_DUE
      }
    });

    await queueSubscriptionNotification({
      type: "SUBSCRIPTION_RENEWAL_REMINDER",
      enrollmentId: enrollment.id,
      paymentId: result.payment.id,
      parentId: enrollment.child.parentId,
      sequence: result.payment.sequence,
      scheduledAt: now
    });

    if (result.created) renewalsCreated += 1;
    renewalRemindersQueued += 1;
  }

  const dueEnrollments = await prisma.studentEnrollment.findMany({
    where: {
      status: StudentEnrollmentStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.PAYMENT_DUE,
      nextPaymentDueAt: {
        not: null,
        lte: now
      }
    },
    include: {
      child: true,
      payments: {
        orderBy: {
          sequence: "desc"
        },
        take: 1
      }
    },
    orderBy: {
      nextPaymentDueAt: "asc"
    },
    take: limit
  });

  for (const enrollment of dueEnrollments) {
    const payment = enrollment.payments[0];

    if (
      !payment ||
      payment.status === PaymentStatus.PAID ||
      payment.status === PaymentStatus.UNDER_REVIEW
    ) {
      continue;
    }

    await prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        subscriptionStatus: SubscriptionStatus.PAST_DUE
      }
    });

    await queueSubscriptionNotification({
      type: "SUBSCRIPTION_PAST_DUE",
      enrollmentId: enrollment.id,
      paymentId: payment.id,
      parentId: enrollment.child.parentId,
      sequence: payment.sequence,
      scheduledAt: now
    });

    pastDueMarked += 1;
    pastDueNotificationsQueued += 1;
  }

  const pauseCandidates = await prisma.studentEnrollment.findMany({
    where: {
      status: StudentEnrollmentStatus.ACTIVE,
      subscriptionStatus: {
        in: [
          SubscriptionStatus.PAYMENT_DUE,
          SubscriptionStatus.PAST_DUE
        ]
      },
      graceUntil: {
        not: null,
        lte: now
      }
    },
    include: {
      child: true,
      payments: {
        orderBy: {
          sequence: "desc"
        },
        take: 1
      }
    },
    orderBy: {
      graceUntil: "asc"
    },
    take: limit
  });

  for (const enrollment of pauseCandidates) {
    const payment = enrollment.payments[0];

    if (
      !payment ||
      payment.status === PaymentStatus.PAID ||
      payment.status === PaymentStatus.UNDER_REVIEW
    ) {
      continue;
    }

    await prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: StudentEnrollmentStatus.PAUSED,
        subscriptionStatus: SubscriptionStatus.PAUSED,
        pausedAt: now
      }
    });

    await queueSubscriptionNotification({
      type: "SUBSCRIPTION_PAUSED",
      enrollmentId: enrollment.id,
      paymentId: payment.id,
      parentId: enrollment.child.parentId,
      sequence: payment.sequence,
      scheduledAt: now
    });

    paused += 1;
    pauseNotificationsQueued += 1;
  }

  const paymentAlerts = await refreshAllPaymentAttentionAlerts(now, limit);

  return {
    manualFreezes,
    renewalsCreated,
    renewalRemindersQueued,
    pastDueMarked,
    pastDueNotificationsQueued,
    paused,
    pauseNotificationsQueued,
    paymentAlerts,
    errors
  };
}
