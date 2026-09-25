# SHARK TEAM Telegram — MVP

## Goals

Telegram is the service communication channel for parents after a trial booking starts.

It is not a separate source of truth. Prices, branch data, schedule, booking and payment status are always read from PostgreSQL.

## Parent linking flow

1. Parent creates a trial HOLD on the website.
2. Website requests a one-time Telegram link.
3. Backend creates a random token and stores only its SHA-256 hash.
4. The public link is:
   `https://t.me/<bot>?start=link_<token>`
5. Parent opens the bot.
6. Telegram sends `/start link_<token>` to the webhook.
7. Backend consumes the token once and creates/updates `TelegramContact`.
8. The contact is linked to the Lead and later to Parent after successful payment.

Link token TTL: 24 hours.

## Webhook

```
POST /api/telegram/webhook
```

When `TELEGRAM_WEBHOOK_SECRET` is configured, the endpoint requires:

```
X-Telegram-Bot-Api-Secret-Token
```

Only private-chat text messages are processed in the MVP.

## Setup

Environment:

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
```

Then:

```bash
npm run telegram:set-webhook
```

## Notifications

Notification records are persisted in PostgreSQL and processed independently from booking/payment requests.

Types:

- PAYMENT_HOLD_REMINDER
- TRIAL_CONFIRMED
- TRIAL_REMINDER
- POST_TRIAL_FEEDBACK

### Payment HOLD reminder

The existing booking rule is preserved:

- standard HOLD: 2 hours;
- reminder scheduled after 1 hour;
- short HOLD (<3 hours before Session): 30 minutes, no 1-hour reminder.

### Trial reminder

Default:

```
TRIAL_REMINDER_MINUTES=180
```

This is configuration, not a schema rule.

### Post-trial feedback

Default:

```
POST_TRIAL_FEEDBACK_MINUTES=30
```

The message asks the parent how the trial went. This is the first automated post-trial contact; the substantive recommendation still belongs to the admin after discussion with the coach.

## Worker

Protected endpoint:

```
POST /api/jobs/notifications
Authorization: Bearer <CRON_SECRET>
```

Manual command:

```bash
npm run notifications:run
```

A scheduler should call the endpoint regularly. Hourly is sufficient for the first MVP, but a shorter interval can be configured by the deployment platform if supported.

Delivery is retried up to 5 attempts.

If no linked Telegram contact exists, the Notification remains pending for retries and is eventually SKIPPED.

## Assistant

The bot answers these standard intents directly from live backend data:

- price;
- address;
- schedule;
- current trial / booking / payment status.

No model is required for these responses.

For free-text questions, OpenAI Responses API can be enabled with:

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
```

The model receives a compact live context built from PostgreSQL.

Rules:

- reply in RU or UZ;
- never invent a price, schedule, branch or booking fact;
- complaints, refunds, discounts and legal issues require an administrator;
- no medical diagnosis or health clearance.

If `OPENAI_API_KEY` is absent or the API fails, the bot falls back to deterministic help text.

## Data model

### TelegramContact

Stores:

- Telegram user id
- private chat id
- username / first name
- locale
- linked Lead
- linked Parent when available
- verified and last-message timestamps

### TelegramLinkToken

Stores only:

- SHA-256 token hash
- Lead
- expiry
- usedAt

Raw tokens are never persisted.

### Notification

Stores:

- channel
- type
- status
- Lead / Parent / TrialBooking
- scheduledAt
- sentAt
- attempts
- external Telegram message id
- lastError
- unique dedupeKey

## CI

CI runs with `TELEGRAM_DRY_RUN=true`.

The automated flow verifies:

1. deep-link creation;
2. invalid webhook secret -> 401;
3. one-time token consumption;
4. TelegramContact creation;
5. live price answer;
6. live address answer;
7. protected notification worker;
8. due notification -> SENT;
9. normal incoming assistant message updates contact activity.

No real Telegram message is sent from CI.
