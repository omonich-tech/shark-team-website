# SHARK TEAM — Production Runbook

## Purpose

This document is the release and operations checklist for the SHARK TEAM platform.

The platform currently contains:

- RU/UZ public website;
- dynamic sports branches;
- paid trial booking;
- atomic trial capacity;
- Payme Merchant API;
- CRM / admin;
- coach dashboard;
- attendance and trial assessment;
- Telegram linking, notifications and assistant;
- CMS, FAQ and media;
- maintenance jobs;
- audit history.

## 1. Release gate

Before production deployment run:

```bash
npm install
npm run security:scan
npm audit --omit=dev --audit-level=high
npm run verify:production-env
npm run lint
npm run typecheck
npm run build
```

The production environment validator prints variable names only. It never prints secret values.

Do not deploy if any release-gate command fails.

## 2. Required environment

Core:

```
DATABASE_URL=
DATABASE_POOL_MAX=3
NEXT_PUBLIC_APP_URL=https://sharkteam.uz

ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=

COACH_SESSION_SECRET=
CRON_SECRET=
RATE_LIMIT_SALT=
MAINTENANCE_SESSION_HORIZON_DAYS=84
```

Payments:

```
PAYMENT_MODE=MANUAL_CARD
```

Temporary manual-card mode:

```
MANUAL_PAYMENT_CARD_NUMBER=
MANUAL_PAYMENT_CARD_HOLDER=
TELEGRAM_ADMIN_CHAT_ID=
TELEGRAM_ADMIN_USER_IDS=
```

Payme mode, when activated later:

```
PAYMENT_MODE=PAYME
PAYME_MERCHANT_ID=
PAYME_LOGIN=
PAYME_KEY=
PAYME_CHECKOUT_URL=https://checkout.paycom.uz/
```

Telegram:

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_API_BASE_URL=https://api.telegram.org
TELEGRAM_DRY_RUN=false
TRIAL_REMINDER_MINUTES=180
POST_TRIAL_FEEDBACK_MINUTES=30
```

Media:

```
MEDIA_DRY_RUN=false
```

Vercel Blob must be connected to the project. OIDC-backed Blob authentication is preferred; a read-write token may also be used when explicitly configured.

Optional:

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
PUBLIC_CONTACT_PHONE=

# Qualitative web analytics: public site only
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_POSTHOG_APP_URL=https://us.posthog.com
```

PostHog is optional and is used only for public-site heatmaps and session replay. The core SHARK TEAM analytics, funnel and attribution remain stored in PostgreSQL and do not depend on PostHog.

Replay privacy policy in the client:

- /admin and /coach are never initialized with PostHog;
- all input values are masked;
- manual-card payment details are fully blocked from replay;
- Do Not Track is respected;
- no parent/child identity is sent with PostHog identify;
- custom `shark_funnel` events contain only non-PII funnel step / sport / branch context.

Production must not set:

```
ADMIN_COOKIE_SECURE=false
COACH_COOKIE_SECURE=false
TELEGRAM_DRY_RUN=true
MEDIA_DRY_RUN=true
```

## 3. Database

Production database must be persistent PostgreSQL.

Before every application release:

```bash
npm run db:migrate:deploy
```

Never use `prisma db push` against production.

### Initial production setup

For the first database only:

```bash
npm run db:migrate:deploy
npm run db:seed
npm run maintenance:run
```

After real operational data starts changing, migrations and the admin UI are the normal update mechanisms.

Do not use seed as an everyday content-management mechanism.

## 4. Backups

The PostgreSQL provider must have automated backups enabled before accepting real parent/child/payment data.

Minimum operational requirement:

- daily automated backup;
- point-in-time recovery if the provider supports it;
- documented retention period;
- restore credentials stored outside the repository;
- periodic restore test to a non-production database.

A backup is not considered verified until a restore has been tested.

Do not run destructive database repair commands before confirming that a usable backup exists.

## 5. Payments

### Temporary manual-card activation

Set `PAYMENT_MODE=MANUAL_CARD`, configure the card number only in the production environment, and set `TELEGRAM_ADMIN_CHAT_ID` to the private admin group used for receipt review. `TELEGRAM_ADMIN_USER_IDS` can restrict approval/rejection actions to specific Telegram users.

Flow:

