import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";
import {
  buildParentCabinetHome,
  buildParentCabinetView,
  resolveParentCabinetIntent
} from "../src/server/telegram/parent-cabinet";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(webhookSecret, "Telegram webhook secret is missing");

  const child = await prisma.child.findFirst({
    where: { name: "Regular Child" },
    include: {
      parent: true,
      enrollments: {
        where: { status: "ACTIVE" },
        include: { group: true },
        take: 1
      }
    }
  });

  assert(child, "Parent cabinet smoke child not found");
  assert(child.enrollments[0], "Parent cabinet smoke enrollment not found");

  const foreignChild = await prisma.child.findFirst({
    where: {
      parentId: { not: child.parentId }
    },
    select: { id: true }
  });

  assert(foreignChild, "Foreign child for access-control check not found");

  const telegramUserId = 777020n;
  const chatId = 777020n;

  await prisma.telegramContact.upsert({
    where: { telegramUserId },
    update: {
      parentId: child.parentId,
      leadId: null,
      chatId,
      locale: "ru",
      verifiedAt: new Date(),
      lastMessageAt: new Date()
    },
    create: {
      parentId: child.parentId,
      telegramUserId,
      chatId,
      username: "ci_parent_cabinet",
      firstName: "CI Parent Cabinet",
      languageCode: "ru",
      locale: "ru",
      verifiedAt: new Date(),
      lastMessageAt: new Date()
    }
  });

  const home = await buildParentCabinetHome(telegramUserId);
  assert(home.ok, "Parent cabinet home did not open");
  assert(home.text.includes("Regular Child"), "Parent cabinet does not show child");
  assert(
    JSON.stringify(home.replyMarkup).includes("parent:schedule:"),
    "Parent cabinet schedule button is missing"
  );
  assert(
    JSON.stringify(home.replyMarkup).includes("parent:subscription:"),
    "Parent cabinet subscription button is missing"
  );
  assert(
    JSON.stringify(home.replyMarkup).includes("parent:progress:"),
    "Parent cabinet progress button is missing"
  );

  const schedule = await buildParentCabinetView(
    telegramUserId,
    "schedule",
    child.id
  );
  assert(schedule.ok, "Parent schedule did not open");
  assert(
    schedule.text.includes("Ближайшие тренировки"),
    "Parent schedule heading is missing"
  );

  const attendance = await buildParentCabinetView(
    telegramUserId,
    "attendance",
    child.id
  );
  assert(attendance.ok, "Parent attendance did not open");
  assert(
    attendance.text.includes("Посещаемость"),
    "Parent attendance heading is missing"
  );

  const subscription = await buildParentCabinetView(
    telegramUserId,
    "subscription",
    child.id
  );
  assert(subscription.ok, "Parent subscription did not open");
  assert(
    subscription.text.includes("Абонементы"),
    "Parent subscription heading is missing"
  );

  const progress = await buildParentCabinetView(
    telegramUserId,
    "progress",
    child.id
  );
  assert(progress.ok, "Parent progress did not open");
  assert(
    progress.text.includes("Прогресс"),
    "Parent progress heading is missing"
  );

  const denied = await buildParentCabinetView(
    telegramUserId,
    "child",
    foreignChild.id
  );
  assert(
    !denied.ok && denied.error === "CHILD_NOT_AVAILABLE",
    "Parent cabinet exposed a child from another parent"
  );

  const intent = await resolveParentCabinetIntent(
    telegramUserId,
    "Покажи мой абонемент"
  );
  assert(intent?.ok, "Parent cabinet text intent did not resolve");
  assert(
    intent.text.includes("Абонементы"),
    "Subscription text intent returned wrong view"
  );

  const commandResponse = await fetch(
    baseUrl + "/api/telegram/webhook",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": webhookSecret
      },
      body: JSON.stringify({
        update_id: 9001,
        message: {
          text: "/cabinet",
          chat: { id: Number(chatId), type: "private" },
          from: {
            id: Number(telegramUserId),
            username: "ci_parent_cabinet",
            first_name: "CI Parent Cabinet",
            language_code: "ru"
          }
        }
      })
    }
  );

  assert(commandResponse.ok, "Telegram /cabinet webhook failed");

  const callbackResponse = await fetch(
    baseUrl + "/api/telegram/webhook",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": webhookSecret
      },
      body: JSON.stringify({
        update_id: 9002,
        callback_query: {
          id: "ci-parent-callback",
          data: "parent:subscription:" + child.id,
          from: {
            id: Number(telegramUserId),
            username: "ci_parent_cabinet",
            first_name: "CI Parent Cabinet"
          },
          message: {
            chat: { id: Number(chatId), type: "private" }
          }
        }
      })
    }
  );

  assert(callbackResponse.ok, "Telegram parent callback failed");

  const updatedContact = await prisma.telegramContact.findUnique({
    where: { telegramUserId }
  });

  assert(updatedContact?.parentId === child.parentId, "Parent link changed unexpectedly");

  console.log("Parent Telegram cabinet smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
