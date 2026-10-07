import "dotenv/config";
import {
  NotificationType,
  PaymentProvider,
  PaymentStatus,
  TrialBookingStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";

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

async function main() {
  assert(webhookSecret, "Telegram webhook secret is missing");
  assert(adminChatId, "Telegram admin chat id is missing");
  assert(
    Number.isInteger(adminUserId),
    "Telegram admin user id is missing"
  );

  const optionsResponse = await fetch(
    `${baseUrl}/api/public/trial-options?age=10`
  );
  const options = await optionsResponse.json();

  assert(optionsResponse.ok && options.ok, "Trial options failed");
  assert(options.sessions.length > 0, "No trial session available");

  const selectedSessionId = options.sessions[0].id;
  const analyticsSuffix = Date.now().toString(36);
  const analyticsVisitorId = "manual-visitor-" + analyticsSuffix;
  const analyticsSessionId = "manual-session-" + analyticsSuffix;
  const analyticsPageViewId = "manual-page-" + analyticsSuffix;

  const lead = await postJson(`${baseUrl}/api/public/leads`, {
    parentName: "Manual Parent",
    childName: "Manual Child",
    phone: "+998901112233",
    childAge: 10,
    locale: "ru",
    selectedSessionId,
    landingPage: "/ru/trial",
    utmSource: "ci",
    utmMedium: "manual-card",
    utmCampaign: "manual-payment",
    analyticsVisitorId,
    analyticsSessionId,
    analyticsPageViewId
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
  assert(
    init.payload.payment.amountUzs === 50000,
    "Unexpected manual payment amount"
  );
  assert(
    typeof init.payload.manualCard.cardLast4 === "string" &&
      init.payload.manualCard.cardLast4.length === 4,
    "Manual card metadata is missing"
  );

  const paymentId = String(init.payload.payment.id);

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
  const parentUserId = 888001;

  const startWebhook = await postJson(
    `${baseUrl}/api/telegram/webhook`,
    {
      update_id: 801,
      message: {
        text: `/start link_${token}`,
        chat: { id: parentUserId, type: "private" },
        from: {
          id: parentUserId,
          username: "ci_manual_parent",
          first_name: "Manual Parent",
          language_code: "ru"
        }
      }
    },
    { "x-telegram-bot-api-secret-token": webhookSecret }
  );

  assert(startWebhook.status === 200, "Telegram start webhook failed");

  const receiptWebhook = await postJson(
    `${baseUrl}/api/telegram/webhook`,
    {
      update_id: 802,
      message: {
        message_id: 10,
        chat: { id: parentUserId, type: "private" },
        from: {
          id: parentUserId,
          username: "ci_manual_parent",
          first_name: "Manual Parent",
          language_code: "ru"
        },
        document: {
          file_id: "ci-receipt-pdf",
          file_name: "receipt.pdf",
          mime_type: "application/pdf",
          file_size: 20100
        }
      }
    },
    { "x-telegram-bot-api-secret-token": webhookSecret }
  );

  assert(receiptWebhook.status === 200, "Receipt webhook failed");

  const underReview = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { trialBooking: true }
  });

  assert(underReview, "Manual payment disappeared");
  assert(
    underReview.provider === PaymentProvider.MANUAL_CARD,
    "Unexpected payment provider"
  );
  assert(
    underReview.status === PaymentStatus.UNDER_REVIEW,
    "Receipt must put payment UNDER_REVIEW"
  );
  assert(
    underReview.receiptTelegramFileId === "ci-receipt-pdf",
    "Telegram document file id was not stored"
  );
  assert(
    underReview.receiptMimeType === "document:application/pdf",
    "Telegram document mime type was not stored"
  );
  assert(
    underReview.receiptSize === 20100,
    "Telegram document size was not stored"
  );
  assert(
    underReview.trialBooking.status === TrialBookingStatus.PAYMENT_PENDING,
    "Booking must stay reserved while receipt is reviewed"
  );

  const callback = await postJson(
    `${baseUrl}/api/telegram/webhook`,
    {
      update_id: 803,
      callback_query: {
        id: "ci-callback-approve",
        data: `manual:approve:${paymentId}`,
        from: {
          id: adminUserId,
          username: "ci_admin"
        },
        message: {
          message_id: 11,
          chat: {
            id: Number(adminChatId),
            type: "supergroup"
          }
        }
      }
    },
    { "x-telegram-bot-api-secret-token": webhookSecret }
  );

  assert(callback.status === 200, "Admin payment callback failed");

  const paid = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { trialBooking: true }
  });

  assert(paid?.status === PaymentStatus.PAID, "Payment was not marked PAID");
  assert(paid.paidAt, "Payment paidAt was not set");
  assert(paid.reviewedAt, "Payment reviewedAt was not set");
  assert(
    paid.trialBooking.status === TrialBookingStatus.CONFIRMED,
    "Booking was not CONFIRMED"
  );

  const funnelEvents = await prisma.webFunnelEvent.findMany({
    where: { visitorId: analyticsVisitorId },
    select: { eventName: true, paymentId: true }
  });
  const funnelNames = new Set(funnelEvents.map((event) => event.eventName));

  assert(funnelNames.has("lead_created"), "Lead conversion event is missing");
  assert(
    funnelNames.has("trial_booking_created"),
    "Booking conversion event is missing"
  );
  assert(funnelNames.has("payment_started"), "Payment-start event is missing");
  assert(funnelNames.has("payment_success"), "Payment-success event is missing");
  assert(
    funnelEvents.some(
      (event) =>
        event.eventName === "payment_success" && event.paymentId === paymentId
    ),
    "Payment-success attribution is incorrect"
  );

  const confirmedLead = await prisma.lead.findUnique({
    where: { id: lead.payload.lead.id }
  });

  assert(confirmedLead?.parentId, "Manual approval did not link Parent");
  assert(confirmedLead?.childId, "Manual approval did not link Child");

  const feedbackNotification = await prisma.notification.findFirst({
    where: {
      trialBookingId: booking.payload.booking.id,
      type: NotificationType.POST_TRIAL_FEEDBACK
    }
  });

  assert(
    feedbackNotification,
    "Manual approval did not schedule post-trial feedback"
  );

  console.log("Manual card payment HTTP smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
