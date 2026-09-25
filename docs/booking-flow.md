# Trial Booking Flow

## Current flow

1. Parent opens `/[locale]/trial`.
2. Selects child age.
3. Backend finds the active matching group.
4. Backend returns future TrainingSession records with remaining trial capacity.
5. Parent selects a Session.
6. Parent submits child name, parent name and phone.
7. Backend creates a `Lead` with status `TRIAL_SELECTED`.
8. Client immediately requests a trial reservation.
9. PostgreSQL locks the selected TrainingSession row.
10. Backend counts active capacity-consuming bookings.
11. If capacity is available, a `TrialBooking` with status `HOLD` is created and the Lead moves to `TRIAL_HELD`.

## Capacity safety

Reservation uses a PostgreSQL row lock:

```sql
SELECT "id"
FROM "TrainingSession"
WHERE "id" = ...
FOR UPDATE;
```

All concurrent reservations for the same Session are serialized before capacity is counted.

With a trial capacity of 2, three simultaneous reservation requests must produce:

- 2 successful HOLD bookings;
- 1 `SLOT_FULL` response.

CI verifies this through the real public HTTP API.

## Hold duration

Standard rule:

- reservation HOLD: 2 hours;
- reminder time: 1 hour after HOLD creation.

When the Session starts in less than 3 hours:

- reservation HOLD: 30 minutes;
- no 1-hour reminder is scheduled.

A HOLD is never allowed to extend beyond the Session start time.

## Automatic release

Capacity queries count only:

- `CONFIRMED` bookings;
- `HOLD` bookings where `expiresAt > now`.

Therefore an expired HOLD stops consuming capacity immediately at `expiresAt`, even if no background cleanup job has run yet.

When availability or a new reservation is processed, stale HOLD rows are also changed to `EXPIRED`.

Optional cleanup command:

```bash
npm run db:expire-trial-holds
```

## Idempotency

The same Lead requesting the same Session twice does not create two bookings.

The unique constraint is:

```
leadId + sessionId
```

If the existing HOLD is still active, the same booking is returned.

## Reminder delivery

The booking stores `reminderAt`. Actual Telegram/SMS delivery is not implemented in this stage; it will be connected through the notification layer later.

## Production safety

School No. 117 still has `capacityTrial = null` in the production seed.

Therefore production trial booking remains closed until the real per-Session/group trial capacity is confirmed.

CI temporarily sets trial capacity to 2 inside its disposable PostgreSQL database only.

## Stored booking data

`TrialBooking` contains:

- Lead
- TrainingSession
- status
- expiresAt
- reminderAt
- reminderSentAt
- confirmedAt
- cancelledAt
- createdAt / updatedAt

The next stage connects payment. Successful payment will move the booking from `HOLD` to `CONFIRMED`.
