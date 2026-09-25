# SHARK TEAM Coach Dashboard — MVP

## Scope

The coach dashboard is a protected operational interface over the same PostgreSQL database used by the public site, booking, Payme and CRM.

## Routes

```
/coach-login
/coach
/coach/groups
/coach/sessions/[sessionId]
/coach/trials/[bookingId]
```

All coach pages are marked `noindex, nofollow`.

## Authentication

Each coach has a separate `CoachAccount`.

Passwords are stored as scrypt hashes with a random salt.

Coach session configuration:

```
COACH_SESSION_SECRET=
COACH_COOKIE_SECURE=
```

The session cookie is:

- HttpOnly
- SameSite=Lax
- Secure in production by default
- valid for 12 hours

A coach can only access Sessions where `TrainingSession.coachId` matches the authenticated coach.

## Dashboard

The coach sees:

- today's Sessions;
- upcoming Sessions;
- own groups;
- active enrolled students;
- confirmed trial students;
- attendance;
- trial assessments still pending.

## Attendance

Allowed statuses:

- PRESENT
- ABSENT
- EXCUSED

For a confirmed trial:

- PRESENT -> TrialBooking becomes `ATTENDED`
- ABSENT -> TrialBooking becomes `NO_SHOW`
- EXCUSED keeps the booking lifecycle unchanged

Attendance is unique per:

```
sessionId + childId
```

Repeated updates modify the same Attendance row.

## Trial assessment

Assessment is allowed only after the trial is marked attended.

Six internal criteria are scored from 1 to 5:

1. ability
2. discipline
3. motivation
4. coordination
5. physical preparation
6. psychological readiness

The coach may also save:

- coachComment
- recommendation

Raw scores are internal operational data. A parent-facing summary can be generated later by the admin/AI layer.

## Regular students

`StudentEnrollment` connects a Child to a TrainingGroup.

The Session participant list combines:

- active group enrollments valid for the Session date;
- confirmed/attended/no-show trial bookings for that Session.

## Security

The backend verifies coach ownership for every attendance and assessment mutation.

Changing the URL cannot grant access to another coach's Session or TrialBooking.

## CI

The automated test:

1. creates a test CoachAccount for Dilshod;
2. creates one regular enrolled child;
3. creates one confirmed trial child in another group;
4. verifies unauthenticated coach access is blocked;
5. verifies bad password is rejected;
6. logs in as the coach;
7. opens Dashboard and Groups;
8. opens the coach-owned Session;
9. marks the trial child PRESENT;
10. verifies TrialBooking -> ATTENDED;
11. saves all six assessment scores;
12. verifies the assessment in PostgreSQL.
