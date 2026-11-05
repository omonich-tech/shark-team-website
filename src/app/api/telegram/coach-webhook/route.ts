import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Dedicated coach bot endpoint.
 * Never uses the parent Telegram token or parent's webhook secret.
 * Coaches must still log in with their own active CRM coach account.
 */
export async function POST(request: NextRequest) {
  const rawSecret = process.env.COACH_TELEGRAM_WEBHOOK_SECRET?.trim();
  const secret = rawSecret ? createHash("sha256").update(rawSecret).digest("hex") : null;
  const token = process.env.COACH_TELEGRAM_BOT_TOKEN;
  if (!secret || !token) {
    return NextResponse.json({ ok: false, error: "COACH_BOT_NOT_CONFIGURED" }, { status: 503 });
  }

  const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!provided || !equal(provided, secret)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let payload: {
    message?: {
      text?: string;
      chat?: { id?: number; type?: string };
      from?: { language_code?: string };
    };
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const chat = payload.message?.chat;
  if (chat?.type !== "private" || !Number.isSafeInteger(chat.id)) {
    return NextResponse.json({ ok: true });
  }

  const locale = payload.message?.from?.language_code?.toLowerCase().startsWith("uz") ? "uz" : "ru";
  const text = payload.message?.text?.trim() ?? "";
  if (!/^\/(?:start|menu|help)(?:@[A-Za-z0-9_]+)?$/.test(text)) {
    return NextResponse.json({ ok: true });
  }

  const url = new URL("/miniapp?role=coach", process.env.NEXT_PUBLIC_APP_URL || "https://sharkteam.uz");
  // Keep production launch tied to our first-party domain.
  if (process.env.NODE_ENV === "production" && url.hostname !== "sharkteam.uz") {
    return NextResponse.json({ ok: false, error: "INVALID_MINIAPP_ORIGIN" }, { status: 503 });
  }

  const message = locale === "uz"
    ? "🏀 <b>SHARK TEAM · Murabbiy</b>\nJadval, sinov mashg‘ulotlari, davomat va baholash uchun kabinetni oching. Kirish uchun murabbiy CRM logini kerak."
    : "🏀 <b>SHARK TEAM · Тренер</b>\nОткройте свой кабинет: расписание, пробные занятия, посещаемость и оценки. Для входа нужен ваш логин тренера CRM.";

  const telegramResponse = await fetch(
    (process.env.TELEGRAM_API_BASE_URL ?? "https://api.telegram.org") + "/bot" + token + "/sendMessage",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat.id,
        text: message,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{
            text: locale === "uz" ? "🏅 Murabbiy kabinetini ochish" : "🏅 Открыть кабинет тренера",
            web_app: { url: url.toString() }
          }]]
        }
      }),
      cache: "no-store"
    }
  );
  if (!telegramResponse.ok) {
    console.error("Coach Telegram bot: sendMessage failed with HTTP", telegramResponse.status);
    return NextResponse.json({ ok: false, error: "TELEGRAM_SEND_FAILED" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
