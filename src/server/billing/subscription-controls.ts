import {
  NotificationStatus,
  NotificationType,
  PaymentStatus,
  StudentEnrollmentStatus,
  SubscriptionStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { addDays } from "@/server/billing/subscription-period";
import { refreshPaymentAttentionAlert } from "@/server/billing/payment-alerts";

const FREEZE_OPTIONS = new Set([7, 14, 30]);

function shiftDate(value: Date | null, milliseconds: number) {
  return value ? new Date(value.getTime() + milliseconds) : null;
}

async function queueEnrollmentNotification(input: {
  enrollmentId: string;
  parentId: string;
  type:
    | "SUBSCRIPTION_FROZEN"
    | "SUBSCRIPTION_RESUMED"
    | "SUBSCRIPTION_ENDED";
  now: Date;
}) {
  const prisma = getPrisma();
  const suffix =
    input.type === "SUBSCRIPTION_FROZEN"
      ? "frozen"
      : input.type === "SUBSCRIPTION_RESUMED"
        ? "resumed"
        : "ended";

  return prisma.notification.create({
    data: {
      type: NotificationType[input.type],
      parentId: input.parentId,
      enrollmentId: input.enrollmentId,
      scheduledAt: input.now,
      dedupeKey:
        "subscription:" +
        input.enrollmentId +
        ":" +
        suffix +
        ":" +
        input.now.getTime()
    }
  });
}

async function getEnrollment(enrollmentId: string) {
  const prisma = getPrisma();

  return prisma.studentEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      child: true,
      payments: {
        orderBy: { sequence: "desc" }
      }
    }
  });
}

export async function freezeEnrollmentSubscription(input: {
  enrollmentId: string;
  days: number;
  reason?: string | null;
  now?: Date;
}) {
  if (!FREEZE_OPTIONS.has(input.days)) {
    return { ok: false as const, error: "INVALID_FREEZE_DAYS" as const };
  }

  const prisma = getPrisma();
  const now = input.now ?? new Date();
  const enrollment = await getEnrollment(input.enrollmentId);

  if (!enrollment) {
    return { ok: false as const, error: "ENROLLMENT_NOT_FOUND" as const };
  }

  if (enrollment.status === StudentEnrollmentStatus.ENDED) {
    return { ok: false as const, error: "SUBSCRIPTION_ENDED" as const };
  }

  if (enrollment.subscriptionStatus === SubscriptionStatus.FROZEN) {
    return { ok: false as const, error: "ALREADY_FROZEN" as const };
  }

  if (
    enrollment.subscriptionStatus === SubscriptionStatus.PAST_DUE ||
    enrollment.subscriptionStatus === SubscriptionStatus.PAUSED ||
    enrollment.subscriptionStatus === SubscriptionStatus.ENDED ||
    !enrollment.currentPeriodEnd ||
    !enrollment.nextPaymentDueAt
  ) {
    return { ok: false as const, error: "SUBSCRIPTION_NOT_FREEZABLE" as const };
  }

  if (
    enrollment.subscriptionStatus === SubscriptionStatus.PAYMENT_DUE &&
    enrollment.nextPaymentDueAt <= now
  ) {
    return { ok: false as const, error: "SUBSCRIPTION_ALREADY_DUE" as const };
  }

  const underReview = enrollment.payments.some(
    (payment) => payment.status === PaymentStatus.UNDER_REVIEW
  );

  if (underReview) {
    return { ok: false as const, error: "PAYMENT_UNDER_REVIEW" as const };
  }

  const extensionMs = input.days * 24 * 60 * 60 * 1000;
  const freezeUntil = addDays(now, input.days);
  const currentPeriodEnd = shiftDate(enrollment.currentPeriodEnd, extensionMs);
  const nextPaymentDueAt = shiftDate(
    enrollment.nextPaymentDueAt,
    extensionMs
  );
  const graceUntil = shiftDate(enrollment.graceUntil, extensionMs);

  const currentPaid =
    enrollment.payments.find(
      (payment) =>
        payment.status === PaymentStatus.PAID &&
        payment.periodEnd?.getTime() === enrollment.currentPeriodEnd?.getTime()
    ) ??
    enrollment.payments.find(
      (payment) => payment.status === PaymentStatus.PAID
    );

  const futureUnpaid = enrollment.payments.filter(
    (payment) =>
      payment.status !== PaymentStatus.PAID &&
      payment.status !== PaymentStatus.CANCELLED &&
      payment.periodStart &&
      payment.periodStart.getTime() >= enrollment.currentPeriodEnd!.getTime()
  );

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        subscriptionStatus: SubscriptionStatus.FROZEN,
        freezeStartedAt: now,
        freezeUntil,
        freezeReason: input.reason?.trim().slice(0, 500) || null,
        currentPeriodEnd,
        nextPaymentDueAt,
        graceUntil
      }
    });

    if (currentPaid?.periodEnd) {
      await tx.subscriptionPayment.update({
        where: { id: currentPaid.id },
        data: {
          periodEnd: shiftDate(currentPaid.periodEnd, extensionMs)
        }
      });
    }

    for (const payment of futureUnpaid) {
      await tx.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          periodStart: shiftDate(payment.periodStart, extensionMs),
          periodEnd: shiftDate(payment.periodEnd, extensionMs),
          dueAt: shiftDate(payment.dueAt, extensionMs)
        }
      });
    }

    await tx.notification.updateMany({
      where: {
        enrollmentId: enrollment.id,
        status: NotificationStatus.PENDING,
        type: {
          in: [
            NotificationType.SUBSCRIPTION_RENEWAL_REMINDER,
            NotificationType.SUBSCRIPTION_PAST_DUE,
            NotificationType.SUBSCRIPTION_PAUSED
          ]
        }
      },
      data: {
        status: NotificationStatus.SKIPPED,
        lastError: "SUBSCRIPTION_MANUALLY_FROZEN"
      }
    });

    return result;
  });

  await queueEnrollmentNotification({
    enrollmentId: enrollment.id,
    parentId: enrollment.child.parentId,
    type: "SUBSCRIPTION_FROZEN",
    now
  });

  await refreshPaymentAttentionAlert({
    enrollmentId: enrollment.id,
    now
  });

  return {
    ok: true as const,
    enrollment: updated,
    days: input.days
  };
}

