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
An exception exists for completely discounted credit packages: the retrieved
Checkout must be complete, payment-mode, USD, have the exact configured package
subtotal fully discounted to zero, no tax/shipping, and no PaymentIntent. A
`no_payment_required` state by itself never grants credits or settles a sale.

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

### USD sale wallet amounts

`billing.account_balance` is a USD balance, not a multi-currency ledger.
`sale-wallet-amount.ts` resolves gross USD revenue from the retrieved Checkout
integration amount, legacy Adaptive Pricing USD source amount, or a matching
captured charge's USD balance transaction. Modern `presentment_details` never
replaces the integration amount; Stripe fees (`net`) are not gross revenue.
Unexpanded references are retrieved explicitly. Missing conversion information
or non-USD settlement fails without crediting the wallet and remains retryable.
There is no guessed exchange rate or local-currency fallback.

Deploy `20261014220000_stripe_sale_wallet_usd_guard.sql` before the application
change. The RPC independently rejects non-USD, non-finite and sub-cent amounts.
The forward guard does not rewrite completed historical transactions. Use the
scoped preview/repair procedure in [sale currency recovery](STRIPE_SALE_CURRENCY_RECOVERY.md)
for existing overcredits; never reset the full balance or replay fulfillment.

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
- `refund.created`
- `refund.updated`
- `refund.failed`
- `charge.dispute.created`
- `payment_intent.payment_failed`

Keep the provider endpoint subscription synchronized with the handlers.
The deprecated `charge.refund.updated` is supported for compatibility. Refund
status notifications use the refund/dispute age window and re-fetch current
provider state before accounting, rather than trusting stale event status.

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
