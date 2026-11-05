import "dotenv/config";

const token = process.env.COACH_TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.COACH_TELEGRAM_WEBHOOK_SECRET?.trim();
const host = (process.env.NEXT_PUBLIC_APP_URL || "https://sharkteam.uz").replace(/\/$/, "");

async function main() {
  if (!token || !secret || !/^https:\/\//.test(host)) {
    throw new Error("Configure COACH_TELEGRAM_BOT_TOKEN, COACH_TELEGRAM_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL first");
  }
  const destination = new URL("/api/telegram/coach-webhook", host).toString();
  const root = (process.env.TELEGRAM_API_BASE_URL ?? "https://api.telegram.org") + "/bot" + token;
  for (const [method, body] of [
    ["setWebhook", { url: destination, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: false }],
    ["setMyCommands", { commands: [{ command: "start", description: "Кабинет тренера" }, { command: "menu", description: "Меню тренера" }] }]
  ] as const) {
    const res = await fetch(root + "/" + method, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
    });
    const result = await res.json() as { ok?: boolean; description?: string };
    if (!res.ok || !result.ok) throw new Error(method + ": " + (result.description || "request failed"));
  }
  console.log("Coach Telegram webhook configured:", destination);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
