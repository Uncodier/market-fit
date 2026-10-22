# Location self-service ordering

## Entry point and configuration

The public entry point is `/shop/<locationUUID>/`. A location UUID resolves to
an active location and its non-archived site. Regular `/shop/<siteSlug>` and
`/shop/<siteUUID>` storefronts retain their existing behavior.

In **Settings → Shop → Self-service ordering**, configure
`settings.shop.self_service_fulfillment_options` with `pickup` and/or `dine_in`.
Shipping and no-fulfillment orders are not available in self-service. An explicit
empty array disables location self-service. When the field is absent, the server
filters the normal `shop.default_delivery_options` to these two choices; when
both settings are absent, both choices are available.

In **Settings → Company → Locations**, expand a saved location to copy its
self-service URL, open it, or download its QR code. Save new locations first.
These are public ordering links, not buyer identity or order-payment tokens.
The application production host links to the public commerce host; local and
preview settings keep their current origin.

## Catalog and shared-device identity

The menu reuses Shop products, variants, modifiers, promotions, and category
navigation. Only active, publicly listed physical products compatible with the
selected fulfillment and location can be ordered. Recurring products,
reservations, services, digital/no-fulfillment items, and dynamic-price items are
not self-service products. Checkout repeats the catalog/variant/modifier checks
on the server; hiding products in the browser is not authorization.

Ordering is anonymous by default. The kiosk does not inherit its browser's
authenticated account as the buyer. A customer can optionally scan the account
QR displayed on their own authenticated buyer home screen. The `mf:buyer` token
is HMAC-signed, expires after five minutes, and is refreshed on that screen every
60 seconds. The signature uses a separate namespace derived from the existing
server-only `SUPABASE_SERVICE_ROLE_KEY`; there is no additional environment
variable for identity signing.

The public identity-verification endpoint is rate-limited and fails closed if
Redis is unavailable. That can prevent optional account identification without
preventing anonymous ordering. Invalid or expired identity tokens do not become
raw user IDs; refresh the QR on the customer's phone or continue anonymously.
Starting a new order clears the kiosk's in-memory identity and location cart.
Do not log or persist buyer identity QR tokens in kiosk storage or analytics.

## Payment and kitchen lifecycle

All public checkout entry points reject payments, existing-order mutations and
private record references, even when the self-service flag is omitted. Client
prices and completion claims do not determine recorded payment state. Staff
Server Action calls require fresh membership and operation authorization.

The server normalizes self-service checkout to the Shop source, the resolved
site/location, `intent: draft`, `paymentMethod: cash`, and no submitted payment
rows. Staff fields, prices, payment claims, and buyer IDs from the kiosk do not
survive normalization. Catalog pricing and promotions determine the payable
total on the server.

| Event | Sale/order state | Kitchen line state |
| --- | --- | --- |
| Initial positive-total checkout | Pending; cash intent; no payment collected | Draft; no `sent_at` |
| Partial POS payment or unpaid send/complete | Pending | Draft lines remain gated |
| Full verified mobile Stripe payment | Sale completed; order remains operational | Draft lines become `new` with `sent_at` |
| Full POS cash payment | Sale completed; order remains pending/in progress | Draft lines become `new`, not `completed` |
| Server-calculated zero payable total, including a coupon | Sale completed without payment rows; order pending | Immediately `new` with `sent_at` |

A discount is not a free order if taxes or other server-calculated charges leave
a positive balance. The zero-total exception never uses the browser's cart total.
Kitchen preparation, readiness, and serving continue through the normal Orders
workflow after release. Already released, completed, or cancelled lines are not
re-sent on payment retries.
Orders and Order-lines status actions independently verify the persisted payment.
Database triggers enforce the same rule for direct writes and the unit RPC;
payment alone does not mark preparation or serving complete. Cancellation remains
available. A unit cannot start preparation before its parent line is released.

The persistent marker is `sale_orders.items[*].metadata.self_service = true`,
with `self_service_location_id` holding the resolved location. The same metadata
is stamped on normalized `sale_order_items`, including modifiers. Existing POS
edits recover and preserve this marker and the original Shop sale source; the
client does not need to resend a self-service flag. Database guards prevent
removing the marker or reassigning its order, sale, tenant or fulfillment location.

The payment gate only changes marked self-service orders. Ordinary Shop and POS
send/complete behavior remains unchanged. POS full-payment finalization returns
a kitchen delta even for `pay`/`complete`; unpaid marked orders return no kitchen
work. Stripe post-payment processing verifies the persisted completed sale and
zero balance before reservations, entitlements, inventory, or kitchen release.
Stripe delivery claims and the existing idempotent inventory RPC remain intact.

