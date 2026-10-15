# Marketplace provider contracts

This server-only boundary uses official public contracts fetched on 2026-10-14.
No provider request target is accepted from a webhook. All requests use fixed
HTTPS hosts, redirect rejection, no persistent fetch caching, a 10-second timeout
covering response reading, and a 2 MiB streaming response limit. Tokens remain
in bounded process memory keyed by a credentials digest with an expiry margin.
No errors include credential, token, provider response body, or customer data.

## Public interface

- [types.ts](types.ts) defines the connection, normalized order, action, delivery,
  event and typed error contracts.
- [index.ts](index.ts) exports `fetchOrder(config, id)`,
  `actOnOrder(config, id, action)`, `normalizeOrder(config, payload)`,
  `parseWebhook(provider, payload)`, `normalizeWebhook(config, payload)`,
  `fetchOrderEvents(config, id)` and `fetchNewOrders(config, status)` (Rappi only;
  `status` is `new` by default, or `sent`).
- `parseWebhook` is untrusted routing metadata only. Verify the raw bytes with
  [signatures.ts](../signatures.ts) before calling `normalizeWebhook` or mutating
  any tenant data. Never log the raw body. The caller owns durable event
  deduplication, tenant authorization, operation persistence and out-of-order
  event policy.
- Action return values acknowledge a provider HTTP response, not a invented
  settlement, delivery, or completed order. A network failure after dispatch
  must be treated as an unknown outcome, not retried blindly.
- Every Rappi action requires caller authorization of the imported order/store
  and its actionable state. Ready additionally requires `manual_ready: true`.
  Actions make no list preflight. Accepted orders are not available in the documented
  new/SENT list API, so a fake single-order fetch must not be added.
- Rappi event-history responses lack store/order IDs; the caller must authorize
  its imported ID against the connection before fetching. Recovery polling must
  be caller-rate-limited to at least 45 seconds. Unknown events are ignored.

## Uber Eats: explicitly previous-version POS order API

Official references:

