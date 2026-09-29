import "dotenv/config";

const mode = process.env.PRODUCTION_VERIFY_MODE ?? "strict";
const strict = mode === "strict";

const errors: string[] = [];
const warnings: string[] = [];

function value(name: string) {
  return process.env[name]?.trim() ?? "";
}

function requireValue(name: string) {
  if (!value(name)) {
    errors.push(`${name} is required`);
  }
}

function minLength(name: string, length: number) {
  const current = value(name);

  if (current && current.length < length) {
    errors.push(`${name} must be at least ${length} characters`);
  }
}

[
  "DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "ADMIN_SESSION_SECRET",
  "COACH_SESSION_SECRET",
  "CRON_SECRET",
  "RATE_LIMIT_SALT",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "BLOB_READ_WRITE_TOKEN"
].forEach(requireValue);

const paymentMode = value("PAYMENT_MODE") || "PAYME";

if (paymentMode === "PAYME") {
  [
    "PAYME_MERCHANT_ID",
    "PAYME_LOGIN",
    "PAYME_KEY",
    "PAYME_CHECKOUT_URL"
  ].forEach(requireValue);
} else if (paymentMode === "MANUAL_CARD") {
  [
    "MANUAL_PAYMENT_CARD_NUMBER",
    "TELEGRAM_ADMIN_CHAT_ID"
  ].forEach(requireValue);

  const digits = value("MANUAL_PAYMENT_CARD_NUMBER").replace(/\D+/g, "");
  if (digits && (digits.length < 12 || digits.length > 19)) {
    errors.push(
      "MANUAL_PAYMENT_CARD_NUMBER must contain 12 to 19 digits"
    );
  }
} else {
  errors.push("PAYMENT_MODE must be PAYME or MANUAL_CARD");
}

minLength("ADMIN_PASSWORD", 12);
minLength("ADMIN_SESSION_SECRET", 32);
minLength("COACH_SESSION_SECRET", 32);
minLength("CRON_SECRET", 24);
minLength("RATE_LIMIT_SALT", 32);
minLength("TELEGRAM_WEBHOOK_SECRET", 24);

const poolMax = Number(value("DATABASE_POOL_MAX") || "3");
if (
  !Number.isInteger(poolMax) ||
  poolMax < 1 ||
  poolMax > 20
) {
  errors.push("DATABASE_POOL_MAX must be an integer from 1 to 20");
}

const horizon = Number(
  value("MAINTENANCE_SESSION_HORIZON_DAYS") || "84"
);
if (
  !Number.isInteger(horizon) ||
  horizon < 14 ||
  horizon > 365
) {
  errors.push(
    "MAINTENANCE_SESSION_HORIZON_DAYS must be an integer from 14 to 365"
  );
}

const appUrl = value("NEXT_PUBLIC_APP_URL");
if (appUrl) {
  try {
    const parsed = new URL(appUrl);

    if (strict && parsed.protocol !== "https:") {
      errors.push("NEXT_PUBLIC_APP_URL must use HTTPS in production");
    }
  } catch {
    errors.push("NEXT_PUBLIC_APP_URL must be a valid absolute URL");
  }
}

const paymeCheckout = value("PAYME_CHECKOUT_URL");
if (
  strict &&
  paymeCheckout &&
  paymeCheckout !== "https://checkout.paycom.uz/"
) {
  errors.push(
    "PAYME_CHECKOUT_URL must use the production Payme checkout URL"
  );
}

if (strict && value("TELEGRAM_DRY_RUN") === "true") {
  errors.push("TELEGRAM_DRY_RUN must be false in production");
}

if (strict && value("MEDIA_DRY_RUN") === "true") {
  errors.push("MEDIA_DRY_RUN must be false in production");
}

if (strict && value("ADMIN_COOKIE_SECURE") === "false") {
  errors.push("ADMIN_COOKIE_SECURE must not be false in production");
}

if (strict && value("COACH_COOKIE_SECURE") === "false") {
  errors.push("COACH_COOKIE_SECURE must not be false in production");
}

if (!value("TELEGRAM_BOT_USERNAME")) {
  warnings.push(
    "TELEGRAM_BOT_USERNAME is not set; the app will resolve the bot username from Telegram getMe"
  );
}

if (!value("OPENAI_API_KEY")) {
  warnings.push(
    "OPENAI_API_KEY is not set; deterministic Telegram answers still work, but free-text AI fallback is disabled"
  );
}

if (!value("PUBLIC_CONTACT_PHONE")) {
  warnings.push(
    "PUBLIC_CONTACT_PHONE is not set; verify that booking/Telegram remains the intended public contact path"
  );
}

if (errors.length > 0) {
  console.error("Production environment check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }

  if (warnings.length > 0) {
    console.error("Warnings:");
    for (const warning of warnings) {
      console.error(`- ${warning}`);
    }
  }

  process.exit(1);
}

console.log(
  `Production environment check passed in ${strict ? "strict" : mode} mode.`
);

for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}
