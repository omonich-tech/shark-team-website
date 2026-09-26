import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !appUrl || !secret) {
  throw new Error(
    "TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_APP_URL and TELEGRAM_WEBHOOK_SECRET are required"
  );
}

const apiBase =
  process.env.TELEGRAM_API_BASE_URL ?? "https://api.telegram.org";

const response = await fetch(
  `${apiBase}/bot${token}/setWebhook`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: `${appUrl}/api/telegram/webhook`,
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: false
    })
  }
);

const payload = await response.json();

if (!response.ok) {
  console.error(payload);
  process.exit(1);
}

console.log(payload);
