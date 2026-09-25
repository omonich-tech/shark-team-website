# SHARK TEAM CRM — MVP

## Scope

The first CRM is a protected, owner-only operational view over the same PostgreSQL database used by the public website, booking and Payme.

There is no duplicate CRM database.

## Routes

```
/admin
/admin/leads
/admin/trials
/admin/parents
/admin/children
/admin/payments
```

The login page is:

```
/admin-login
```

All admin pages are marked `noindex, nofollow`.

## Authentication

The MVP uses environment-based owner credentials:

```
ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
```

A successful login creates a signed 12-hour session cookie:

- HttpOnly
- SameSite=Lax
- Secure in production by default

`ADMIN_COOKIE_SECURE=false` exists only for explicit local/CI HTTP testing and must not be used on the live HTTPS deployment.

Passwords and the session secret must never be committed to GitHub.

## Current CRM behavior

### Dashboard

Shows:

- total Leads;
- active HOLD / PAYMENT_PENDING trial bookings;
- future CONFIRMED trials;
- Parents;
- Children;
- number of paid trial payments;
- total PAID amount;
- latest Leads.

### Leads

Shows the acquisition record:

- created time;
- funnel status;
- parent;
- child and age;
- phone;
- matching group;
- selected TrainingSession;
- source / UTM data.

### Trials

Shows:

- TrialBooking status;
- child / parent;
- group;
- actual TrainingSession;
- HOLD expiry;
- associated Payment.

### Parents and Children

Parent/Child records are created only after Payme successfully performs a trial payment.

This deliberately keeps anonymous or abandoned leads separate from confirmed client records.

Parent is deduplicated by normalized phone number.

For the MVP, an existing child under the same Parent is reused when the child name matches.

### Payments

Shows:

- Payment status;
- locked amount;
- child / parent;
- linked trial Session;
- latest Payme state.

## Current limitations

The CRM is read-only in this stage.

Editing, tasks, notes, status controls, manual bookings and role-based permissions are later admin/operations work.

The current authentication layer is owner-only. It can later be replaced by database users and RBAC without changing Lead, TrialBooking, Parent, Child or Payment data models.

## CI security verification

CI checks:

1. unauthenticated `/admin` redirects to login;
2. incorrect password returns HTTP 401;
3. correct credentials create a session cookie;
4. authenticated Dashboard opens;
5. the paid Payme smoke-test client appears in Leads, Parents and Children;
6. refunded payment history appears in Payments;
7. logout invalidates access.
