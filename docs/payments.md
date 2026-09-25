# Payments — Payme Business

## Provider

The first SHARK TEAM payment provider is Payme Business.

The public flow uses the standard Payme checkout form. The merchant backend exposes the Payme Merchant API over JSON-RPC.

## Environment variables

```
PAYME_MERCHANT_ID=
PAYME_LOGIN=
PAYME_KEY=
PAYME_CHECKOUT_URL=https://checkout.paycom.uz/
```

For sandbox checkout use:

```
PAYME_CHECKOUT_URL=https://test.paycom.uz
```

Secrets must never be committed to GitHub.

## Trial payment flow

1. TrialBooking is in `HOLD`.
2. Client calls `POST /api/public/payments/payme/init`.
3. Backend resolves the current active TRIAL Price.
4. Backend creates one immutable Payment order for the booking.
5. UZS amount is converted to tiyin: `amountTiyin = amountUzs * 100`.
6. Client submits the Payme checkout form.
7. Payme calls our Merchant API.
8. `CreateTransaction` moves the booking to `PAYMENT_PENDING`.
9. `PAYMENT_PENDING` continues consuming trial capacity.
10. `PerformTransaction` marks:
    - Payment = `PAID`
    - TrialBooking = `CONFIRMED`
    - Lead = `TRIAL_CONFIRMED`
11. A paid transaction cancelled by Payme becomes:
    - Payment = `REFUNDED`
    - TrialBooking = `CANCELLED`
    - Lead = `CLOSED`

## Merchant API endpoint

```
POST /api/payments/payme/merchant
```

Implemented methods:

- CheckPerformTransaction
- CreateTransaction
- PerformTransaction
- CancelTransaction
- CheckTransaction
- GetStatement

All Payme RPC responses use HTTP 200, including RPC errors.

## Authentication

Merchant API verifies HTTP Basic authentication using:

```
Basic base64(PAYME_LOGIN:PAYME_KEY)
```

Invalid credentials return Payme error `-32504`.

## Persistence

`Payment` represents the SHARK TEAM order.

`PaymeTransaction` represents one Payme transaction attempt.

They are deliberately separate because a payment order may have more than one provider transaction attempt over its lifecycle, and Payme requires transaction methods to be idempotent.

## State mapping

Payme provider states:

- `1` — created, waiting for confirmation
- `2` — successfully performed
- `-1` — cancelled before completion
- `-2` — cancelled after completion

SHARK TEAM keeps the provider state in `PaymeTransaction.state`.

## Idempotency

Repeated Payme calls with the same provider transaction ID return the same merchant transaction and timestamps.

A second active provider transaction for the same Payment is rejected with `-31008`.

## Price locking

The active trial Price is copied into Payment when payment initialization occurs.

Fields:

- amountUzs
- amountTiyin
- currency

Changing Price later does not change an already-created Payment.

## Return page

Payme returns the parent to:

```
/[locale]/trial/payment-return?order=<payment-id>
```

The page reads Payment status from PostgreSQL and displays confirmation when it is `PAID`.

## Production activation checklist

Before live payments:

1. Create/configure the Payme Business web cash desk.
2. Obtain merchant/cash-desk ID.
3. Obtain Merchant API login.
4. Obtain production key/password.
5. Configure the Merchant API URL in Payme Business.
6. Put credentials into production environment variables.
7. Run Payme sandbox tests.
8. Only after sandbox passes, switch checkout to production.

## CI

CI uses dummy Payme credentials and the sandbox URL.

The automated HTTP test verifies:

- invalid Basic auth -> `-32504`
- invalid amount -> `-31001`
- invalid order -> `-31050`
- CheckPerformTransaction
- CreateTransaction
- duplicate CreateTransaction
- rejection of a second active transaction
- PerformTransaction
- duplicate PerformTransaction
- CheckTransaction
- GetStatement
- paid Payment / confirmed TrialBooking
- CancelTransaction after payment
- duplicate CancelTransaction
- refunded Payment / cancelled TrialBooking
