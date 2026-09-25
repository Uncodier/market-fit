# Stripe Webhook Security

The canonical endpoint is `POST /api/stripe/webhook`, implemented in
`app/api/stripe/webhook/route.ts`.

## Security invariants

### Signature verification

- Read the request as raw text.
- Require the `stripe-signature` header.
- Call `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET` before
  parsing or trusting event data.
- Return `400` for missing or invalid signatures.

Never place JSON parsing middleware in front of this route.

### Re-fetch authoritative Stripe objects

The event payload is a notification, not final proof of payment. Current
checkout handling re-fetches the Checkout Session and requires
`payment_status === "paid"`. Invoice handling re-fetches the invoice and
requires a paid state.

Preserve those checks when extracting handlers or upgrading Stripe.

### Durable idempotency

`app/api/stripe/webhook/webhook-delivery.ts` claims an event through database
functions before executing handlers. The claim protocol:

- identifies deliveries by Stripe event ID;
- returns success for an already processed event;
- rejects a concurrently active claim;
- allows a stale or failed claim to be retried;
- requires the matching claim token to complete or fail processing.

The supporting SQL is versioned in `supabase/migrations/`, including
`20260917210100_stripe_webhook_delivery_claims.sql` and its status-constraint
correction, `20260925000000_fix_webhook_events_status_constraint.sql`.
Application deployment must not precede required migrations.

### Retry-safe settlement

A claimed event can still fail between side effects. Sale settlement therefore
tracks durable effect state and compensation in:

- `app/api/stripe/webhook/sale-checkout-settlement.ts`
- `app/api/stripe/webhook/sale-settlement-effects.ts`
- `app/api/stripe/webhook/sale-settlement-compensation.ts`

Do not add a side effect without defining how duplicate delivery, timeout,
partial failure, and retry behave.

### Event age

The route currently accepts ordinary supported events up to three days old and
refund/dispute events up to 90 days old. Age is checked after claiming so a
rejected event can release its claim safely.

These windows are application policy, not Stripe signature verification.
Changing them requires tests and an operational review of retry behavior.

## Expected Stripe events

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `charge.refunded`
- `charge.dispute.created`
- `payment_intent.payment_failed`

Keep the provider endpoint subscription synchronized with the handlers.

## Local verification

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Set the CLI-provided signing secret in local `.env.local`, then test valid,
invalid-signature, duplicate, concurrent, stale, retry, refund, and partial
failure cases.

Focused Jest coverage exists under `__tests__/api/` and
`__tests__/commerce/`, including webhook delivery and settlement tests.

## Operational response

- A `400` indicates an invalid request or event outside the accepted age policy.
- A `409` indicates another delivery currently owns the event claim; Stripe may
  retry.
- A `500` indicates claim or processing failure and should remain retryable.
- Use the Stripe event ID to correlate provider delivery logs with sanitized
  application logs and the `webhook_events` row.

Do not log the signing secret, authorization headers, full customer payloads, or
payment details.
