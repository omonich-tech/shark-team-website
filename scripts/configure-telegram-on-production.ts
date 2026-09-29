import "dotenv/config";
import { configureTelegramWebhook } from "../src/server/telegram/configure-webhook";

if (process.env.VERCEL_ENV !== "production") {
  console.log("Telegram webhook setup skipped outside Vercel production.");
  process.exit(0);
}

const result = await configureTelegramWebhook();

if (!result.ok) {
  console.error("Telegram webhook production setup failed:", result.error);
  process.exit(1);
}

console.log(
  `Telegram webhook configured for production: ${result.webhookUrl}; updates=${result.allowedUpdates.join(",")}`
);
