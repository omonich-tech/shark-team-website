import { createHash } from "node:crypto";
// Register only the dedicated coach bot during production builds.
// The bot token and webhook secret never appear in logs or source control.
const token = process.env.COACH_TELEGRAM_BOT_TOKEN?.trim();
const rawSecret = process.env.COACH_TELEGRAM_WEBHOOK_SECRET?.trim();
const secret = rawSecret ? createHash("sha256").update(rawSecret).digest("hex") : null;
const app = "https://sharkteam.uz";

if (!token && !secret) {
  console.log("Coach bot not configured: skipping webhook registration.");
} else {
  if (!token || !secret) {
    throw new Error("Coach Telegram bot: token or valid secret is missing.");
  }
  const api = (process.env.TELEGRAM_API_BASE_URL || "https://api.telegram.org").replace(/\/$/, "") + "/bot" + token;
  async function telegram(method, payload) {
    const response = await fetch(api + "/" + method, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload), cache: "no-store"
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true) {
      throw new Error("Coach Telegram bot: " + method + " failed (HTTP " + response.status + ").");
    }
    return data.result;
  }

  const bot = await telegram("getMe", {});
  if (bot.username?.toLowerCase() !== "sharkteam_coach_bot") {
    throw new Error("Coach Telegram bot: token belongs to unexpected bot; refusing webhook setup.");
  }
  const webhookUrl = app + "/api/telegram/coach-webhook";
  await telegram("setWebhook", {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: false
  });
  await telegram("setMyCommands", {
    commands: [
      { command: "start", description: "Открыть кабинет тренера" },
      { command: "menu", description: "Меню тренера" }
    ]
  });
  const info = await telegram("getWebhookInfo", {});
  if (info.url !== webhookUrl) throw new Error("Coach Telegram bot: webhook URL verification failed.");
  console.log("Coach Telegram bot webhook registered and verified:", webhookUrl);
}
