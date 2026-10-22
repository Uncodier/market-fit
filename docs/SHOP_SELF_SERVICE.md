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
variable or migration.

The public identity-verification endpoint is rate-limited and fails closed if
Redis is unavailable. That can prevent optional account identification without
preventing anonymous ordering. Invalid or expired identity tokens do not become
raw user IDs; refresh the QR on the customer's phone or continue anonymously.
Starting a new order clears the kiosk's in-memory identity and location cart.
Do not log or persist buyer identity QR tokens in kiosk storage or analytics.

## Payment and kitchen lifecycle

The server normalizes self-service checkout to the Shop source, the resolved
site/location, `intent: draft`, `paymentMethod: cash`, and no submitted payment
rows. Staff fields, prices, payment claims, and buyer IDs from the kiosk do not
survive normalization. Catalog pricing and promotions determine the payable
total on the server.

| Event | Sale/order state | Kitchen line state |
| --- | --- | --- |
| Initial positive-total checkout | Pending; cash intent; no payment collected | Draft; no `sent_at` |
| Partial POS payment or unpaid send/complete | Pending | Draft lines remain gated |
| Full verified mobile Stripe payment | Completed payment | Draft lines become `new` with `sent_at` |
| Full POS cash payment | Completed payment | Draft lines become `new`, not `completed` |
| Server-calculated zero payable total, including a coupon | Completed without payment rows | Immediately `new` with `sent_at` |

A discount is not a free order if taxes or other server-calculated charges leave
a positive balance. The zero-total exception never uses the browser's cart total.
Kitchen preparation, readiness, and serving continue through the normal Orders
workflow after release. Already released, completed, or cancelled lines are not
re-sent on payment retries.
Orders and Order-lines status actions independently verify the persisted payment
before advancing marked self-service work; cancellation remains available.

The persistent marker is `sale_orders.items[*].metadata.self_service = true`,
with `self_service_location_id` holding the resolved location. The same metadata
is stamped on normalized `sale_order_items`, including modifiers. Existing POS
edits recover and preserve this marker and the original Shop sale source; the
client does not need to resend a self-service flag. No schema change is required.

The payment gate only changes marked self-service orders. Ordinary Shop and POS
send/complete behavior remains unchanged. POS full-payment finalization returns
a kitchen delta even for `pay`/`complete`; unpaid marked orders return no kitchen
work. Stripe post-payment processing verifies the persisted completed sale and
zero balance before reservations, entitlements, inventory, or kitchen release.
Stripe delivery claims and the existing idempotent inventory RPC remain intact.

Free/POS-cash self-service inventory compares persisted line releases and includes
modifier quantities, aggregating repeated SKUs. Ordinary sequential paid saves do
not decrement already released units again. This is not an atomic inventory
effect: concurrent saves or a failure between line release and stock writes need
operator reconciliation. Exactly-once recovery for these non-Stripe releases
requires a future transactional database RPC/migration. The existing Stripe RPC
cannot be borrowed without a verified Stripe session and its fulfillment claim.

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
npm test -- --runInBand __tests__/commerce/self-service-lifecycle.test.ts __tests__/commerce/post-payment.test.ts __tests__/commerce/checkout-finalize.test.ts __tests__/components/settings/shop-self-service.test.tsx
```

The tests cover pending cash creation, server-resolved coupon totals, remaining
tax, partial/full POS payment, marker preservation, modifier gating, retry-safe
line states, Stripe persisted-payment checks, fulfillment settings, and location
QR URLs. They are local tests, not evidence of live Stripe settlement, physical
printing, or deployed database behavior. No remote migrations are needed for the
marker/settings changes; live payment and kiosk checks require an approved
disposable environment and Stripe test mode.