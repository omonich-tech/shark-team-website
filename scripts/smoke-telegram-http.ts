import "dotenv/config";
import {
  NotificationStatus,
  NotificationType
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { buildTelegramAssistantReply } from "../src/server/telegram/assistant";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const cronSecret = process.env.CRON_SECRET;
const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  if (!webhookSecret || !cronSecret) {
    throw new Error("Telegram smoke secrets are not configured");
  }

  const booking = await prisma.trialBooking.findFirst({
    where: {
      lead: {
        childName: "Coach Trial Child"
      }
    },
    include: {
      lead: true
    }
  });

  assert(booking, "Telegram smoke booking not found");

  const linkResponse = await fetch(
    `${baseUrl}/api/public/telegram/link`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id })
    }
  );

  const linkPayload = await linkResponse.json();

  assert(
    linkResponse.status === 201 && linkPayload.ok,
    "Telegram deep-link creation failed"
  );

  const deepLink = String(linkPayload.deepLink);
  const marker = "start=link_";
  const markerIndex = deepLink.indexOf(marker);

  assert(markerIndex >= 0, "Telegram deep-link token is missing");

  const token = deepLink.slice(markerIndex + marker.length);

  const unauthorizedWebhook = await fetch(
    `${baseUrl}/api/telegram/webhook`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": "wrong"
      },
      body: JSON.stringify({
        update_id: 1,
        message: {
          text: `/start link_${token}`,
          chat: { id: 777001, type: "private" },
          from: { id: 777001, first_name: "CI Parent" }
        }
      })
    }
  );

  assert(
    unauthorizedWebhook.status === 401,
    "Invalid Telegram webhook secret must return 401"
  );

  const linkedWebhook = await fetch(
    `${baseUrl}/api/telegram/webhook`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": webhookSecret
      },
      body: JSON.stringify({
        update_id: 2,
        message: {
          text: `/start link_${token}`,
          chat: { id: 777001, type: "private" },
          from: {
            id: 777001,
            username: "ci_parent",
            first_name: "CI Parent",
            language_code: "ru"
          }
        }
      })
    }
  );

  assert(linkedWebhook.ok, "Telegram link webhook failed");

  const contact = await prisma.telegramContact.findUnique({
    where: {
      telegramUserId: 777001n
    }
  });

  assert(contact, "Telegram contact was not created");
  assert(
    contact.leadId === booking.leadId,
    "Telegram contact is linked to the wrong Lead"
  );

  const priceReply = await buildTelegramAssistantReply(
    777001n,
    "Какая цена?"
  );

  assert(
    priceReply.includes("Пробное занятие"),
    "Telegram assistant did not answer from Price data"
  );

  const addressReply = await buildTelegramAssistantReply(
    777001n,
    "Где адрес?"
  );

  assert(
    addressReply.includes("Хитой"),
    "Telegram assistant did not answer from Branch data"
  );

  const notification = await prisma.notification.upsert({
    where: {
      dedupeKey: `ci:telegram:${booking.id}`
    },
    update: {
      status: NotificationStatus.PENDING,
      scheduledAt: new Date(Date.now() - 1000),
      attempts: 0,
      lastError: null
    },
    create: {
      type: NotificationType.TRIAL_CONFIRMED,
      leadId: booking.leadId,
      parentId: booking.lead.parentId,
      trialBookingId: booking.id,
      status: NotificationStatus.PENDING,
      scheduledAt: new Date(Date.now() - 1000),
      dedupeKey: `ci:telegram:${booking.id}`
    }
  });

  const unauthorizedWorker = await fetch(
    `${baseUrl}/api/jobs/notifications`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer wrong"
      }
    }
  );

  assert(
    unauthorizedWorker.status === 401,
    "Notification worker must reject wrong secret"
  );

  const worker = await fetch(
    `${baseUrl}/api/jobs/notifications`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`
      }
    }
  );

  const workerPayload = await worker.json();

  assert(worker.ok && workerPayload.ok, "Notification worker failed");

  const sentNotification = await prisma.notification.findUnique({
    where: { id: notification.id }
  });

  assert(
    sentNotification?.status === NotificationStatus.SENT,
    "Due Telegram notification was not marked SENT"
  );

  const normalMessage = await fetch(
    `${baseUrl}/api/telegram/webhook`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": webhookSecret
      },
      body: JSON.stringify({
        update_id: 3,
        message: {
          text: "Расписание",
          chat: { id: 777001, type: "private" },
          from: {
            id: 777001,
            username: "ci_parent",
            first_name: "CI Parent",
            language_code: "ru"
          }
        }
      })
    }
  );

  assert(normalMessage.ok, "Normal Telegram assistant message failed");

  const refreshedContact = await prisma.telegramContact.findUnique({
    where: {
      telegramUserId: 777001n
    }
  });

  assert(
    refreshedContact?.lastMessageAt,
    "Telegram lastMessageAt was not updated"
  );

  const usedToken = await prisma.telegramLinkToken.findFirst({
    where: {
      leadId: booking.leadId,
      usedAt: { not: null }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  assert(usedToken, "Telegram link token was not consumed");

  console.log("Telegram HTTP smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
