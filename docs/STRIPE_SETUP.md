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

### Legacy route warning

The subscription, credits, portal, and payment-method routes predate the
hardened order/sale checkout flow. They currently accept some client-provided
site, identity, amount, or return URL fields and do not consistently use
`requireSiteAccess()` or the checkout URL allowlist:

- `app/api/stripe/checkout/subscription/route.ts`
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
- `charge.dispute.created`
- `payment_intent.payment_failed`

If handlers change, update the Stripe endpoint configuration and this list in
the same release.

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

See [Stripe webhook security](STRIPE_WEBHOOK_SECURITY.md) and
[Security](SECURITY.md) for invariants that must be preserved.
