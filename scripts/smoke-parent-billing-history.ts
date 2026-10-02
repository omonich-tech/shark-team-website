import "dotenv/config";
import {
  LeadStatus,
  PaymentProvider,
  PaymentStatus,
  StudentEnrollmentStatus,
  SubscriptionFreezeRequestStatus,
  SubscriptionStatus,
  TrialBookingStatus,
  TrialConversionStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import {
  buildParentBillingHistoryIndex,
  buildParentBillingHistoryPage,
  buildParentCabinetHome,
  buildParentCabinetView,
  handleParentBillingHistoryCallback
} from "../src/server/telegram/parent-cabinet";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function addMonth(date: Date, count: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + count);
  return next;
}

async function createConversion(input: {
  childId: string;
  parentId: string;
  parentName: string;
  phone: string;
  groupId: string;
  sessionId: string;
  label: string;
}) {
  const child = await prisma.child.findUnique({
    where: { id: input.childId }
  });
  assert(child, "Billing history child not found");

  const lead = await prisma.lead.create({
    data: {
      status: LeadStatus.CLOSED,
      parentName: input.parentName,
      childName: child.name,
      phone: input.phone,
      childAge: child.ageAtRegistration,
      locale: "ru",
      source: "ci-billing-history-" + input.label,
      groupId: input.groupId,
      selectedSessionId: input.sessionId,
      parentId: input.parentId,
      childId: input.childId
    }
  });

  const booking = await prisma.trialBooking.create({
    data: {
      leadId: lead.id,
      sessionId: input.sessionId,
      status: TrialBookingStatus.ATTENDED,
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      confirmedAt: new Date("2026-01-01T00:00:00.000Z")
    }
  });

  const conversion = await prisma.trialConversion.create({
    data: {
      trialBookingId: booking.id,
      childId: input.childId,
      groupId: input.groupId,
      status: TrialConversionStatus.ENROLLED,
      amountUzs: 500000,
      enrolledAt: new Date("2026-01-01T00:00:00.000Z")
    }
  });

  return { lead, booking, conversion };
}

