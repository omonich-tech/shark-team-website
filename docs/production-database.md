# Production PostgreSQL

## Goal

Production and Preview must use persistent PostgreSQL databases. GitHub Actions uses an ephemeral PostgreSQL 17 service only for automated tests.

## Required environment variable

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

Do not commit the production connection string to GitHub.

## Migration policy

Schema changes are committed under:

```
prisma/migrations/
```

Production/staging applies them with:

```bash
npm run db:migrate:deploy
```

Do not use `prisma db push` against production.

## First bootstrap

After a persistent PostgreSQL database is connected:

```bash
npm run db:bootstrap
```

This command performs:

1. `prisma migrate deploy`
2. idempotent SHARK TEAM seed
3. TrainingSession generation for the default 84-day horizon

The first seed currently contains only the confirmed production case:

- Basketball
- School No. 117
- Coach Dilshod
- Groups 6–8, 9–11, 12–15
- Tue / Thu / Sat
- 17:00 / 18:00 / 19:00
- regular capacity 20
- trial price 50,000 UZS
- subscription price 500,000 UZS/month

Trial capacity remains unset, so trial booking stays disabled until that business rule is confirmed.

## Environments

Use separate databases or isolated database branches for:

- Preview / staging
- Production

Development may use a local PostgreSQL instance.

## Deployment rule

Vercel builds the application. Database migrations should be executed as an explicit deployment/bootstrap operation, not as part of every Next.js build.

This avoids accidental concurrent migrations during parallel Vercel builds.