1. parent books a trial;
2. the site displays the configured card and exact trial amount;
3. parent opens the linked Telegram chat and sends a receipt screenshot/photo;
4. the booking moves to PAYMENT_PENDING and the payment to UNDER_REVIEW;
5. the admin group receives the receipt with approve/reject buttons;
6. approval marks the payment PAID and booking CONFIRMED;
7. rejection records the reason and returns the booking to HOLD when the hold window is still valid.

Never commit the card number to GitHub.

### Payme activation

Merchant endpoint:

```
POST https://sharkteam.uz/api/payments/payme/merchant
```

Configure the Payme Business cash desk with the production endpoint and production credentials.

The application treats Payme `PerformTransaction` as the payment source of truth.

Before switching from sandbox:

1. verify amount is sent in tiyin;
2. verify CheckPerformTransaction;
3. verify CreateTransaction idempotency;
4. verify PerformTransaction idempotency;
5. verify CancelTransaction;
6. verify CheckTransaction;
7. verify GetStatement;
8. verify a paid trial becomes CONFIRMED in CRM.

Do not put Payme credentials in GitHub.

## 6. Telegram activation

After production URL and Telegram environment variables are configured:

```bash
npm run telegram:set-webhook
```

Webhook:

```
POST https://sharkteam.uz/api/telegram/webhook
```

The webhook is fail-closed. If `TELEGRAM_WEBHOOK_SECRET` is missing or incorrect, requests are rejected.

Test:

1. create a trial HOLD;
2. open the personal Telegram deep link;
3. confirm TelegramContact is created;
4. ask for price;
5. ask for address;
6. verify answers match PostgreSQL;
7. complete a payment;
8. verify confirmation notification is queued.

## 7. Scheduled jobs

Two protected job endpoints exist.

Notifications:

```
GET|POST /api/jobs/notifications
Authorization: Bearer <CRON_SECRET>
```

Maintenance:

```
GET|POST /api/jobs/maintenance
Authorization: Bearer <CRON_SECRET>
```

Recommended operational cadence:

- notifications: every 10–15 minutes;
- maintenance: once per day.

The exact scheduler can be Vercel, Railway or another trusted scheduler.

Do not expose `CRON_SECRET`.

Maintenance performs:

- expiration of stale HOLD bookings;
- generation of future TrainingSession rows;
- cleanup of old rate-limit buckets;
- cleanup of old expired Telegram link tokens.

Default Session horizon is 84 days.

Manual maintenance:

```bash
npm run maintenance:run
```

## 8. Media

Production upload storage uses Vercel Blob.

Uploads are restricted to:

- JPEG
- PNG
- WebP
- AVIF
- MP4
- WebM

Maximum file size: 20 MB.

The server validates both MIME and file signature.

A filename or browser-provided MIME value alone is not trusted.

Media containing minors is public only when consent status is APPROVED.

## 9. Security controls

Current production controls:

- HTTPS/HSTS response policy;
- Content-Security-Policy;
- frame embedding denied;
- MIME sniffing disabled;
- restrictive Referrer-Policy;
- Permissions-Policy;
- HttpOnly staff session cookies;
- Secure staff cookies in production;
- SameSite cookie policy;
- signed admin sessions;
- signed coach sessions;
- hashed coach passwords;
- Payme Basic Auth checked with constant-time comparison;
- Telegram webhook secret checked with constant-time comparison;
- cron secret checked with constant-time comparison;
- DB-backed rate limits;
- salted HMAC client fingerprint instead of raw IP storage;
- audit log for admin mutations;
- one-time hashed Telegram link tokens;
- child-media consent filtering;
- repository secret scan in CI.

## 10. Rate limits

Current fixed-window limits per client fingerprint:

- admin login: 10 / 10 minutes;
- coach login: 10 / 10 minutes;
- public lead capture: 30 / hour;
- trial booking: 60 / hour;
- Payme checkout initialization: 60 / hour;
- Telegram linking: 30 / hour.

Excess requests receive HTTP 429 and Retry-After.

The fingerprint is a salted HMAC. Raw IP addresses are not stored in RateLimitBucket.

## 11. Health and readiness

Liveness:

```
GET /api/health
```

This checks that the application process responds.

Readiness:

```
GET /api/ready
```

This checks PostgreSQL connectivity.

Use readiness for deployment verification.

## 12. SEO / crawler boundary

Public indexable URLs are included in dynamic sitemap.

Private/service URLs are excluded through page metadata and robots policy:

- /admin
- /admin-login
- /coach
- /coach-login
- /api
- /ru/trial
- /uz/trial

Active branches with active groups are added to sitemap automatically.

## 13. Post-deploy verification

After deployment verify:

```
GET /api/health
GET /api/ready
GET /robots.txt
GET /sitemap.xml
GET /ru
GET /uz
GET /ru/branches
```

Then manually test:

1. admin login;
2. coach login;
3. branch edit;
4. trial booking;
5. Payme sandbox/production test appropriate to the environment;
6. Telegram link;
7. Telegram notification worker;
8. attendance;
9. trial assessment;
10. media upload;
11. if PostHog is configured, verify a public /ru or /uz visit creates a replay and heatmap data while /admin and /coach do not.

## 14. Logs and incidents

Never log:

- passwords;
- Payme secret;
- Telegram bot token;
- OpenAI API key;
- session secrets;
- raw payment credentials.

If a secret may have leaked:

1. rotate the affected provider secret immediately;
2. redeploy;
3. invalidate/reconfigure the integration;
4. review AuditLog and provider logs;
5. never paste the secret into a GitHub issue.

## 15. Rollback

Application rollback:

- roll back to the previous known-good deployment/commit.

Database rollback:

- Prisma production migrations are treated as forward-only;
- do not automatically run ad-hoc down migrations;
- prefer a corrective forward migration;
- use database restore only for a confirmed data-loss/corruption incident.

Before a migration with destructive potential, create/verify a database backup.

## 16. Release completion

A production release is complete only when:

- GitHub CI is green;
- production env check passes;
- migrations are deployed;
- readiness is green;
- public pages open;
- private pages remain protected;
- Payme callback is reachable;
- Telegram webhook is configured;
- notification scheduler is configured;
- maintenance scheduler is configured;
- database backups are enabled;
- media storage works;
- no fake operational data was introduced.


## 17. Dependency override retirement

Prisma 7.10.0 currently requires security overrides for transitive packages listed in SECURITY.md.

On each Prisma upgrade:

1. remove the overrides in a test branch;
2. run `npm install`;
3. run `npm audit --omit=dev --audit-level=high`;
4. keep the overrides removed only if audit and the full CI suite stay green.

This prevents a temporary security workaround from becoming permanent unowned configuration.


## 18. GitHub Actions scheduler

The repository includes provider-independent production scheduling:

- `Production Notifications`: every 15 minutes
- `Production Maintenance`: daily at 22:00 UTC / 03:00 Asia/Tashkent
- `Production Smoke`: manual post-deploy verification

Configure repository secrets:

```
PRODUCTION_APP_URL=https://sharkteam.uz
PRODUCTION_CRON_SECRET=
```

`PRODUCTION_CRON_SECRET` must equal the application's `CRON_SECRET`.

If these secrets are absent, scheduled workflows safely skip without failing the repository.

This can be used instead of provider-specific cron scheduling.

## Railway production database

The production PostgreSQL database is provisioned in Railway.

The public Vercel application must use Railway's public PostgreSQL connection string as its production `DATABASE_URL`. Changes to Vercel environment variables require a new deployment before runtime functions can see them.

## Vercel Blob media storage

Production media uploads use Vercel Blob. Connect a public Blob store to the Vercel project and enable the read-write connection environment variable (or OIDC-supported Blob auth). After creating or changing the Blob connection, create a fresh production deployment so runtime functions receive the new storage credentials.

## Production admin access

Production admin authentication is configured through Vercel environment variables. Secret values are never committed to the repository. Any change to production environment variables requires a fresh Vercel deployment before runtime routes can use them.

## Production coach access

Coach authentication uses a production-only `COACH_SESSION_SECRET` in Vercel. Real coach usernames and password hashes are managed from Admin and stored in PostgreSQL; plaintext coach passwords are never committed or persisted.


### PostHog browser ingestion

Production browser traffic uses the first-party path `/ingest/*` on `sharkteam.uz`.
Next.js rewrites that traffic to the EU PostHog ingestion and asset hosts. This improves
capture reliability when browsers or extensions block known analytics domains.

`NEXT_PUBLIC_POSTHOG_HOST` may remain configured for operational reference, but the
browser SDK intentionally uses the first-party `/ingest` route. `NEXT_PUBLIC_POSTHOG_APP_URL`
continues to point to `https://eu.posthog.com` for PostHog UI links.