async function main() {
  assert(webhookSecret, "Telegram webhook secret is missing");

  const base = await prisma.studentEnrollment.findFirst({
    where: {
      status: StudentEnrollmentStatus.ACTIVE
    },
    include: {
      child: {
        include: {
          parent: true
        }
      },
      group: {
        include: {
          sessions: {
            orderBy: { startsAt: "asc" },
            take: 1
          }
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  assert(base, "Base enrollment for billing history smoke not found");
  const session = base.group.sessions[0];
  assert(session, "Base session for billing history smoke not found");

  const child = await prisma.child.create({
    data: {
      parentId: base.child.parentId,
      name: "CI Billing History Child",
      ageAtRegistration: 11
    }
  });

  const activeConversion = await createConversion({
    childId: child.id,
    parentId: base.child.parentId,
    parentName: base.child.parent.name,
    phone: base.child.parent.phone,
    groupId: base.groupId,
    sessionId: session.id,
    label: "active"
  });

  const start = new Date("2026-03-01T00:00:00.000Z");
  const activeEnrollment = await prisma.studentEnrollment.create({
    data: {
      childId: child.id,
      groupId: base.groupId,
      status: StudentEnrollmentStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      startDate: start,
      currentPeriodStart: addMonth(start, 6),
      currentPeriodEnd: addMonth(start, 7),
      nextPaymentDueAt: addMonth(start, 7),
      graceUntil: new Date("2026-10-04T00:00:00.000Z")
    }
  });

  for (let sequence = 1; sequence <= 7; sequence += 1) {
    const periodStart = addMonth(start, sequence - 1);
    const periodEnd = addMonth(start, sequence);

    await prisma.subscriptionPayment.create({
      data: {
        trialConversionId: activeConversion.conversion.id,
        enrollmentId: activeEnrollment.id,
        sequence,
        provider: PaymentProvider.MANUAL_CARD,
        status: PaymentStatus.PAID,
        amountUzs: 500000,
        periodStart,
        periodEnd,
        dueAt: periodStart,
        submittedAt: new Date(periodStart.getTime() + 60_000),
        reviewedAt: new Date(periodStart.getTime() + 120_000),
        paidAt: new Date(periodStart.getTime() + 120_000),
        reviewedBy: "ci:billing-history"
      }
    });
  }

  await prisma.subscriptionFreezeRequest.create({
    data: {
      enrollmentId: activeEnrollment.id,
      parentId: base.child.parentId,
      days: 7,
      reason: "TRAVEL",
      status: SubscriptionFreezeRequestStatus.APPROVED,
      reviewedAt: new Date("2026-07-15T00:00:00.000Z"),
      reviewedBy: "ci:billing-history"
    }
  });

  await prisma.subscriptionFreezeRequest.create({
    data: {
      enrollmentId: activeEnrollment.id,
      parentId: base.child.parentId,
      days: 14,
      reason: "ILLNESS",
      status: SubscriptionFreezeRequestStatus.REJECTED,
      reviewedAt: new Date("2026-08-15T00:00:00.000Z"),
      reviewedBy: "ci:billing-history",
      decisionNote: "CI"
    }
  });

  const endedConversion = await createConversion({
    childId: child.id,
    parentId: base.child.parentId,
    parentName: base.child.parent.name,
    phone: base.child.parent.phone,
    groupId: base.groupId,
    sessionId: session.id,
    label: "ended"
  });

  const endedStart = new Date("2026-01-01T00:00:00.000Z");
  const endedEnd = new Date("2026-02-01T00:00:00.000Z");

  const endedEnrollment = await prisma.studentEnrollment.create({
    data: {
      childId: child.id,
      groupId: base.groupId,
      status: StudentEnrollmentStatus.ENDED,
      subscriptionStatus: SubscriptionStatus.ENDED,
      startDate: endedStart,
      endDate: endedEnd,
      endReason: "CI old subscription",
      currentPeriodStart: endedStart,
      currentPeriodEnd: endedEnd,
      nextPaymentDueAt: endedEnd
    }
  });

  await prisma.subscriptionPayment.create({
    data: {
      trialConversionId: endedConversion.conversion.id,
      enrollmentId: endedEnrollment.id,
      sequence: 1,
      provider: PaymentProvider.MANUAL_CARD,
      status: PaymentStatus.PAID,
      amountUzs: 400000,
      periodStart: endedStart,
      periodEnd: endedEnd,
      dueAt: endedStart,
      paidAt: endedStart,
      reviewedAt: endedStart,
      reviewedBy: "ci:billing-history"
    }
  });

  const telegramUserId = 777025n;
  const chatId = 777025n;

  await prisma.telegramContact.upsert({
    where: { telegramUserId },
    update: {
      parentId: base.child.parentId,
      leadId: null,
      chatId,
      locale: "ru"
    },
    create: {
      parentId: base.child.parentId,
      telegramUserId,
      chatId,
      username: "ci_parent_billing_history",
      firstName: "CI Billing Parent",
      languageCode: "ru",
      locale: "ru"
    }
  });

  const childView = await buildParentCabinetView(
    telegramUserId,
    "child",
    child.id,
    new Date("2026-10-02T08:00:00.000Z")
  );

  assert(childView.ok, "Parent child view did not open");
  assert(
    JSON.stringify(childView.replyMarkup).includes(
      "parent:billing:" + child.id
    ),
    "Billing history button is missing from child menu"
  );

  const index = await buildParentBillingHistoryIndex(
    telegramUserId,
    child.id
  );

  assert(index.ok, "Billing history index did not open");
  assert(
    index.text.includes("Всего оплачено: <b>3 900 000 UZS</b>") ||
      index.text.includes("Всего оплачено: <b>3 900 000 UZS</b>"),
    "Billing history total is incorrect"
  );
  assert(
    JSON.stringify(index.replyMarkup).includes(
      "bh:" + activeEnrollment.id + ":0"
    ),
    "Active enrollment is missing from billing history"
  );
  assert(
    JSON.stringify(index.replyMarkup).includes(
      "bh:" + endedEnrollment.id + ":0"
    ),
    "Ended enrollment is missing from billing history"
  );

  const firstPage = await buildParentBillingHistoryPage(
    telegramUserId,
    activeEnrollment.id,
    0
  );

  assert(firstPage.ok, "Billing history first page did not open");
  assert(
    firstPage.text.includes("История · 1/"),
    "Billing history pagination is missing"
  );
  assert(
    firstPage.text.includes("Продление №7"),
    "Latest renewal is missing from billing history"
  );
  assert(
    firstPage.text.includes("Заявка на заморозку"),
    "Freeze history is missing"
  );
  assert(
    JSON.stringify(firstPage.replyMarkup).includes(
      "bh:" + activeEnrollment.id + ":1"
    ),
    "Next billing history page button is missing"
  );

  const secondPage = await handleParentBillingHistoryCallback(
    telegramUserId,
    "bh:" + activeEnrollment.id + ":1"
  );

  assert(secondPage?.ok, "Billing history second page did not open");
  assert(
    secondPage.text.includes("Первый абонемент"),
    "Old payment history is missing from later page"
  );

  const endedPage = await buildParentBillingHistoryPage(
    telegramUserId,
    endedEnrollment.id,
    0
  );

  assert(endedPage.ok, "Ended subscription history did not open");
  assert(
    endedPage.text.includes("Абонемент завершён"),
    "Ended subscription event is missing"
  );
  assert(
    endedPage.text.includes("400 000 UZS") ||
      endedPage.text.includes("400 000 UZS"),
    "Ended subscription payment is missing"
  );

  const foreignParent = await prisma.parent.create({
    data: {
      name: "CI Foreign Billing Parent",
      phone: "+998900077025",
      locale: "ru"
    }
  });

  const foreignTelegramUserId = 777026n;
  await prisma.telegramContact.create({
    data: {
      parentId: foreignParent.id,
      telegramUserId: foreignTelegramUserId,
      chatId: foreignTelegramUserId,
      locale: "ru"
    }
  });

  const denied = await buildParentBillingHistoryPage(
    foreignTelegramUserId,
    activeEnrollment.id,
    0
  );

  assert(
    !denied.ok && denied.error === "CHILD_NOT_AVAILABLE",
    "Foreign parent accessed another child's billing history"
  );

  const archiveParent = await prisma.parent.create({
    data: {
      name: "CI Archived Billing Parent",
      phone: "+998900077027",
      locale: "ru"
    }
  });
  const archiveChild = await prisma.child.create({
    data: {
      parentId: archiveParent.id,
      name: "CI Archived Billing Child",
      ageAtRegistration: 12
    }
  });
  await prisma.studentEnrollment.create({
    data: {
      childId: archiveChild.id,
      groupId: base.groupId,
      status: StudentEnrollmentStatus.ENDED,
      subscriptionStatus: SubscriptionStatus.ENDED,
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      endDate: new Date("2025-02-01T00:00:00.000Z"),
      endReason: "CI archived"
    }
  });
  const archiveTelegramUserId = 777027n;
  await prisma.telegramContact.create({
    data: {
      parentId: archiveParent.id,
      telegramUserId: archiveTelegramUserId,
      chatId: archiveTelegramUserId,
      locale: "ru"
    }
  });

  const archivedHome = await buildParentCabinetHome(
    archiveTelegramUserId
  );

  assert(
    archivedHome.ok &&
      archivedHome.text.includes("История оплат"),
    "Ended-only child lost access to billing history"
  );

  await prisma.telegramContact.delete({
    where: { telegramUserId: archiveTelegramUserId }
  });
  await prisma.child.delete({
    where: { id: archiveChild.id }
  });
  await prisma.parent.delete({
    where: { id: archiveParent.id }
  });

  const webhookResponse = await fetch(
    baseUrl + "/api/telegram/webhook",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": webhookSecret
      },
      body: JSON.stringify({
        update_id: 9301,
        callback_query: {
          id: "ci-billing-history-callback",
          data: "bh:" + activeEnrollment.id + ":0",
          from: {
            id: Number(telegramUserId),
            username: "ci_parent_billing_history",
            first_name: "CI Billing Parent"
          },
          message: {
            chat: { id: Number(chatId), type: "private" }
          }
        }
      })
    }
  );

  assert(webhookResponse.ok, "Billing history Telegram callback failed");

  await prisma.telegramContact.delete({
    where: { telegramUserId: foreignTelegramUserId }
  });
  await prisma.parent.delete({
    where: { id: foreignParent.id }
  });
  await prisma.telegramContact.delete({
    where: { telegramUserId }
  });
  await prisma.lead.deleteMany({
    where: {
      id: {
        in: [
          activeConversion.lead.id,
          endedConversion.lead.id
        ]
      }
    }
  });
  await prisma.child.delete({
    where: { id: child.id }
  });

  console.log("Parent billing history smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