export async function resumeEnrollmentSubscription(input: {
  enrollmentId: string;
  reason?: string | null;
  now?: Date;
  automatic?: boolean;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();
  const enrollment = await getEnrollment(input.enrollmentId);

  if (!enrollment) {
    return { ok: false as const, error: "ENROLLMENT_NOT_FOUND" as const };
  }

  if (
    enrollment.subscriptionStatus !== SubscriptionStatus.FROZEN ||
    !enrollment.freezeStartedAt ||
    !enrollment.freezeUntil
  ) {
    return { ok: false as const, error: "SUBSCRIPTION_NOT_FROZEN" as const };
  }

  const remainingMs = Math.max(
    0,
    enrollment.freezeUntil.getTime() - now.getTime()
  );
  const adjustmentMs = -remainingMs;

  const originalCurrentEnd =
    remainingMs > 0
      ? shiftDate(enrollment.currentPeriodEnd, adjustmentMs)
      : enrollment.currentPeriodEnd;
  const originalNextDue =
    remainingMs > 0
      ? shiftDate(enrollment.nextPaymentDueAt, adjustmentMs)
      : enrollment.nextPaymentDueAt;
  const originalGrace =
    remainingMs > 0
      ? shiftDate(enrollment.graceUntil, adjustmentMs)
      : enrollment.graceUntil;

  const currentPaid =
    enrollment.payments.find(
      (payment) =>
        payment.status === PaymentStatus.PAID &&
        payment.periodEnd?.getTime() === enrollment.currentPeriodEnd?.getTime()
    ) ??
    enrollment.payments.find(
      (payment) => payment.status === PaymentStatus.PAID
    );

  const futureUnpaid = enrollment.payments.filter(
    (payment) =>
      payment.status !== PaymentStatus.PAID &&
      payment.status !== PaymentStatus.CANCELLED &&
      payment.periodStart &&
      enrollment.currentPeriodEnd &&
      payment.periodStart.getTime() >= enrollment.currentPeriodEnd.getTime()
  );

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: StudentEnrollmentStatus.ACTIVE,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: originalCurrentEnd,
        nextPaymentDueAt: originalNextDue,
        graceUntil: originalGrace,
        freezeStartedAt: null,
        freezeUntil: null,
        freezeReason: null,
        pausedAt: null
      }
    });

    if (remainingMs > 0 && currentPaid?.periodEnd) {
      await tx.subscriptionPayment.update({
        where: { id: currentPaid.id },
        data: {
          periodEnd: shiftDate(currentPaid.periodEnd, adjustmentMs)
        }
      });
    }

    if (remainingMs > 0) {
      for (const payment of futureUnpaid) {
        await tx.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            periodStart: shiftDate(payment.periodStart, adjustmentMs),
            periodEnd: shiftDate(payment.periodEnd, adjustmentMs),
            dueAt: shiftDate(payment.dueAt, adjustmentMs)
          }
        });
      }
    }

    return result;
  });

  await queueEnrollmentNotification({
    enrollmentId: enrollment.id,
    parentId: enrollment.child.parentId,
    type: "SUBSCRIPTION_RESUMED",
    now
  });

  await refreshPaymentAttentionAlert({
    enrollmentId: enrollment.id,
    now
  });

  return {
    ok: true as const,
    enrollment: updated,
    automatic: Boolean(input.automatic)
  };
}

