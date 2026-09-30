import "dotenv/config";
import {
  NotificationType,
  PaymentStatus,
  StudentEnrollmentStatus,
  SubscriptionStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { advanceSubscriptionLifecycle } from "../src/server/billing/subscription-lifecycle";
import {
  reviewSubscriptionPayment,
  submitSubscriptionReceipt
} from "../src/server/enrollment/trial-conversion";

const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const child = await prisma.child.findFirst({
    where: {
      name: "Coach Trial Child"
    },
    include: {
      enrollments: {
        where: {
          status: StudentEnrollmentStatus.ACTIVE
        },
        include: {
          payments: {
            orderBy: {
              sequence: "desc"
            }
          }
        },
        take: 1
      }
    }
  });

  assert(child, "Lifecycle smoke child not found");
  const enrollment = child.enrollments[0];
  assert(enrollment, "Lifecycle smoke enrollment not found");
  assert(
    enrollment.subscriptionStatus === SubscriptionStatus.ACTIVE,
    "Lifecycle smoke enrollment is not ACTIVE"
  );

  const firstPayment = enrollment.payments.find(
    (payment) => payment.sequence === 1
  );
  assert(firstPayment, "First subscription payment not found");
  assert(
    firstPayment.status === PaymentStatus.PAID,
    "First subscription payment is not PAID"
  );

  const now = new Date("2026-10-25T12:00:00.000Z");
  const dueAt = new Date("2026-10-27T12:00:00.000Z");
  const graceUntil = new Date("2026-10-30T12:00:00.000Z");

  await prisma.studentEnrollment.update({
    where: { id: enrollment.id },
    data: {
      status: StudentEnrollmentStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date("2026-09-27T12:00:00.000Z"),
      currentPeriodEnd: dueAt,
      nextPaymentDueAt: dueAt,
      graceUntil,
      pausedAt: null
    }
  });

  const reminder = await advanceSubscriptionLifecycle(now);

  assert(
    reminder.renewalsCreated === 1,
    "Renewal payment was not created"
  );

  const renewal = await prisma.subscriptionPayment.findUnique({
    where: {
      trialConversionId_sequence: {
        trialConversionId: firstPayment.trialConversionId,
        sequence: 2
      }
    }
  });

  assert(renewal, "Second subscription payment not found");
  assert(
    renewal.status === PaymentStatus.PENDING,
    "Renewal payment must start PENDING"
  );
  assert(
    renewal.enrollmentId === enrollment.id,
    "Renewal payment is not linked to enrollment"
  );
  assert(
    renewal.periodStart?.getTime() === dueAt.getTime(),
    "Renewal period must start when the current month ends"
  );

  let updatedEnrollment = await prisma.studentEnrollment.findUnique({
    where: { id: enrollment.id }
  });

  assert(
    updatedEnrollment?.subscriptionStatus === SubscriptionStatus.PAYMENT_DUE,
    "Renewal reminder must move subscription to PAYMENT_DUE"
  );

  await advanceSubscriptionLifecycle(
    new Date("2026-10-27T12:01:00.000Z")
  );

  updatedEnrollment = await prisma.studentEnrollment.findUnique({
    where: { id: enrollment.id }
  });

  assert(
    updatedEnrollment?.subscriptionStatus === SubscriptionStatus.PAST_DUE,
    "Unpaid renewal must move to PAST_DUE after due date"
  );

  await advanceSubscriptionLifecycle(
    new Date("2026-10-30T12:01:00.000Z")
  );

  updatedEnrollment = await prisma.studentEnrollment.findUnique({
    where: { id: enrollment.id }
  });

  assert(
    updatedEnrollment?.subscriptionStatus === SubscriptionStatus.PAUSED,
    "Subscription must pause after grace period"
  );
  assert(
    updatedEnrollment?.status === StudentEnrollmentStatus.PAUSED,
    "Student enrollment must pause after grace period"
  );

  const receipt = await submitSubscriptionReceipt({
    telegramUserId: BigInt(777001),
    telegramFileId: "ci-renewal-receipt",
    receiptMimeType: "document:application/pdf",
    receiptSize: 24000
  });

  assert(receipt.ok, "Renewal receipt submission failed");
  assert(receipt.renewal, "Renewal receipt was treated as first payment");
  assert(
    receipt.payment.status === PaymentStatus.UNDER_REVIEW,
    "Renewal receipt did not move payment UNDER_REVIEW"
  );

  const approved = await reviewSubscriptionPayment({
    paymentId: renewal.id,
    approve: true,
    reviewedBy: "ci:lifecycle"
  });

  assert(approved.ok, "Renewal approval failed");
  assert(approved.approved, "Renewal was not approved");
  assert(approved.renewal, "Renewal approval was treated as first payment");

  updatedEnrollment = await prisma.studentEnrollment.findUnique({
    where: { id: enrollment.id }
  });

  assert(
    updatedEnrollment?.status === StudentEnrollmentStatus.ACTIVE,
    "Paid renewal did not reactivate enrollment"
  );
  assert(
    updatedEnrollment?.subscriptionStatus === SubscriptionStatus.ACTIVE,
    "Paid renewal did not reactivate subscription"
  );
  assert(
    updatedEnrollment?.currentPeriodStart?.getTime() ===
      renewal.periodStart?.getTime(),
    "Renewal did not advance current period start"
  );
  assert(
    updatedEnrollment?.currentPeriodEnd?.getTime() ===
      renewal.periodEnd?.getTime(),
    "Renewal did not advance current period end"
  );

  const paidRenewal = await prisma.subscriptionPayment.findUnique({
    where: { id: renewal.id }
  });

  assert(
    paidRenewal?.status === PaymentStatus.PAID,
    "Approved renewal was not marked PAID"
  );

  const notificationTypes = await prisma.notification.findMany({
    where: {
      enrollmentId: enrollment.id,
      subscriptionPaymentId: renewal.id
    },
    select: {
      type: true
    }
  });

  const types = new Set(notificationTypes.map((item) => item.type));

  assert(
    types.has(NotificationType.SUBSCRIPTION_RENEWAL_REMINDER),
    "Renewal reminder notification was not queued"
  );
  assert(
    types.has(NotificationType.SUBSCRIPTION_PAST_DUE),
    "Past-due notification was not queued"
  );
  assert(
    types.has(NotificationType.SUBSCRIPTION_PAUSED),
    "Pause notification was not queued"
  );

  console.log("Subscription renewal lifecycle verification passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
