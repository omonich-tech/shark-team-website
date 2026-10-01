import "dotenv/config";
import {
  OperationalAlertStatus,
  OperationalAlertType,
  StudentEnrollmentStatus,
  SubscriptionStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { refreshPaymentAttentionAlert } from "../src/server/billing/payment-alerts";

const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      child: { name: "Coach Trial Child" },
      status: StudentEnrollmentStatus.ACTIVE
    },
    include: {
      child: true
    },
    orderBy: { createdAt: "asc" }
  });

  assert(enrollment, "Payment alert enrollment not found");

  const original = {
    status: enrollment.status,
    subscriptionStatus: enrollment.subscriptionStatus,
    nextPaymentDueAt: enrollment.nextPaymentDueAt,
    graceUntil: enrollment.graceUntil
  };

  await prisma.operationalAlert.deleteMany({
    where: {
      type: OperationalAlertType.PAYMENT_ATTENTION,
      enrollmentId: enrollment.id
    }
  });

  const now = new Date("2026-12-20T10:00:00.000Z");
  const dueAt = new Date("2026-12-22T10:00:00.000Z");
  const graceUntil = new Date("2026-12-25T10:00:00.000Z");

  await prisma.studentEnrollment.update({
    where: { id: enrollment.id },
    data: {
      status: StudentEnrollmentStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.PAYMENT_DUE,
      nextPaymentDueAt: dueAt,
      graceUntil
    }
  });

  let result = await refreshPaymentAttentionAlert({
    enrollmentId: enrollment.id,
    now
  });

  assert(result.attention, "PAYMENT_DUE did not open payment alert");

  let alert = await prisma.operationalAlert.findUnique({
    where: { dedupeKey: "payment-attention:" + enrollment.id }
  });

  assert(alert, "Payment attention alert was not persisted");
  assert(alert.status === OperationalAlertStatus.OPEN, "Payment alert is not OPEN");
  assert(alert.type === OperationalAlertType.PAYMENT_ATTENTION, "Wrong payment alert type");
  assert(alert.severity === "warning", "PAYMENT_DUE must be warning");

  await prisma.studentEnrollment.update({
    where: { id: enrollment.id },
    data: {
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
      nextPaymentDueAt: new Date("2026-12-19T10:00:00.000Z"),
      graceUntil
    }
  });

  result = await refreshPaymentAttentionAlert({
    enrollmentId: enrollment.id,
    now
  });

  assert(result.attention, "PAST_DUE did not keep payment alert open");

  alert = await prisma.operationalAlert.findUnique({
    where: { dedupeKey: "payment-attention:" + enrollment.id }
  });
  assert(alert?.severity === "critical", "PAST_DUE must be critical");

  await prisma.studentEnrollment.update({
    where: { id: enrollment.id },
    data: {
      status: StudentEnrollmentStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE
    }
  });

  result = await refreshPaymentAttentionAlert({
    enrollmentId: enrollment.id,
    now
  });

  assert(!result.attention, "ACTIVE subscription did not clear payment alert");

  alert = await prisma.operationalAlert.findUnique({
    where: { dedupeKey: "payment-attention:" + enrollment.id }
  });
  assert(
    alert?.status === OperationalAlertStatus.RESOLVED,
    "Payment alert was not resolved"
  );
  assert(alert.resolvedAt, "Resolved payment alert has no resolvedAt");

  await prisma.studentEnrollment.update({
    where: { id: enrollment.id },
    data: original
  });

  console.log("Payment attention alert verification passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