- [Authentication](https://developer.uber.com/docs/eats/guides/authentication)
- [Sandbox hosts](https://developer.uber.com/docs/eats/guides/sandbox)
- [Get order](https://developer.uber.com/docs/eats/references/api/v2/get-eats-order-orderid)
- [Accept](https://developer.uber.com/docs/eats/references/api/v1/post-eats-order-orderid-acceptposorder)
- [Deny](https://developer.uber.com/docs/eats/references/api/v1/post-eats-order-orderid-denyposorder)
- [Cancel order](https://developer.uber.com/docs/eats/references/api/v1/post-eats-order-orderid-cancel)
- [Webhook envelope](https://developer.uber.com/docs/eats/references/api/webhooks.orders-notification)
- [Webhook signature](https://developer.uber.com/docs/eats/guides/webhooks)

OAuth client credentials request `eats.order`. Production uses `auth.uber.com`
and `api.uber.com`; sandbox uses `sandbox-login.uber.com` and `test-api.uber.com`.
GET `/v2/eats/order/{id}` and POST `/v1/eats/orders/{id}/accept_pos_order`,
`deny_pos_order`, `cancel` are implemented. Acceptance cooking time becomes the
documented Unix `pickup_time`. Deny uses `reason.code: OTHER` with the merchant
explanation. Cancel uses `reason: OTHER` and `details`; it is an order operation,
never a delivery cancellation. Ready is unsupported: restaurant/BYOC delivery
status is not a marketplace-ready operation.

`X-Uber-Signature` is lowercase hexadecimal HMAC-SHA256 of the exact request
body using `client_secret`. Uber supplies no timestamp in that signature;
durable `event_id` deduplication belongs to the caller. `DENIED` is normalized
as `rejected`, not cancelled: an in-store tablet may still accept the order.
`orders.release` signals courier geofence release and is a delivery event;
fetch fresh order details via the fixed GET endpoint if needed.

Money uses the currency's minor-unit exponent. Reported line prices already
include selected options, so modifiers must not be added to parent totals again.
Order preparation notes come from `cart.special_instructions`. Modifier groups'
`removed_items` become explicit `Remove: <title>` instructions on the parent item,
including removals with zero quantity. They never become payable zero-quantity
native rows. Overlong combined item instructions fail rather than silently losing
removals. Existing item-level instructions and selected modifiers are preserved.
`total_promo_applied` wins when available; all charge variants are retained in
`marketplace_totals`. Optional promotions remain unavailable for some apps;
absence does not authorize recomputing totals from the local catalog.

## Rappi: supported public orders + current authentication

Official references:

- [Authentication](https://dev-portal.rappi.com/en/authentication-process/)
- [Current and previous country domains](https://dev-portal.rappi.com/en/api-reference/content/)
- [Order API](https://dev-portal.rappi.com/en/api-reference/orders/)
- [Order flow](https://dev-portal.rappi.com/en/managing-user-orders/)
- [Webhooks and signature](https://dev-portal.rappi.com/en/webhook-events/)

Authentication is POST `/restaurants/auth/v1/token/login/integrations` with JSON
`client_id` and `client_secret`, using the documented new country domain.
Orders use the documented existing country service domains and
`x-authorization: Bearer ...`. Supported countries: MX, CO, BR, AR, CL, PE,
EC, CR and UY. Sandbox auth is `api.dev.rappi.com` and orders are
`microservices.dev.rappi.com`.

Single-order refresh searches only GET
`/api/v2/restaurants-integrations-public-api/orders/status/sent`, filtered by
`storeId`. No arbitrary single-order GET exists in this contract. Recovery makes
one store-filtered list request per call: `orders` for `new`, or
`orders/status/sent` for `sent`. **GET new is consuming:** it transitions all
returned READY orders to SENT. Callers must persist every returned order without
truncating the list and recover failed imports through SENT polling. Do not use
it for single-order refresh or action preflight. The SENT recovery window is
limited by Rappi; the caller must schedule both lists promptly.
Accept uses PUT `orders/{id}/take/{cookingTime}` and
requires supplied cooking time. Reject uses PUT `orders/{id}/reject` with a
reason. Ready uses POST `orders/{id}/ready-for-pickup` only with manual-ready
configuration enabled by Rappi. Cancel is explicitly unsupported, especially
after acceptance. There is no fake request/cancel delivery operation.

`Rappi-Signature` is `t=<Unix seconds>,sign=<hex HMAC-SHA256>`, signing timestamp
plus `.` plus exact body bytes with `webhook_secret`. This implementation applies
a 300-second past/future replay window in addition to caller-owned durable
deduplication. Missing or malformed signatures fail closed.

Prices are major currency units; currency comes from the supported configured
country when absent in payload. Rappi product prices exclude toppings and
subitem quantities are per parent. Normalized parent totals include toppings and
set `modifiers_included_in_price: true` so persistence does not charge them again;
modifier prices remain available for display. Marketplace aggregate totals always win over
computed display line totals. `NEW_ORDER_SCHEDULED` has provisional zero prices;
`totals_provisional: true` prevents using these as final sale totals. The later
`NEW_ORDER` is authoritative. Offset-free `place_at` is kept as store-local text,
not falsely converted to UTC. Cancellation placeholders are metadata-only and
must not replace existing totals. Courier fields are copied only when provided.
The official scheduled example omits `total_products` and `total_discounts`;
only scheduled provisional payloads default these absent fields to zero. Normal
GET examples still report both at the totals root, not in `charges`.

`delivery.provider_event` preserves the documented event label without asserting
a native shipment stage. `taken_visible_order` can mean successful store take OR
courier assignment. `storekeeper_name` is the documented fallback name field.
The documented cancellation glossary is recognized explicitly; prefix matching
or invented cancellation names are not used. Do not register `PING`: its
`{store_id}` payload cannot demonstrate local POS terminal connectivity, and this
adapter does not implement Rappi's connectivity handshake. Such payloads are
ignored, not proof of a healthy store.

`items[].external_id` is a stable line identity, not the repeatable product ID.
`external_product_id` preserves that menu ID. Uber `instance_id` wins when
provided; otherwise deterministic position paths distinguish customized repeats.
Rappi uses deterministic root/modifier position paths. Totals and quantities are
unchanged by identity generation.

## Offline verification

Focused tests in `__tests__/marketplace/provider-*.test.ts` use runtime-generated
synthetic secrets and fetch doubles returning real `Response` objects. No live
network, credentials, database, build, deployment, or remote migration is needed.
Use the lead's isolated marketplace Jest configuration (no dotenv/app setup).