# Core Database v1

## Purpose

The database is the source of truth for public pages, booking, CRM, coach tools and Telegram.

## Core entities

- Sport
- Branch
- BranchSport
- Coach
- CoachSport
- CoachBranch
- TrainingGroup
- GroupScheduleRule
- TrainingSession
- Price

## Stable IDs for the first production case

- Sport: `SP-BASKETBALL-01`
- Branch: `BR-SCHOOL-117-01`
- Coach: `CO-0001`
- Group 6–8: `GR-BASK-S117-0608-01`
- Group 9–11: `GR-BASK-S117-0911-01`
- Group 12–15: `GR-BASK-S117-1215-01`

## School No. 117 seed

Basketball only.

Groups:

| Age | Days | Time | Regular capacity |
| --- | --- | --- | ---: |
| 6–8 | Tue / Thu / Sat | 17:00–18:00 | 20 |
| 9–11 | Tue / Thu / Sat | 18:00–19:00 | 20 |
| 12–15 | Tue / Thu / Sat | 19:00–20:00 | 20 |

Trial capacity is intentionally left unset until it is confirmed operationally.

Prices:

- Trial: 50,000 UZS
- Monthly subscription: 500,000 UZS

## Development setup

After configuring `DATABASE_URL`:

```bash
npm run db:generate
npm run db:migrate -- --name core_v1
npm run db:seed
```

## Public data check

After the database is migrated and seeded:

```
GET /api/public/branches/school-117
```

The endpoint must return the branch, basketball, Dilshod, all three groups, their schedule rules and active prices.
