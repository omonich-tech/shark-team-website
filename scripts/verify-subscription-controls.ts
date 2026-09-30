import "dotenv/config";
import {
  NotificationStatus,
  NotificationType,
  PaymentStatus,
  StudentEnrollmentStatus,
  SubscriptionStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { advanceSubscriptionLifecycle } from "../src/server/billing/subscription-lifecycle";
import {
  endEnrollmentSubscription,
  freezeEnrollmentSubscription,
  resumeEnrollmentSubscription
} from "../src/server/billing/subscription-controls";

const prisma = getPrisma();
const DAY = 24 * 60 * 60 * 1000;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const child = await prisma.child.findFirst({
    where: { name: "Coach Trial Child" },
    include: {
      enrollments: {
        where: { status: StudentEnrollmentStatus.ACTIVE },
        include: {
          payments: {
            orderBy: { sequence: "desc" }
          }
        },
        take: 1
      }
    }
  });

  assert(child, "Subscription controls smoke child not found");
  const enrollment = child.enrollments[0];
  assert(enrollment, "Subscription controls enrollment not found");
  assert(
    enrollment.subscriptionStatus === SubscriptionStatus.ACTIVE,
    "Subscription controls require an ACTIVE subscription"
  );
  assert(
    enrollment.currentPeriodStart &&
      enrollment.currentPeriodEnd &&
      enrollment.nextPaymentDueAt,
    "Subscription controls require initialized billing dates"
  );

  const snapshot = {
    status: enrollment.status,
    subscriptionStatus: enrollment.subscriptionStatus,
    startDate: enrollment.startDate,
    endDate: enrollment.endDate,
    currentPeriodStart: enrollment.currentPeriodStart,
    currentPeriodEnd: enrollment.currentPeriodEnd,
    nextPaymentDueAt: enrollment.nextPaymentDueAt,
    graceUntil: enrollment.graceUntil,
    pausedAt: enrollment.pausedAt,
    freezeStartedAt: enrollment.freezeStartedAt,
    freezeUntil: enrollment.freezeUntil,
    freezeReason: enrollment.freezeReason,
    endReason: enrollment.endReason
  };

  const paidPayment = enrollment.payments.find(
    (payment) =>
      payment.status === PaymentStatus.PAID &&
      payment.periodEnd?.getTime() === enrollment.currentPeriodEnd?.getTime()
  );

  assert(paidPayment, "Current paid subscription period not found");

  const preDue = new Date(
    enrollment.currentPeriodEnd.getTime() - 2 * DAY
  );

  const lifecycle = await advanceSubscriptionLifecycle(preDue);

  assert(
    lifecycle.renewalsCreated === 1,
    "Expected lifecycle to create a renewal before freeze"
  );

  const renewal = await prisma.subscriptionPayment.findFirst({
    where: {
      enrollmentId: enrollment.id,
      sequence: paidPayment.sequence + 1
    },
    orderBy: { createdAt: "desc" }
  });

  assert(renewal, "Pending renewal payment not found");
  assert(
    renewal.status === PaymentStatus.PENDING,
    "Renewal must be PENDING before manual freeze"
  );

  const beforeFreeze = await prisma.studentEnrollment.findUnique({
    where: { id: enrollment.id }
  });
  assert(
    beforeFreeze?.subscriptionStatus === SubscriptionStatus.PAYMENT_DUE,
    "Pre-freeze subscription should be PAYMENT_DUE"
  );
  assert(beforeFreeze.currentPeriodEnd, "Missing current period end before freeze");

  const originalEnd = beforeFreeze.currentPeriodEnd;
  const originalRenewalStart = renewal.periodStart;
  assert(originalRenewalStart, "Renewal period start is missing");

  const frozen = await freezeEnrollmentSubscription({
    enrollmentId: enrollment.id,
    days: 7,
    reason: "CI family trip",
    now: preDue
  });

  assert(frozen.ok, "Manual freeze failed");

  let current = await prisma.studentEnrollment.findUnique({
    where: { id: enrollment.id }
  });

  assert(
    current?.subscriptionStatus === SubscriptionStatus.FROZEN,
    "Manual freeze did not set FROZEN"
  );
  assert(
    current.currentPeriodEnd?.getTime() === originalEnd.getTime() + 7 * DAY,
    "Freeze did not extend paid-through date by 7 days"
  );

  let shiftedRenewal = await prisma.subscriptionPayment.findUnique({
    where: { id: renewal.id }
  });

  assert(
    shiftedRenewal?.periodStart?.getTime() ===
      originalRenewalStart.getTime() + 7 * DAY,
    "Freeze did not shift the pending renewal"
  );

  const staleReminder = await prisma.notification.findFirst({
    where: {
      enrollmentId: enrollment.id,
      subscriptionPaymentId: renewal.id,
      type: NotificationType.SUBSCRIPTION_RENEWAL_REMINDER
    },
    orderBy: { createdAt: "desc" }
  });

  assert(
    staleReminder?.status === NotificationStatus.SKIPPED,
    "Freeze did not invalidate the old renewal reminder"
  );

  const earlyResumeAt = new Date(preDue.getTime() + 3 * DAY);
  const resumed = await resumeEnrollmentSubscription({
    enrollmentId: enrollment.id,
    reason: "CI early return",
    now: earlyResumeAt
  });

  assert(resumed.ok, "Early manual resume failed");

  current = await prisma.studentEnrollment.findUnique({
    where: { id: enrollment.id }
  });

  assert(
    current?.subscriptionStatus === SubscriptionStatus.ACTIVE,
    "Early resume did not reactivate subscription"
  );
  assert(
    current.currentPeriodEnd?.getTime() === originalEnd.getTime() + 3 * DAY,
    "Early resume did not keep only the actually frozen days"
  );

  shiftedRenewal = await prisma.subscriptionPayment.findUnique({
    where: { id: renewal.id }
  });

  assert(
    shiftedRenewal?.periodStart?.getTime() ===
      originalRenewalStart.getTime() + 3 * DAY,
    "Early resume did not correct renewal dates"
  );

  const secondFreezeAt = new Date(earlyResumeAt.getTime() + DAY);
  const secondFreeze = await freezeEnrollmentSubscription({
    enrollmentId: enrollment.id,
    days: 7,
    reason: "CI full freeze",
    now: secondFreezeAt
  });

  assert(secondFreeze.ok, "Second manual freeze failed");

  const freezeUntil = new Date(secondFreezeAt.getTime() + 7 * DAY);
  const automatic = await advanceSubscriptionLifecycle(
    new Date(freezeUntil.getTime() + 60_000)
  );

  assert(
    automatic.manualFreezes.resumed === 1,
    "Lifecycle did not automatically resume expired manual freeze"
  );

  current = await prisma.studentEnrollment.findUnique({
    where: { id: enrollment.id }
  });

  assert(
    current?.subscriptionStatus !== SubscriptionStatus.FROZEN,
    "Automatic resume left subscription frozen"
  );
  assert(!current?.freezeUntil, "Automatic resume did not clear freezeUntil");

  const ended = await endEnrollmentSubscription({
    enrollmentId: enrollment.id,
    reason: "CI final termination",
    now: new Date(freezeUntil.getTime() + DAY)
  });

  assert(ended.ok, "Subscription termination failed");

  current = await prisma.studentEnrollment.findUnique({
    where: { id: enrollment.id }
  });

  assert(
    current?.status === StudentEnrollmentStatus.ENDED,
    "Termination did not end enrollment"
  );
  assert(
    current.subscriptionStatus === SubscriptionStatus.ENDED,
    "Termination did not end subscription"
  );

  const cancelledRenewal = await prisma.subscriptionPayment.findUnique({
    where: { id: renewal.id }
  });

  assert(
    cancelledRenewal?.status === PaymentStatus.CANCELLED,
    "Termination did not cancel outstanding renewal"
  );

  const controlTypes = await prisma.notification.findMany({
    where: {
      enrollmentId: enrollment.id,
      type: {
        in: [
          NotificationType.SUBSCRIPTION_FROZEN,
          NotificationType.SUBSCRIPTION_RESUMED,
          NotificationType.SUBSCRIPTION_ENDED
        ]
      }
    },
    select: { type: true }
  });

  const typeSet = new Set(controlTypes.map((item) => item.type));
  assert(
    typeSet.has(NotificationType.SUBSCRIPTION_FROZEN),
    "Freeze notification was not queued"
  );
  assert(
    typeSet.has(NotificationType.SUBSCRIPTION_RESUMED),
    "Resume notification was not queued"
  );
  assert(
    typeSet.has(NotificationType.SUBSCRIPTION_ENDED),
    "End notification was not queued"
  );

  await prisma.notification.deleteMany({
    where: {
      enrollmentId: enrollment.id,
      OR: [
        { subscriptionPaymentId: renewal.id },
        {
          type: {
            in: [
              NotificationType.SUBSCRIPTION_FROZEN,
              NotificationType.SUBSCRIPTION_RESUMED,
              NotificationType.SUBSCRIPTION_ENDED
            ]
          }
        }
      ]
    }
  });

  await prisma.subscriptionPayment.delete({
    where: { id: renewal.id }
  });

  await prisma.studentEnrollment.update({
    where: { id: enrollment.id },
    data: snapshot
  });

  console.log("Subscription freeze/resume/end verification passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
