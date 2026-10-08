# Stripe Setup

This application uses Stripe for subscriptions, credit purchases, commerce
orders, sale settlement, refunds, and disputes.

## Environment

Configure matching test or live values:

```dotenv
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_PRICE_ID=
STRIPE_STARTUP_PRICE_ID=
STRIPE_ENTERPRISE_PRICE_ID=
STRIPE_ACCOUNT_ADDON_PRICE_ID=
STRIPE_STARTER_ANNUAL_PRICE_ID=
STRIPE_STARTUP_ANNUAL_PRICE_ID=
STRIPE_ENTERPRISE_ANNUAL_PRICE_ID=
STRIPE_ACCOUNT_ADDON_ANNUAL_PRICE_ID=
CHECKOUT_RETURN_ORIGINS=
```

Do not mix test and live keys, prices, customers, or webhook secrets.

## Checkout routes

The implemented Stripe routes are:

- `POST /api/stripe/checkout/credits`
- `POST /api/stripe/checkout/subscription`
- `POST /api/stripe/checkout/order`
- `POST /api/stripe/checkout/sale`
- `POST /api/stripe/webhook`
- payment-method, customer-portal, and invoice URL routes under
  `app/api/stripe/`

Checkout routes must authenticate or validate their public checkout context,
load trusted prices and ownership from server-side records, and restrict return
URLs. Do not accept a browser-supplied amount as authoritative.

### Platform subscription contract

`POST /api/stripe/checkout/subscription` accepts `siteId` (UUID), `plan`
(`engine`, `foundry`, `enterprise`), optional `addonsCount` (integer 0–100),
`successUrl`, `cancelUrl`, and optional `billingInterval` (`month` or `year`).
Omitting the interval preserves monthly callers. Manager authorization,
rate-limiting, and exact trusted-origin URL checks run on the server. Prices and
payment state never come from the request. Active, USD, licensed, per-unit Stripe
prices must have interval count one and the configured amounts:

| Plan | Monthly | Annual (10% discount) |
| --- | ---: | ---: |
| Engine | $23 | $248.40 |
| Foundry | $99 | $1069.20 |
| Enterprise | $500 | $5400 |
| Connected-account addon (each) | $10 | $108 |

All selected prices must be configured; annual never falls back to monthly.
Subscription checkout enables `allow_promotion_codes: true`. Both checkout and
subscription metadata include `billing_interval`; the interval is also included
in Stripe request idempotency. Responses retain `{ url, sessionId }`.

### Existing subscriptions and hosted confirmation

The server verifies the customer/site binding and lists live subscriptions before
creating checkout. Existing active single-base subscriptions with no addons,
pending update, schedule, or cancellation use the hosted
`subscription_update_confirm` flow for an interval change. The same response URL
contract is returned, optionally with `flow: subscription_update_confirm`.
The server does not directly update subscription items or optimistically change
paid plan/addons/interval. Entitlements change only in paid-invoice settlement.

The live default portal configuration must enable price updates, list the target
product/price, use `always_invoice`, and have no scheduled downgrade conditions.
Configuration is read, never created or changed by this endpoint. Stripe's SDK
supports only one item for this flow: multi-item subscriptions, addon changes,
same-interval tier changes, and unsafe/unavailable portal configuration return an
explicit `409` requiring billing support, not a second subscription checkout.
Existing subscription, item, or customer discounts also require support review.
The installed hosted-confirmation API can apply only a coupon/promotion code, not
retain an existing discount ID; replaying a coupon may reset its duration. The
endpoint neither omits an existing discount silently nor reapplies it with new terms.
Partial proration invoices require deliberate recovery rather than guessed paid
coverage. Stripe confirmation handles payment failures and authentication; a
return redirect is not payment proof.

