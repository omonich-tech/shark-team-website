import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ ok: false });
  const update = await req.json();
  const message = update.message;
  if (!message?.chat?.id) return NextResponse.json({ ok: true });
  const chatId = message.chat.id;
  const text = String(message.text || "");
  if (text.startsWith("/start")) {
    await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "SHARK TEAM 🦈\n\nВыберите язык / Tilni tanlang",
        reply_markup: { inline_keyboard: [[
          { text: "Русский", callback_data: "lang_ru" },
          { text: "O‘zbekcha", callback_data: "lang_uz" }
        ]] }
      })
    });
  }
  return NextResponse.json({ ok: true });
}