export async function endEnrollmentSubscription(input: {
  enrollmentId: string;
  reason?: string | null;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();
  const enrollment = await getEnrollment(input.enrollmentId);

  if (!enrollment) {
    return { ok: false as const, error: "ENROLLMENT_NOT_FOUND" as const };
  }

  if (
    enrollment.status === StudentEnrollmentStatus.ENDED ||
    enrollment.subscriptionStatus === SubscriptionStatus.ENDED
  ) {
    return {
      ok: true as const,
      alreadyEnded: true as const,
      enrollment
    };
  }

  if (
    enrollment.payments.some(
      (payment) => payment.status === PaymentStatus.UNDER_REVIEW
    )
  ) {
    return { ok: false as const, error: "PAYMENT_UNDER_REVIEW" as const };
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.subscriptionPayment.updateMany({
      where: {
        enrollmentId: enrollment.id,
        status: PaymentStatus.PENDING
      },
      data: {
        status: PaymentStatus.CANCELLED
      }
    });

    await tx.notification.updateMany({
      where: {
        enrollmentId: enrollment.id,
        status: NotificationStatus.PENDING
      },
      data: {
        status: NotificationStatus.SKIPPED,
        lastError: "SUBSCRIPTION_ENDED"
      }
    });

    return tx.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: StudentEnrollmentStatus.ENDED,
        subscriptionStatus: SubscriptionStatus.ENDED,
        endDate: now,
        endReason: input.reason?.trim().slice(0, 500) || null,
        freezeStartedAt: null,
        freezeUntil: null,
        freezeReason: null,
        pausedAt: null
      }
    });
  });

  await queueEnrollmentNotification({
    enrollmentId: enrollment.id,
    parentId: enrollment.child.parentId,
    type: "SUBSCRIPTION_ENDED",
    now
  });

  await refreshPaymentAttentionAlert({
    enrollmentId: enrollment.id,
    now
  });

  return {
    ok: true as const,
    alreadyEnded: false as const,
    enrollment: updated
  };
}

export async function resumeExpiredManualFreezes(
  now = new Date(),
  limit = 200
) {
  const prisma = getPrisma();
  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      subscriptionStatus: SubscriptionStatus.FROZEN,
      freezeUntil: {
        not: null,
        lte: now
      }
    },
    select: { id: true },
    orderBy: { freezeUntil: "asc" },
    take: limit
  });

  let resumed = 0;
  let failed = 0;

  for (const enrollment of enrollments) {
    const result = await resumeEnrollmentSubscription({
      enrollmentId: enrollment.id,
      now,
      automatic: true
    });

    if (result.ok) resumed += 1;
    else failed += 1;
  }

  return { resumed, failed };
}
