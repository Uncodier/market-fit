# Webhook Idempotency

This note summarizes the current Stripe delivery protocol. The canonical
security requirements live in [Stripe webhook security](STRIPE_WEBHOOK_SECURITY.md).

## Delivery state

Stripe events are tracked by `stripe_event_id` in `webhook_events`. The current
database claim functions represent these outcomes:

- `claimed` — this request owns processing with a unique claim token;
- `processed` — the event completed previously and needs no new effects;
- `in_progress` — another non-stale claim currently owns processing.

Failed or stale claims may be reacquired. Completion and failure updates require
the matching event ID and claim token, preventing an older worker from
overwriting a newer claim.

Implementation:

- `app/api/stripe/webhook/webhook-delivery.ts`
- `app/api/stripe/webhook/route.ts`
- `supabase/migrations/20260917210100_stripe_webhook_delivery_claims.sql`

## Business-effect idempotency

An event-level claim prevents concurrent delivery work but cannot make external
or multi-step effects atomic by itself. Each handler must also protect its
business invariants with unique transaction IDs, conditional updates,
database transactions/functions, or durable effect state.

Sale checkout uses dedicated settlement and compensation modules under
`app/api/stripe/webhook/`. Preserve their retry contract when adding inventory,
order, entitlement, payment, or notification effects.

## Required tests

Changes should cover:

- duplicate delivery after completion;
- simultaneous delivery while a claim is active;
- retry after a recorded failure;
- recovery from a stale claim;
- completion or failure with a mismatched claim token;
- failure between individual settlement effects;
- repeated refund or dispute delivery.

Relevant suites are under `__tests__/api/` and `__tests__/commerce/`.

## Operations

Correlate incidents by Stripe event ID. A processing failure should retain
enough sanitized state for a safe retry, without storing secrets or unnecessary
customer payloads. Cleanup must remove only terminal records old enough to no
longer be operationally useful.
