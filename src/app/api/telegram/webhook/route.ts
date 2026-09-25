import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { buildTelegramAssistantReply } from "@/server/telegram/assistant";
import {
  consumeTelegramLinkToken
} from "@/server/telegram/link";
import { sendTelegramMessage } from "@/server/telegram/send-message";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: {
      id?: number;
      type?: string;
    };
    from?: {
      id?: number;
      username?: string;
      first_name?: string;
      language_code?: string;
    };
  };
};

function webhookAuthorized(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!secret) {
    return true;
  }

  return (
    request.headers.get("x-telegram-bot-api-secret-token") === secret
  );
}

export async function POST(request: NextRequest) {
  if (!webhookAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  let update: TelegramUpdate;

  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  const text = message?.text?.trim();
  const chatId = message?.chat?.id;
  const telegramUserId = message?.from?.id;

  if (!text || chatId === undefined || telegramUserId === undefined) {
    return NextResponse.json({ ok: true });
  }

  if (message?.chat?.type && message.chat.type !== "private") {
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith("/start link_")) {
    const token = text.slice("/start link_".length).trim();

    const result = await consumeTelegramLinkToken({
      token,
      telegramUserId: BigInt(telegramUserId),
      chatId: BigInt(chatId),
      username: message.from?.username ?? null,
      firstName: message.from?.first_name ?? null,
      languageCode: message.from?.language_code ?? null
    });

    if (result.ok) {
      const greeting =
        result.contact.locale === "uz"
          ? "✅ Telegram SHARK TEAM arizangizga ulandi. Bu yerda bron, to‘lov, jadval va manzil bo‘yicha savol berishingiz mumkin."
          : "✅ Telegram подключён к вашей заявке SHARK TEAM. Здесь можно спрашивать о брони, оплате, расписании и адресе.";

      await sendTelegramMessage({
        chatId: BigInt(chatId),
        text: greeting
      });
    } else {
      await sendTelegramMessage({
        chatId: BigInt(chatId),
        text:
          "Ссылка недействительна или уже истекла. Получите новую персональную ссылку на сайте SHARK TEAM."
      });
    }

    return NextResponse.json({ ok: true });
  }

  const prisma = getPrisma();
  const contact = await prisma.telegramContact.findUnique({
    where: {
      telegramUserId: BigInt(telegramUserId)
    }
  });

  if (!contact) {
    await sendTelegramMessage({
      chatId: BigInt(chatId),
      text:
        "Сначала подключите Telegram через персональную ссылку после записи на пробное занятие."
    });

    return NextResponse.json({ ok: true });
  }

  await prisma.telegramContact.update({
    where: { id: contact.id },
    data: {
      chatId: BigInt(chatId),
      username: message.from?.username ?? contact.username,
      firstName: message.from?.first_name ?? contact.firstName,
      languageCode:
        message.from?.language_code ?? contact.languageCode,
      lastMessageAt: new Date()
    }
  });

  const reply = await buildTelegramAssistantReply(
    BigInt(telegramUserId),
    text
  );

  await sendTelegramMessage({
    chatId: BigInt(chatId),
    text: reply
  });

  return NextResponse.json({ ok: true });
}
