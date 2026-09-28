# SHARK TEAM — Go-live Checklist

This is the final production activation checklist after application development.

Code-level MVP development is complete only when the current `main` CI is green. External provider setup remains an infrastructure task and must use real provider credentials.

## A. Already implemented in code

- RU/UZ public site
- Dynamic Sports / Branches / Coaches / Groups
- PostgreSQL source of truth
- TrainingSession generation
- Paid trial flow
- Atomic capacity / HOLD logic
- Payme Merchant API
- Parent / Child CRM
- Owner admin / CMS
- Coach dashboard
- Attendance
- Trial assessment
- Telegram deep linking
- Notification queue
- Telegram assistant
- CMS / FAQ / Media
- consent filtering for minors
- audit log
- DB-backed rate limiting
- security headers / CSP / HSTS
- robots / sitemap
- health / readiness
- maintenance worker
- secret scanning
- production dependency audit
- production env contract
- production smoke tests
- GitHub Actions production schedulers

## B. Production infrastructure that must exist

### 1. Production domain

Set the final public HTTPS URL.

Required variable:

```
NEXT_PUBLIC_APP_URL=https://<final-domain>
```

The final URL is used by:

- canonical public links
- robots.txt
- sitemap.xml
- Payme callback configuration
- Telegram webhook setup
- production smoke checks

Do not use a preview deployment URL as the permanent production URL.

### 2. PostgreSQL

Provision persistent production PostgreSQL.

Set:

```
DATABASE_URL=
DATABASE_POOL_MAX=3
```

Before first launch:

```bash
npm run db:migrate:deploy
npm run db:seed
npm run maintenance:run
```

After real data exists, do not routinely re-run seed.

Required operational controls:

- automated daily backups
- documented retention
- point-in-time recovery when available
- at least one tested restore to a non-production database

### 3. Owner access

Generate real values:

```
ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
```

Rules:

- ADMIN_PASSWORD >= 12 characters
- ADMIN_SESSION_SECRET >= 32 random characters
- production cookies remain Secure
- do not reuse personal passwords

### 4. Coach sessions

Generate:

```
COACH_SESSION_SECRET=
```

Minimum: 32 random characters.

Coach login credentials themselves are stored as salted password hashes in PostgreSQL.

### 5. Rate-limit identity salt

Generate:

```
RATE_LIMIT_SALT=
```

Minimum: 32 random characters.

This is used for salted HMAC client fingerprints. Raw IP addresses are not persisted by the rate limiter.

### 6. Cron authorization

Generate:

```
CRON_SECRET=
```

Minimum: 24 random characters.

The same production value is used by the protected notification and maintenance endpoints.

For GitHub Actions scheduler also create repository secrets:

```
PRODUCTION_APP_URL
PRODUCTION_CRON_SECRET
```

Where:

- PRODUCTION_APP_URL = same final public app URL
- PRODUCTION_CRON_SECRET = same value as application CRON_SECRET

Once these repository secrets exist:

- `Production Notifications` runs every 15 minutes
- `Production Maintenance` runs every day at 03:00 Asia/Tashkent
- `Production Smoke` can be run manually after deployment

This scheduler is independent of Vercel Cron plan limits.

### 7. Payme Business

Configure production cash desk and obtain:

```
PAYME_MERCHANT_ID=
PAYME_LOGIN=
PAYME_KEY=
PAYME_CHECKOUT_URL=https://checkout.paycom.uz/
```

Merchant endpoint:

```
POST https://<final-domain>/api/payments/payme/merchant
```

Before accepting public payments, verify on the provider side:

- merchant endpoint is reachable
- CheckPerformTransaction
- CreateTransaction
- repeated CreateTransaction
- PerformTransaction
- repeated PerformTransaction
- CancelTransaction
- CheckTransaction
- GetStatement

A real Payment is considered authoritative only after Payme PerformTransaction.

### 8. Telegram

Use the existing SHARK TEAM bot or production bot.

Set:

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_API_BASE_URL=https://api.telegram.org
TELEGRAM_DRY_RUN=false
```

TELEGRAM_WEBHOOK_SECRET must be at least 24 random characters.

After deployment:

```bash
npm run telegram:set-webhook
```

Then test:

- website generates personal deep link
- /start token connects TelegramContact
- price answer matches DB
- address answer matches DB
- paid trial queues confirmation
- scheduled worker delivers notification

### 9. Media storage

Production uses Vercel Blob.

Set:

```
BLOB_READ_WRITE_TOKEN=
MEDIA_DRY_RUN=false
```

Then verify a real upload from Admin → Media.

Do not upload photos/videos containing children until the consent state is correctly recorded.

### 10. Optional AI fallback

Deterministic Telegram answers do not require an AI key.

For free-text AI fallback set:

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
```

If no key is set, price, branch, schedule and booking-status answers continue to work from PostgreSQL.

## C. Production environment validation

Before deployment, run with real production variables:

```bash
npm run verify:production-env
```

Strict validation rejects:

- missing required variables
- insecure public URL
- sandbox/non-production Payme checkout
- dry-run Telegram
- dry-run Media
- insecure staff cookies
- weak required secrets

## D. Database release

Run:

```bash
npm run db:migrate:deploy
```

Never use `prisma db push` in production.

Then check:

```
GET /api/ready
```

Expected HTTP 200.

## E. First post-deploy test

Run the GitHub Action:

```
Production Smoke
```

It verifies:

- /api/health
- /api/ready
- /robots.txt
- /sitemap.xml
- /ru
- /uz
- /ru/branches
- /admin remains protected
- /coach remains protected

Then manually verify state-changing flows:

1. Admin login
2. Coach login
3. Branch edit
4. Trial selection
5. HOLD
6. Payme payment
7. Telegram link
8. Telegram notification
9. Attendance
10. Trial assessment
11. Media upload

## F. Real launch data

Before advertising traffic, confirm in Admin:

### School 117

- exact address
- entrance information when known
- public phone / intended public contact
- coach information that is actually known
- age groups
- schedule
- active prices
- trial capacity

Trial capacity must be explicitly configured before public booking opens.

Do not invent missing entrance, parking, changing-room, coach surname, phone, credentials or media.

### Media

Upload real materials when available:

- branch / facade
- entrance
- sports hall
- training
- coach portrait
- permitted action media

Empty media blocks are preferable to fake media.

## G. Go-live decision gate

Public acquisition should start only when all of the following are true:

- production CI/release gate is green
- domain is HTTPS
- database is persistent and backed up
- migrations are current
- /api/ready returns 200
- Admin login works
- Coach login works
- trial capacity is configured
- Payme production test succeeds
- Telegram webhook works
- notification scheduler works
- maintenance scheduler works
- Blob media upload works
- School 117 data has been reviewed
- no fake operational data has been added

At that point the technical MVP is production-ready for real leads.
