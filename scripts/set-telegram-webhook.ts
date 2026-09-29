import "dotenv/config";
import { configureTelegramWebhook } from "../src/server/telegram/configure-webhook";

const result = await configureTelegramWebhook();

if (!result.ok) {
  console.error(result);
  process.exit(1);
}

console.log(result);
