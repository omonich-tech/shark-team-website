import "dotenv/config";
import {
  StudentEnrollmentStatus,
  SubscriptionFreezeRequestStatus,
  SubscriptionStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import {
  reviewParentFreezeRequest
} from "../src/server/billing/parent-freeze-request";
import { resumeEnrollmentSubscription } from "../src/server/billing/subscription-controls";
import {
  buildParentCabinetView,
  handleParentFreezeRequestCallback
} from "../src/server/telegram/parent-cabinet";

const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      status: StudentEnrollmentStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: { not: null },
      nextPaymentDueAt: { not: null },
      freezeRequests: {
        none: {
          status: SubscriptionFreezeRequestStatus.PENDING
        }
      },
      payments: {
        none: {
          status: "UNDER_REVIEW"
        }
      }
    },
    include: {
      child: {
        include: {
          parent: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  assert(enrollment, "Active enrollment for freeze smoke not found");

  const telegramUserId = 777024n;
  const chatId = 777024n;

  await prisma.telegramContact.upsert({
    where: { telegramUserId },
    update: {
      parentId: enrollment.child.parentId,
      leadId: null,
      chatId,
      locale: "ru"
    },
    create: {
      parentId: enrollment.child.parentId,
      telegramUserId,
      chatId,
      username: "ci_parent_freeze",
      firstName: "CI Freeze Parent",
      languageCode: "ru",
      locale: "ru"
    }
  });

  const cabinet = await buildParentCabinetView(
    telegramUserId,
    "subscription",
    enrollment.childId,
    new Date("2026-10-02T08:00:00.000Z")
  );

  assert(cabinet.ok, "Parent subscription cabinet did not open");
  assert(
    JSON.stringify(cabinet.replyMarkup).includes(
      "pf:" + enrollment.id
    ),
    "Freeze request button is missing"
  );

  const picker = await handleParentFreezeRequestCallback(
    telegramUserId,
    "pf:" + enrollment.id
  );

  assert(picker?.ok, "Freeze period picker did not open");
  assert(
    JSON.stringify(picker.replyMarkup).includes(
      "pfd:" + enrollment.id + ":14"
    ),
    "14-day freeze option is missing"
  );

  const reasons = await handleParentFreezeRequestCallback(
    telegramUserId,
    "pfd:" + enrollment.id + ":14"
  );

  assert(reasons?.ok, "Freeze reason picker did not open");
  assert(
    JSON.stringify(reasons.replyMarkup).includes(
      "pfr:" + enrollment.id + ":14:I"
    ),
    "Illness freeze reason is missing"
  );

  const submitted = await handleParentFreezeRequestCallback(
    telegramUserId,
    "pfr:" + enrollment.id + ":14:I"
  );

  assert(submitted?.ok, "Parent freeze request was not submitted");

  let request = await prisma.subscriptionFreezeRequest.findFirst({
    where: {
      enrollmentId: enrollment.id,
      parentId: enrollment.child.parentId,
      status: SubscriptionFreezeRequestStatus.PENDING
    },
    orderBy: { createdAt: "desc" }
  });

  assert(request, "Pending freeze request not found");
  assert(request.days === 14, "Freeze request days are incorrect");
  assert(request.reason === "ILLNESS", "Freeze request reason is incorrect");

  const duplicate = await handleParentFreezeRequestCallback(
    telegramUserId,
    "pfr:" + enrollment.id + ":14:I"
  );

  assert(
    duplicate && !duplicate.ok,
    "Duplicate pending freeze request was accepted"
  );

  const rejected = await reviewParentFreezeRequest({
    requestId: request.id,
    approve: false,
    reviewedBy: "ci:freeze",
    decisionNote: "CI rejection"
  });

  assert(rejected.ok, "Freeze request rejection failed");
  assert(!rejected.approved, "Rejected freeze request was approved");

  request = await prisma.subscriptionFreezeRequest.findUnique({
    where: { id: request.id }
  });

  assert(
    request?.status === SubscriptionFreezeRequestStatus.REJECTED,
    "Rejected freeze request did not become REJECTED"
  );

  let currentEnrollment = await prisma.studentEnrollment.findUnique({
    where: { id: enrollment.id }
  });

  assert(
    currentEnrollment?.subscriptionStatus === SubscriptionStatus.ACTIVE,
    "Rejected request changed the subscription"
  );

  const submittedAgain = await handleParentFreezeRequestCallback(
    telegramUserId,
    "pfr:" + enrollment.id + ":7:T"
  );

  assert(
    submittedAgain?.ok,
    "Second freeze request after rejection was not accepted"
  );

  const approvedRequest =
    await prisma.subscriptionFreezeRequest.findFirst({
      where: {
        enrollmentId: enrollment.id,
        status: SubscriptionFreezeRequestStatus.PENDING
      },
      orderBy: { createdAt: "desc" }
    });

  assert(approvedRequest, "Second pending freeze request not found");

  const now = new Date("2026-10-02T08:30:00.000Z");
  const approved = await reviewParentFreezeRequest({
    requestId: approvedRequest.id,
    approve: true,
    reviewedBy: "ci:freeze",
    decisionNote: "CI approval",
    now
  });

  assert(approved.ok, "Freeze request approval failed");
  assert(approved.approved, "Approved freeze request was not approved");

  currentEnrollment = await prisma.studentEnrollment.findUnique({
    where: { id: enrollment.id }
  });

  assert(
    currentEnrollment?.subscriptionStatus === SubscriptionStatus.FROZEN,
    "Approved request did not freeze the subscription"
  );
  assert(
    currentEnrollment?.freezeUntil?.getTime() ===
      now.getTime() + 7 * 24 * 60 * 60 * 1000,
    "Freeze end date is incorrect"
  );

  const approvedState =
    await prisma.subscriptionFreezeRequest.findUnique({
      where: { id: approvedRequest.id }
    });

  assert(
    approvedState?.status === SubscriptionFreezeRequestStatus.APPROVED,
    "Approved request status is incorrect"
  );

  const resumed = await resumeEnrollmentSubscription({
    enrollmentId: enrollment.id,
    now,
    reason: "CI cleanup"
  });

  assert(resumed.ok, "Freeze smoke cleanup resume failed");

  await prisma.subscriptionFreezeRequest.deleteMany({
    where: {
      enrollmentId: enrollment.id,
      reviewedBy: "ci:freeze"
    }
  });

  await prisma.telegramContact.delete({
    where: { telegramUserId }
  });

  console.log("Parent subscription freeze request smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
