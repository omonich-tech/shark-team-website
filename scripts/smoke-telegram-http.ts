import "dotenv/config";
import { createHmac } from "node:crypto";
import { verifyMiniAppInitData } from "../src/server/telegram/miniapp-auth";
import {
  NotificationStatus,
  NotificationType
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { buildTelegramAssistantReply } from "../src/server/telegram/assistant";
import { runTelegramTrialSmoke } from "./smoke-telegram-trial";

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

  const publicMenu = await fetch(
    `${baseUrl}/api/telegram/webhook`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": webhookSecret
      },
      body: JSON.stringify({
        update_id: 101,
        message: {
          text: "/start",
          chat: { id: 777099, type: "private" },
          from: { id: 777099, first_name: "New Visitor", language_code: "ru" }
        }
      })
    }
  );
  assert(publicMenu.ok, "Unlinked Telegram /start menu failed");

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

  const telegramKey = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const signed = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 777001, first_name: "CI Parent" })
  });
  const dataCheck = [...signed.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + "=" + value).join("\\n");
  const miniSecret = createHmac("sha256", "WebAppData").update(telegramKey).digest();
  signed.set("hash", createHmac("sha256", miniSecret).update(dataCheck).digest("hex"));
  assert(verifyMiniAppInitData(signed.toString())?.id === 777001n,
    "Telegram Mini App valid signature rejected");
  signed.set("user", JSON.stringify({ id: 999999, first_name: "Forged" }));
  assert(verifyMiniAppInitData(signed.toString()) === null, "Forged Mini App identity accepted");

  const parentMini = await fetch(baseUrl + "/api/miniapp/dashboard?role=parent", {
    headers: { "x-telegram-init-data": "invalid" }
  });
  assert(parentMini.status === 401, "Mini App parent dashboard must reject unsigned initData");
  const coachMini = await fetch(baseUrl + "/api/miniapp/dashboard?role=coach");
  assert(coachMini.status === 401, "Mini App coach dashboard must require coach login");
  const verifiedParentMini = await fetch(baseUrl + "/api/miniapp/dashboard?role=parent", {
    headers: { "x-telegram-init-data": signed.toString() }
  });
  assert(verifiedParentMini.status === 401, "Modified parent Mini App data must fail HTTP auth");

  await runTelegramTrialSmoke();
  console.log("Telegram HTTP smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