Cash, free and verified Stripe self-service releases share the service-only
`release_self_service_order` transaction. It locks the current order and payment,
releases draft parent/modifier lines and deducts stock atomically. A protected
per-line quantity ledger prevents retry or concurrent double deductions. Paid
line quantity increases deduct only additional units; cancellation/decreases do
not automatically restock. Released lines cannot be deleted to erase that ledger.
Stripe still requires its verified session and fulfillment claim before entering
the shared transaction. An unavailable RPC fails closed, without a legacy fallback.

## Checkout retries

The kiosk stores an opaque attempt UUID and a salted request digest in its
location-scoped session storage, never the account QR or customer details.
Network errors and ambiguous responses retain that UUID; changing the order
while its attempt is unresolved is blocked. Only success or an explicit
pre-write rejection permits a new UUID.

Server claims bind an attempt to its normalized request and actor. After required
commerce effects complete, a durable `ready` checkpoint records the exact order
and sale. A failed public-token/confirmation response recovers those records on
retry without repeating checkout, even if the original account QR has expired.
The random attempt UUID is also a bearer recovery credential. The branch-scoped
recovery endpoint can retrieve a ready/completed confirmation after a reload
without reconstructing the QR, notes, coupon or delivery selection. It never
executes checkout or completes a partially written attempt. Do not log this UUID
or treat it as a public order number. An expired or revoked order link is not re-enabled. Failures before the ready
checkpoint that may have written partial commerce data remain blocked for staff
review; do not create another order or recollect payment blindly. Clearing browser
storage is not a recovery mechanism. If no confirmation checkpoint exists, staff
must reconcile the original attempt before permitting another order.

## Deployment and historical reconciliation

Pause self-service cash/free checkout writers, then apply these forward migrations
in order to the explicitly approved target and deploy the application changes as
one coordinated rollout:

1. `20261022220000_self_service_payment_guards.sql`
2. `20261022220001_self_service_atomic_release.sql`
3. `20261022220002_self_service_pos_cash_source.sql`

They protect payment transitions, add the private inventory ledger/shared release,
allow admitted POS cash to preserve a marked Shop source, and connect verified
Stripe inventory to the same effect. Existing unmarked POS behavior is preserved.
Cash payment invalidates any competing mobile Stripe session inside the same
payment transaction. A late charge is rejected as replaced and enters the existing
Stripe compensation/refund path, rather than being mistaken for a payment replay.
Stripe delegation and the inventory trigger are installed atomically in the
second migration. Do not run the old cash/free application against the new
inventory trigger: the old JavaScript decrement would run a second deduction.
Resume writers only after the database and application versions match. No remote
migration is applied by the application or by local tests.

Before rollout, reconcile stock for any historical non-atomic cash/free failures.
The migration seeds already released lines and completed Stripe inventory effects
to avoid deducting them again; it cannot infer whether an older partial cash
failure actually deducted stock. New releases have transactional rollback/retry
guarantees, but the entire multi-step checkout is not one database transaction.

## Confirmation and payment handoff

New self-service confirmation numbers use a server-generated `K-` prefix and a
random UUID fragment, rather than the ordinary storefront's timestamp suffix.
The confirmation QR points to the existing opaque
public `/so/<token>` document. Customers scan that QR on their phone to view the
order and use the existing mobile card-payment flow, or give the confirmation
number to staff for POS cash payment. A public document token is a bearer
credential; do not replace it with an internal order ID or account QR.

## Local regression checks

```bash
npm test -- --runInBand __tests__/commerce/self-service-postgres.test.ts __tests__/commerce/public-checkout-boundary.test.ts __tests__/commerce/public-checkout-recovery.test.ts __tests__/shop/self-service-modifier-options.test.ts __tests__/shop/self-service-promotion.test.tsx
```

The tests cover pending cash creation, server-resolved coupon totals, remaining
tax, partial/full POS payment, marker preservation, modifier gating, retry-safe
line states, Stripe persisted-payment checks, fulfillment settings, and location
QR URLs. They are local tests, not evidence of live Stripe settlement, physical
printing, or deployed database behavior. The PostgreSQL suite creates a disposable,
socket-only local database and never uses a configured remote database URL. Live
payment and kiosk checks require an approved disposable environment and Stripe
test mode.