A service-only five-minute site lease serializes customer/session creation across
concurrent requests. SDK calls have a 20-second timeout and no automatic network
retry. Exact owned pending checkouts are retrieved again and reused. A differing
owned open selection is expired under that same lease, and expiration is confirmed
before rechecking both Checkout and subscriptions and creating its replacement.
Returning via `cancelUrl` does not expire Stripe Checkout; choosing another interval
does not require waiting for its default 24-hour expiration. Multiple/foreign open
sessions, paginated history, completed/racing sessions, or uncertain expiration
block creation. Completed history is accepted only when its referenced subscription
is verified ended. Expired session IDs form an idempotency generation so choosing
A, then B, then A cannot return the now-expired first A.
An ambiguous provider-write failure retains the lease until expiry and returns
`503` with `Retry-After: 300`. After expiry, re-list live subscription/session state
before retrying; do not manually clear leases or create duplicate subscriptions.
Customer-only persistence uses authorized service access; tenant reads stay RLS-scoped.

### Other legacy routes

The credits, generic portal, and payment-method routes predate the
hardened order/sale checkout flow. They currently accept some client-provided
site, identity, amount, or return URL fields and do not consistently use
`requireSiteAccess()` or the checkout URL allowlist:

- `app/api/stripe/checkout/credits/route.ts`
- `app/api/stripe/portal/route.ts`
- `app/api/stripe/payment-method/route.ts`

Treat these as security debt, not examples for new routes. Any change should
first add focused authorization and input-validation tests, then migrate the
route to trusted server-owned values and exact-origin return URLs.

## Webhook endpoint

Create a Stripe webhook endpoint for:

```text
https://<application-origin>/api/stripe/webhook
```

Subscribe it to the event types handled by
`app/api/stripe/webhook/billing-event-handlers.ts` and
`app/api/stripe/webhook/checkout-session-handler.ts`:

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

If handlers change, update the Stripe endpoint configuration and this list in
the same release.

`charge.refund.updated` is also accepted for older webhook configurations; new
configurations should use `refund.updated`. Pending refunds are not posted until
a provider status update confirms success.

Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`. Test and
production endpoints have different signing secrets.

## Local webhook testing

Install and authenticate the Stripe CLI, then forward events:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the temporary `whsec_...` printed by the CLI in local `.env.local`. Restart
the development server after changing environment variables.

## Database prerequisites

Stripe handling depends on database functions, uniqueness constraints, delivery
claims, and settlement-effect state created by timestamped migrations in
`supabase/migrations/`. Confirm the target environment has the required
migrations before deploying dependent application code.

Do not apply migrations from this guide. Follow
[Database migrations](DATABASE_MIGRATIONS.md).

## Verification

Use Stripe test mode and verify:

1. Checkout rejects an unauthenticated or unauthorized site operation.
2. Client-provided prices, identity, and untrusted return URLs are rejected.
3. A paid checkout settles exactly once.
4. Duplicate and concurrent webhook deliveries do not duplicate effects.
5. Failed processing can be retried safely.
6. Full refunds and disputes reverse the intended sale effects once.
7. Logs contain event IDs but no secrets or unnecessary customer payloads.

Relevant regression tests are located under `__tests__/api/` and
`__tests__/commerce/`.

Offline backend validation does not load Next configuration, environment files,
or repository-wide test setup:

```sh
npm test -- --config=jest.stripe-offline.config.cjs --runInBand __tests__/api/stripe-subscription-checkout.test.ts __tests__/api/stripe-annual-invoice-coverage.test.ts __tests__/api/stripe-subscription-billing.test.ts __tests__/api/stripe-invoice-credit-period.test.ts __tests__/api/stripe-webhook-source-size.test.ts __tests__/api/webhooks/stripe-webhook-idempotency.test.ts
```

Before rollout, the database owner must install/verify the annual coverage and
checkout-lease forward migrations (`20261007180000_annual_subscription_paid_coverage.sql`
and `20261007180001_subscription_checkout_lease.sql`) plus existing credit-bucket prerequisites.
No Stripe configuration, remote migration, deployment, or live payment was
performed as implementation validation.

See [Stripe webhook security](STRIPE_WEBHOOK_SECURITY.md) and
[Security](SECURITY.md) for invariants that must be preserved.
