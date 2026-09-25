# TrainingSession Generation

## Purpose

`GroupScheduleRule` describes the recurring weekly schedule. `TrainingSession` is the dated training event used later by booking, attendance and notifications.

## Rules

- Sessions are generated from active groups and active schedule rules.
- Branch timezone is used to convert local training times to UTC.
- Default branch timezone is `Asia/Tashkent`.
- Generated sessions keep `scheduleRuleId` and `sourceDate`.
- Re-running the generator is idempotent.
- Existing generated sessions are never overwritten by the generator.
- Manual session edits therefore remain intact.
- Trial capacity is nullable.
- Until trial capacity is configured for a group, generated sessions have:
  - `trialCapacity = null`
  - `trialBookingEnabled = false`

## Default generation horizon

The command generates from today's Tashkent calendar date through 84 days ahead.

```bash
npm run db:sessions
```

Optional environment variables:

```
SESSION_FROM=2026-09-29
SESSION_TO=2026-10-12
SESSION_BRANCH_ID=BR-SCHOOL-117-01
```

## School No. 117 time conversion

Tashkent is UTC+5.

- 17:00 local → 12:00 UTC
- 18:00 local → 13:00 UTC
- 19:00 local → 14:00 UTC

The CI workflow verifies this conversion and generator idempotency.
