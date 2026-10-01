import "dotenv/config";
import {
  PaymentProvider,
  PaymentStatus,
  StudentEnrollmentStatus,
  SubscriptionStatus,
  TrialBookingStatus,
  TrialConversionStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { prepareParentSubscriptionPayment } from "../src/server/billing/parent-subscription-payment";
import { submitSubscriptionReceipt } from "../src/server/enrollment/trial-conversion";
import {
  buildParentCabinetView,
  handleParentSubscriptionPaymentCallback
} from "../src/server/telegram/parent-cabinet";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createBillingFixture(input: {
  parentId: string;
  parentName: string;
  phone: string;
  groupId: string;
  sessionId: string;
  label: string;
}) {
  const child = await prisma.child.create({
    data: {
      parentId: input.parentId,
      name: "CI Pay Child " + input.label,
      ageAtRegistration: 10
    }
  });

  const lead = await prisma.lead.create({
    data: {
      status: "CLOSED",
      parentName: input.parentName,
      childName: child.name,
      phone: input.phone,
      childAge: 10,
      locale: "ru",
      source: "ci-parent-payment",
      groupId: input.groupId,
      selectedSessionId: input.sessionId,
      parentId: input.parentId,
      childId: child.id
    }
  });

  const booking = await prisma.trialBooking.create({
    data: {
      leadId: lead.id,
      sessionId: input.sessionId,
      status: TrialBookingStatus.ATTENDED,
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      confirmedAt: new Date("2026-09-01T00:00:00.000Z")
    }
  });

  const conversion = await prisma.trialConversion.create({
    data: {
      trialBookingId: booking.id,
      childId: child.id,
      groupId: input.groupId,
      status: TrialConversionStatus.ENROLLED,
      amountUzs: 500000,
      enrolledAt: new Date("2026-09-01T00:00:00.000Z")
    }
  });

  const currentPeriodStart = new Date("2026-09-01T00:00:00.000Z");
  const currentPeriodEnd = new Date("2026-10-01T00:00:00.000Z");
  const nextPeriodEnd = new Date("2026-11-01T00:00:00.000Z");

  const enrollment = await prisma.studentEnrollment.create({
    data: {
      childId: child.id,
      groupId: input.groupId,
      status: StudentEnrollmentStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.PAYMENT_DUE,
      startDate: currentPeriodStart,
      currentPeriodStart,
      currentPeriodEnd,
      nextPaymentDueAt: currentPeriodEnd,
      graceUntil: new Date("2026-10-04T00:00:00.000Z")
    }
  });

  await prisma.subscriptionPayment.create({
    data: {
      trialConversionId: conversion.id,
      enrollmentId: enrollment.id,
      sequence: 1,
      provider: PaymentProvider.MANUAL_CARD,
      status: PaymentStatus.PAID,
      amountUzs: 500000,
      periodStart: currentPeriodStart,
      periodEnd: currentPeriodEnd,
      dueAt: currentPeriodStart,
      paidAt: new Date("2026-09-01T00:00:00.000Z")
    }
  });

  const renewal = await prisma.subscriptionPayment.create({
    data: {
      trialConversionId: conversion.id,
      enrollmentId: enrollment.id,
      sequence: 2,
      provider: PaymentProvider.MANUAL_CARD,
      status: PaymentStatus.PENDING,
      amountUzs: 500000,
      periodStart: currentPeriodEnd,
      periodEnd: nextPeriodEnd,
      dueAt: currentPeriodEnd
    }
  });

  return { child, lead, booking, conversion, enrollment, renewal };
}

async function main() {
  assert(webhookSecret, "Telegram webhook secret is missing");
  assert(
    process.env.MANUAL_PAYMENT_CARD_NUMBER,
    "Manual payment card is missing"
  );

  const base = await prisma.studentEnrollment.findFirst({
    where: {
      status: StudentEnrollmentStatus.ACTIVE
    },
    include: {
      child: { include: { parent: true } },
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

  assert(base, "Base enrollment for parent payment smoke not found");
  const session = base.group.sessions[0];
  assert(session, "Base session for parent payment smoke not found");

  const fixtureA = await createBillingFixture({
    parentId: base.child.parentId,
    parentName: base.child.parent.name,
    phone: base.child.parent.phone,
    groupId: base.groupId,
    sessionId: session.id,
    label: "A"
  });

  const fixtureB = await createBillingFixture({
    parentId: base.child.parentId,
    parentName: base.child.parent.name,
    phone: base.child.parent.phone,
    groupId: base.groupId,
    sessionId: session.id,
    label: "B"
  });

  const telegramUserId = 777023n;
  const chatId = 777023n;

  await prisma.telegramContact.upsert({
    where: { telegramUserId },
    update: {
      parentId: base.child.parentId,
      leadId: null,
      chatId,
      locale: "ru",
      selectedSubscriptionPaymentId: null,
      selectedSubscriptionPaymentAt: null
    },
    create: {
      parentId: base.child.parentId,
      telegramUserId,
      chatId,
      username: "ci_parent_subscription_payment",
      firstName: "CI Subscription Parent",
      languageCode: "ru",
      locale: "ru"
    }
  });

  const cabinet = await buildParentCabinetView(
    telegramUserId,
    "subscription",
    fixtureA.child.id,
    new Date("2026-10-01T12:00:00.000Z")
  );

  assert(cabinet.ok, "Parent subscription cabinet did not open");
  assert(
    JSON.stringify(cabinet.replyMarkup).includes(
      "ppay:" + fixtureA.enrollment.id
    ),
    "Pay button for due subscription is missing"
  );

  const callback = await handleParentSubscriptionPaymentCallback(
    telegramUserId,
    "ppay:" + fixtureA.enrollment.id
  );

  assert(callback?.ok, "Parent payment callback did not open");
  assert(
    callback.text.includes("К оплате"),
    "Parent payment instructions are missing amount"
  );
  assert(
    callback.text.includes("привязан именно к этому абонементу"),
    "Parent payment instructions do not explain receipt binding"
  );

  let contact = await prisma.telegramContact.findUnique({
    where: { telegramUserId }
  });

  assert(
    contact?.selectedSubscriptionPaymentId === fixtureA.renewal.id,
    "Selected subscription payment was not stored"
  );
  assert(
    contact.selectedSubscriptionPaymentAt,
    "Selected subscription payment timestamp was not stored"
  );

  const receipt = await submitSubscriptionReceipt({
    telegramUserId,
    telegramFileId: "ci-selected-subscription-receipt",
    receiptMimeType: "document:application/pdf",
    receiptSize: 12345
  });

  assert(receipt.ok, "Selected subscription receipt was rejected");
  assert(receipt.renewal, "Selected receipt was not treated as renewal");
  assert(
    receipt.payment.id === fixtureA.renewal.id,
    "Receipt was attached to the wrong subscription payment"
  );

  const [paymentA, paymentB] = await Promise.all([
    prisma.subscriptionPayment.findUnique({
      where: { id: fixtureA.renewal.id }
    }),
    prisma.subscriptionPayment.findUnique({
      where: { id: fixtureB.renewal.id }
    })
  ]);

  assert(
    paymentA?.status === PaymentStatus.UNDER_REVIEW,
    "Selected payment did not move UNDER_REVIEW"
  );
  assert(
    paymentA.receiptTelegramFileId ===
      "ci-selected-subscription-receipt",
    "Selected payment did not receive the receipt"
  );
  assert(
    paymentB?.status === PaymentStatus.PENDING,
    "Unselected payment was modified"
  );
  assert(
    paymentB.receiptTelegramFileId === null,
    "Receipt leaked to unselected payment"
  );

  contact = await prisma.telegramContact.findUnique({
    where: { telegramUserId }
  });

  assert(
    contact?.selectedSubscriptionPaymentId === null,
    "Payment selection was not cleared after receipt submission"
  );
  assert(
    contact?.selectedSubscriptionPaymentAt === null,
    "Payment selection timestamp was not cleared"
  );

  const webhookResponse = await fetch(
    baseUrl + "/api/telegram/webhook",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": webhookSecret
      },
      body: JSON.stringify({
        update_id: 9201,
        callback_query: {
          id: "ci-parent-payment-callback",
          data: "ppay:" + fixtureB.enrollment.id,
          from: {
            id: Number(telegramUserId),
            username: "ci_parent_subscription_payment",
            first_name: "CI Subscription Parent"
          },
          message: {
            chat: { id: Number(chatId), type: "private" }
          }
        }
      })
    }
  );

  assert(webhookResponse.ok, "Parent payment Telegram callback failed");

  contact = await prisma.telegramContact.findUnique({
    where: { telegramUserId }
  });

  assert(
    contact?.selectedSubscriptionPaymentId === fixtureB.renewal.id,
    "Webhook payment selection did not persist"
  );

  await prisma.telegramContact.delete({
    where: { telegramUserId }
  });
  await prisma.lead.deleteMany({
    where: {
      id: { in: [fixtureA.lead.id, fixtureB.lead.id] }
    }
  });
  await prisma.child.deleteMany({
    where: {
      id: { in: [fixtureA.child.id, fixtureB.child.id] }
    }
  });

  console.log("Parent subscription payment smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
