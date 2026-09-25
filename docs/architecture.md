# SHARK TEAM — Architecture Baseline

## Goal

Build one platform where the website, admin CRM, coach tools, parent flows, payments and Telegram use the same backend data.

## Stack

- Next.js 16
- React 19
- TypeScript
- PostgreSQL
- Prisma ORM 7
- Node.js 22+

## Source of truth

Business data must not be duplicated in page text or Telegram prompts.

Core flow:

```
PostgreSQL
  ↓
Backend / server layer
  ├─ Public website
  ├─ Admin CRM
  ├─ Coach interface
  ├─ Parent flow
  ├─ Telegram
  └─ Analytics
```

## First vertical slice

Basketball → School No. 117 → Group → Session → Trial booking → Payment → CRM.

## First real data

- Branch: School No. 117
- District: Yunusabad
- Address: Xitoy St. 9, Tashkent 100099
- Landmark: Shahriston metro
- Coach: Dilshod
- Groups:
  - 6–8: Tue/Thu/Sat, 17:00–18:00
  - 9–11: Tue/Thu/Sat, 18:00–19:00
  - 12–15: Tue/Thu/Sat, 19:00–20:00
- Capacity: 20 per group
- Trial: 50,000 UZS
- Subscription: 500,000 UZS/month

## Next implementation step

Define the first database schema and seed the School No. 117 vertical slice.
