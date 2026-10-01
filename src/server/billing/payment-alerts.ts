import {
  OperationalAlertStatus,
  OperationalAlertType,
  PaymentStatus,
  StudentEnrollmentStatus,
  SubscriptionStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

function formatDate(value: Date | null) {
  return value
    ? value.toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" })
    : "—";
}

export async function refreshPaymentAttentionAlert(input: {
  enrollmentId: string;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();

  const enrollment = await prisma.studentEnrollment.findUnique({
    where: { id: input.enrollmentId },
    include: {
      child: true,
      group: true,
      payments: {
        orderBy: { sequence: "desc" },
        take: 3
      }
    }
  });

  const dedupeKey = "payment-attention:" + input.enrollmentId;

  if (!enrollment) {
    await prisma.operationalAlert.updateMany({
      where: {
        dedupeKey,
        status: OperationalAlertStatus.OPEN
      },
      data: {
        status: OperationalAlertStatus.RESOLVED,
        resolvedAt: now
      }
    });
    return { attention: false as const, reason: "ENROLLMENT_NOT_FOUND" as const };
  }

  const latestPayment = enrollment.payments[0] ?? null;
  const paymentUnderReview = enrollment.payments.some(
    (payment) => payment.status === PaymentStatus.UNDER_REVIEW
  );

  const subscriptionStatus = enrollment.subscriptionStatus;
  const needsAttention =
    !paymentUnderReview &&
    enrollment.status !== StudentEnrollmentStatus.ENDED &&
    (subscriptionStatus === SubscriptionStatus.PAYMENT_DUE ||
      subscriptionStatus === SubscriptionStatus.PAST_DUE ||
      subscriptionStatus === SubscriptionStatus.PAUSED);

  if (!needsAttention) {
    const resolved = await prisma.operationalAlert.updateMany({
      where: {
        dedupeKey,
        status: OperationalAlertStatus.OPEN
      },
      data: {
        status: OperationalAlertStatus.RESOLVED,
        resolvedAt: now
      }
    });

    return {
      attention: false as const,
      subscriptionStatus,
      paymentUnderReview,
      resolved: resolved.count > 0
    };
  }

  const severity =
    subscriptionStatus === SubscriptionStatus.PAYMENT_DUE
      ? "warning"
      : "critical";

  const title =
    subscriptionStatus === SubscriptionStatus.PAYMENT_DUE
      ? enrollment.child.name + " — скоро/требуется оплата"
      : subscriptionStatus === SubscriptionStatus.PAST_DUE
        ? enrollment.child.name + " — оплата просрочена"
        : enrollment.child.name + " — абонемент приостановлен из-за оплаты";

  const details = [
    "Группа: " + enrollment.group.internalName,
    "Статус: " + subscriptionStatus,
    enrollment.nextPaymentDueAt
      ? "Дата оплаты: " + formatDate(enrollment.nextPaymentDueAt)
      : null,
    enrollment.graceUntil
      ? "Льготный период до: " + formatDate(enrollment.graceUntil)
      : null,
    latestPayment
      ? "Последний платёж: " +
        latestPayment.status +
        " · " +
        latestPayment.amountUzs.toLocaleString("ru-RU") +
        " UZS"
      : null
  ]
    .filter(Boolean)
    .join(" · ");

  const alert = await prisma.operationalAlert.upsert({
    where: { dedupeKey },
    update: {
      type: OperationalAlertType.PAYMENT_ATTENTION,
      status: OperationalAlertStatus.OPEN,
      severity,
      childId: enrollment.childId,
      enrollmentId: enrollment.id,
      groupId: enrollment.groupId,
      title,
      details,
      resolvedAt: null
    },
    create: {
      type: OperationalAlertType.PAYMENT_ATTENTION,
      status: OperationalAlertStatus.OPEN,
      severity,
      childId: enrollment.childId,
      enrollmentId: enrollment.id,
      groupId: enrollment.groupId,
      title,
      details,
      dedupeKey,
      openedAt: now
    }
  });

  return {
    attention: true as const,
    subscriptionStatus,
    paymentUnderReview,
    alert
  };
}

export async function refreshAllPaymentAttentionAlerts(
  now = new Date(),
  limit = 500
) {
  const prisma = getPrisma();
  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      status: {
        in: [
          StudentEnrollmentStatus.ACTIVE,
          StudentEnrollmentStatus.PAUSED,
          StudentEnrollmentStatus.ENDED
        ]
      }
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: limit
  });

  let open = 0;
  let clear = 0;

  for (let index = 0; index < enrollments.length; index += 25) {
    const chunk = enrollments.slice(index, index + 25);
    const results = await Promise.all(
      chunk.map((item) =>
        refreshPaymentAttentionAlert({
          enrollmentId: item.id,
          now
        })
      )
    );
    open += results.filter((item) => item.attention).length;
    clear += results.filter((item) => !item.attention).length;
  }

  return {
    checked: enrollments.length,
    open,
    clear
  };
}
