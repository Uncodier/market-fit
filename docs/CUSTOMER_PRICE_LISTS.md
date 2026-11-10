# Customer-specific price lists

## Resolution rules

Assign a price list in **Leads → About → Info → Price list**. The assignment is
one preference per lead, not an unrestricted grant to every channel. Lists must
be active, belong to the seller site and allow the requested channel.

- With a usable customer list, its positive item prices override the catalog.
  Missing, null or zero overrides fall back to the raw catalog price, not to a
  second list. This preserves the existing explicit-list pricing semantics.
- Without a usable customer list, the existing channel-default list and catalog
  fallback remain in effect.
- A price uses its list currency only when that list provides the price. Missing
  overrides retain the catalog currency. Existing order currency/FX rules apply.
- Products and modifiers without an explicit currency inherit the site's currency
  in POS. New storefront FX totals multiply the displayed, rounded converted unit
  price by quantity, including expanded modifier quantities. Historical/internal
  subtotal conversion remains unchanged.

## POS

Customer search and local customer records carry `default_price_list_id`.
Selecting a customer chooses their applicable list using the already loaded
catalog/list data. No price query is issued per item or on customer selection.
Clearing or switching the customer restores automatic pricing for that customer.
Explicit operator list selection stays pinned for the same customer.

Automatic repricing preserves recorded order lines and explicit manual prices or
discounts. Restored carts/orders are not silently rewritten by a background sync.
Pricing provenance travels with the existing local cart session. The price lookup
index is rebuilt on dataset changes, not per product. Fresh selections use fresh
customer data, and new lines must not merge into incompatible historical/manual
lines.

Snapshots page through price lists and item overrides instead of truncating the
dataset. The existing cached revision check includes price-list item changes and
deletions; it does not create an additional polling loop. Offline operation and
payment/outbox idempotency remain unchanged.

## Shop and Marketplace

The server derives identity using Supabase `auth.getUser()`, never a posted
buyer ID, lead ID, list ID or contact email. It uses a unique lead linked through
`buyer_user_id`. If no linked lead exists, a unique unlinked lead with the account's
**verified** email can supply the assignment. Ambiguous matches or a lead linked
to another account do not grant customer pricing. Matching is scoped per seller;
Marketplace does not apply one seller's list to another seller's products.

Public catalog/PDP caches remain shared and contain only public pricing and raw
catalog fallback data. Customer prices are overlaid **after** those cache reads.
Lookup queries are batched by sites, lists and item IDs. Request-local identity
and assignment memoization never survives into another user's request. Pricing
read failures are surfaced rather than silently charging fallback prices.

Catalog, product variants, modifier options and restored carts use the same
resolution rules. Account changes invalidate the client storefront state; token
refreshes do not. Checkout is blocked while persisted cart prices are unresolved
or failed, and it independently recalculates authoritative prices on the server.
Public checkout persists the server-resolved list reference, not client input.
Contact capture cannot link an arbitrary supplied email to the signed-in buyer.

Unavailable products/options and transient price failures expose a price-free
cart recovery view with names, quantities, affected-line markers, removal and
retry controls. Removing a configured line preserves other configurations of the
same product and persists across reloads, including Buy Now checkout. Payment
stays blocked until all remaining prices are verified; stale amounts are never
shown as a recovery fallback.

Shared self-service kiosks do not inherit discounts from an ambient staff login.
Their existing explicit buyer-QR flow is unchanged. Accepted quotation prices and
historical orders are not repriced by this feature.

## Validation and limits

Local regression suites:

```sh
npm test -- --runInBand __tests__/price-lists __tests__/commerce __tests__/pos __tests__/shop __tests__/marketplace
npm run typecheck
```

The lead editor also supports the three existing demo fixtures, isolated from
real database writes. Tests cover buyer isolation, inactive/wrong-channel lists,
fallbacks, currencies, anonymous behavior, preserved manual prices and read
counts. These are not production latency benchmarks. Validate actual database
query plans and representative large catalogs in the target environment before
claiming unchanged live latency. No remote migrations or deployment are part of
the local implementation.