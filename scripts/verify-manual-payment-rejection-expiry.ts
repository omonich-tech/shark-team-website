import "dotenv/config";
import {
  PaymentStatus,
  TrialBookingStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { expireTrialBookings } from "../src/server/trial/expire-trial-bookings";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
const adminUserId = Number(
  (process.env.TELEGRAM_ADMIN_USER_IDS ?? "").split(",")[0]
);
const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });

  return {
    status: response.status,
    payload: await response.json()
  };
}

async function createUnderReviewBooking(input: {
  suffix: string;
  phone: string;
  telegramUserId: number;
}) {
  const optionsResponse = await fetch(
    `${baseUrl}/api/public/trial-options?age=10`
  );
  const options = await optionsResponse.json();

  assert(optionsResponse.ok && options.ok, "Trial options failed");
  assert(options.sessions.length > 0, "No trial session available");

  const selectedSessionId = options.sessions[0].id;

  const lead = await postJson(`${baseUrl}/api/public/leads`, {
    parentName: `Reject Parent ${input.suffix}`,
    childName: `Reject Child ${input.suffix}`,
    phone: input.phone,
    childAge: 10,
    locale: "ru",
    selectedSessionId,
    landingPage: "/ru/trial",
    utmSource: "ci",
    utmMedium: "manual-card",
    utmCampaign: "rejection-expiry"
  });

  assert(lead.status === 201 && lead.payload.ok, "Lead creation failed");

  const booking = await postJson(
    `${baseUrl}/api/public/trial-bookings`,
    { leadId: lead.payload.lead.id }
  );
  assert(
    booking.status === 201 && booking.payload.ok,
    "Trial booking failed"
  );

  const init = await postJson(
    `${baseUrl}/api/public/payments/manual/init`,
    { bookingId: booking.payload.booking.id }
  );
  assert(init.status === 201 && init.payload.ok, "Manual payment init failed");

  const link = await postJson(
    `${baseUrl}/api/public/telegram/link`,
    { bookingId: booking.payload.booking.id }
  );
  assert(link.status === 201 && link.payload.ok, "Telegram link creation failed");

  const deepLink = String(link.payload.deepLink);
  const marker = "start=link_";
  const tokenIndex = deepLink.indexOf(marker);
  assert(tokenIndex >= 0, "Telegram link token is missing");
  const token = deepLink.slice(tokenIndex + marker.length);

  const telegramHeaders = {
    "x-telegram-bot-api-secret-token": webhookSecret!
  };

  const startWebhook = await postJson(
    `${baseUrl}/api/telegram/webhook`,
    {
      update_id: 900 + input.telegramUserId,
      message: {
        text: `/start link_${token}`,
        chat: { id: input.telegramUserId, type: "private" },
        from: {
          id: input.telegramUserId,
          username: `ci_parent_${input.suffix}`,
          first_name: "CI Parent",
          language_code: "ru"
        }
      }
    },
    telegramHeaders
  );
  assert(startWebhook.status === 200, "Telegram start webhook failed");

  const receiptWebhook = await postJson(
    `${baseUrl}/api/telegram/webhook`,
    {
      update_id: 1000 + input.telegramUserId,
      message: {
        message_id: 20,
        chat: { id: input.telegramUserId, type: "private" },
        from: {
          id: input.telegramUserId,
          username: `ci_parent_${input.suffix}`,
          first_name: "CI Parent",
          language_code: "ru"
        },
        photo: [
          {
            file_id: `ci-receipt-${input.suffix}`,
            width: 1200,
            height: 1600,
            file_size: 18000
          }
        ]
      }
    },
    telegramHeaders
  );
  assert(receiptWebhook.status === 200, "Receipt webhook failed");

  const paymentId = String(init.payload.payment.id);
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { trialBooking: true }
  });

  assert(payment, "Payment disappeared");
  assert(
    payment.status === PaymentStatus.UNDER_REVIEW,
    "Payment must be UNDER_REVIEW after receipt"
  );
  assert(
    payment.trialBooking.status === TrialBookingStatus.PAYMENT_PENDING,
    "Booking must be PAYMENT_PENDING while receipt is reviewed"
  );

  return {
    paymentId,
    bookingId: booking.payload.booking.id as string
  };
}

async function rejectPayment(paymentId: string) {
  const callback = await postJson(
    `${baseUrl}/api/telegram/webhook`,
    {
      update_id: 2001,
      callback_query: {
        id: `ci-reject-${paymentId}`,
        data: `manual:wrong_amount:${paymentId}`,
        from: {
          id: adminUserId,
          username: "ci_admin"
        },
        message: {
          message_id: 21,
          chat: {
            id: Number(adminChatId),
            type: "supergroup"
          }
        }
      }
    },
    { "x-telegram-bot-api-secret-token": webhookSecret! }
  );

  assert(callback.status === 200, "Reject callback failed");
}

async function main() {
  assert(webhookSecret, "Telegram webhook secret is missing");
  assert(adminChatId, "Telegram admin chat id is missing");
  assert(
    Number.isInteger(adminUserId),
    "Telegram admin user id is missing"
  );

  const rejected = await createUnderReviewBooking({
    suffix: "reject",
    phone: "+998901119901",
    telegramUserId: 888101
  });

  await rejectPayment(rejected.paymentId);

  const rejectedState = await prisma.payment.findUnique({
    where: { id: rejected.paymentId },
    include: { trialBooking: true }
  });

  assert(rejectedState, "Rejected payment disappeared");
  assert(
    rejectedState.status === PaymentStatus.REJECTED,
    "Rejected payment must be REJECTED"
  );
  assert(
    rejectedState.rejectionReason === "WRONG_AMOUNT",
    "Rejected payment must keep WRONG_AMOUNT reason"
  );
  assert(
    rejectedState.trialBooking.status === TrialBookingStatus.HOLD,
    "Rejected payment must return an unexpired booking to HOLD"
  );

  await prisma.trialBooking.update({
    where: { id: rejected.bookingId },
    data: { expiresAt: new Date(Date.now() - 60_000) }
  });

  const expiredCount = await expireTrialBookings();
  assert(expiredCount >= 1, "Expired HOLD was not processed");

  const expiredBooking = await prisma.trialBooking.findUnique({
    where: { id: rejected.bookingId }
  });
  assert(
    expiredBooking?.status === TrialBookingStatus.EXPIRED,
    "Unpaid rejected HOLD must become EXPIRED after its deadline"
  );

  const frozen = await createUnderReviewBooking({
    suffix: "frozen",
    phone: "+998901119902",
    telegramUserId: 888102
  });

  await prisma.trialBooking.update({
    where: { id: frozen.bookingId },
    data: { expiresAt: new Date(Date.now() - 60_000) }
  });

  await expireTrialBookings();

  const frozenState = await prisma.payment.findUnique({
    where: { id: frozen.paymentId },
    include: { trialBooking: true }
  });

  assert(frozenState, "Frozen payment disappeared");
  assert(
    frozenState.status === PaymentStatus.UNDER_REVIEW,
    "Receipt under review must stay UNDER_REVIEW"
  );
  assert(
    frozenState.trialBooking.status === TrialBookingStatus.PAYMENT_PENDING,
    "PAYMENT_PENDING booking must not expire while admin reviews the receipt"
  );

  console.log(
    "Manual payment rejection, expiry, and review-freeze verification passed."
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
