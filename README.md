# SHARK TEAM

Digital platform for SHARK TEAM children's sports sections in Tashkent.

## Current status

Clean MVP rebuild.

The previous prototype is preserved in:

`backup/pre-rebuild-2026-09-25`

## Stack

- Next.js 16
- React 19
- TypeScript
- PostgreSQL
- Prisma ORM 7

## Local development

1. Install Node.js 22.18+.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `DATABASE_URL`.
5. Run `npm run dev`.
6. Open `http://localhost:3000`.

Health endpoint:

`GET /api/health`

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
```

## First production case

Basketball at School No. 117 in Yunusabad, Tashkent.

See `docs/architecture.md` for the baseline architecture.
