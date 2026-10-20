# Shared catalog search consumers

Nonempty queries in Shop, Marketplace, Catalog and the POS online suggestions
use the API server's `POST /api/catalog/search`. Empty/whitespace queries retain
the existing paginated browse paths and do not call search or generate embeddings.
The web application does not embed text or run a second name/SKU database search.

## Deployment prerequisites (not performed by this change)

- Deploy the API search route and its SQL dependencies before these consumers.
  Missing configuration, migrations or an unavailable API produce visible errors;
  there is no silent fallback to unrelated browse results.
- Configure the trusted API origin using `API_SERVER_URL`, falling back to
  `NEXT_PUBLIC_API_SERVER_URL`. HTTPS is required outside loopback development.
  Configured credentials, paths, query strings and unsafe redirects are rejected.
- Public Shop/Marketplace use **server-only** `SERVICE_API_KEY` in `x-api-key`.
  This credential must match the API server configuration. Neither the credential
  nor any privileged identity header comes from the browser.
- Catalog/POS use the signed-in user's session bearer, after `auth.getUser`,
  `current_user_site_role` authorization and matching session identity. The API
  independently verifies the bearer and effective site access. These channels
  never fall back to a service key.
- API semantic search is separately enabled by its `CATALOG_SEMANTIC_SEARCH_ENABLED`
  configuration. Text/degraded mode is a valid service result, not a web fallback.

No new web feature flag is added. Coordinate rollout across repositories; this
document does not authorize deployment, migrations or a live indexing backfill.

### Public shopper admission identity

Shop and Marketplace have no separate per-shopper search limiter in their web
handlers. On Vercel (`VERCEL=1`), the server adapter reads the edge-overwritten
`x-vercel-forwarded-for` header through request-scoped `await headers()`. Its
first address must parse as an IPv4/IPv6 address. The adapter HMACs that address
with server-only `SERVICE_API_KEY` using SHA-256 and the `catalog-search-client:v1:`
domain prefix, and sends only the 64-hex digest as `x-catalog-client-id`.

Incoming `x-catalog-client-id`, `x-forwarded-for`, and `x-real-ip` are never used or
forwarded. Other hosts, missing/invalid edge IPs and absent request context omit
the bucket rather than trust arbitrary proxy headers. Self-hosted deployments
therefore retain aggregate admission until a trusted proxy contract is established.
Private bearer channels do not read request IP headers or send a bucket.

The API honors this hint only after verifying the actual service credential:
180 requests/minute per shopper bucket, plus the shared 600 requests/minute
service ceiling. Without a bucket, only aggregate service admission applies.
This is a pseudonymous rate key, not authorization or cache identity; shared-IP
shoppers share a quota and rotating the service credential rotates buckets.

## Contract and authority

`lib/catalog-search/server.ts` sends trimmed 1–200 character queries, fixed
channels and allowlisted filters. Requests are no-store, have a 15-second deadline,
reject redirects, and limit response bodies to 64 KB. Request pages are at most
100 IDs; a complete candidate window uses at most two requests (200 IDs).

Responses contain IDs and site IDs only. IDs establish relevance order, **not**
permission, price, availability or checkout authority. Invalid responses,
duplicate IDs and unexpected site IDs are rejected. Each consumer reapplies its
own authorized hydration rules and reconstructs service order after database reads.
New fields in API responses are not blindly forwarded to clients.

`count_kind: candidate_window` means a bounded search count, never an exact
semantic catalog total. Public/list consumers recompute the count inside that
window after their own visibility filters. Region facets and pagination are also
window-local. No-query browse keeps its existing count semantics. Search mode,
degradation and search ID are included in server response metadata.

Catalog and Marketplace persist `search_id` and page in browser navigation. Page
requests pass the expected snapshot ID into the first candidate request, and the
second candidate request carries that same ID. An ID identifies an immutable,
120-second candidate snapshot bound to channel, query, authorized scope and API
filters, independent of unrelated live catalog revisions or provider recovery.
The original mode/ranks remain pinned. Missing/expired or mismatched snapshots,
or a changed visible candidate set, return 409. Catalog and Marketplace clear
the old results/ID, restart page 1, and fetch a new snapshot instead of mixing
rankings or repeatedly showing page 2. Query/filter/sort/site changes also reset
page and ID. Duplicate IDs or mismatched mode/count are rejected by the adapter.
Redis shared snapshot storage is recommended across API instances; unavailable
local snapshots fail safely with 409 rather than silently creating a new ranking.
This is not a database snapshot transaction: current hydration remains
authoritative. Refine the query rather than navigating beyond 200 candidates.
Prices, inventory and geographic restrictions are re-read, not frozen commercial
state. A changed downstream price/geography filter membership can change the
visible subset even while the API's underlying candidate snapshot remains stable.

## Surfaces

- **Shop:** uncached query branch; tenant, active/listed parent, storefront
  availability, category and non-archived seller checks on hydration. Minimal
  public fields/specs and allowlisted display/checkout metadata are returned.
  Delivery and payment options retain only valid public enum values, so a
  pickup-only search result has the same fulfillment/cart behavior as browse.
  Seller prompts and private operational metadata are not returned. Existing channel
  price, stock, variant and modifier enrichment remains in use for the page.
  Search errors are visible with retry, not displayed as empty success.
  A changed search ID during infinite scrolling stops appending and requests a
  full search retry, rather than combining separate candidate windows.
- **Marketplace:** shared candidates replace the all-catalog candidate scan only
  for nonempty queries. Existing geography, effective price and availability
  restrictions apply server-side within the bounded pool. Sales ranking is not
  loaded for search; the UI shows Relevance instead of a misleading sort menu.
  No-query Featured/Best selling retain their existing full-catalog/sales reads;
  these are a known scalability caveat, not optimized by this change.
- **Catalog:** user-scoped RLS hydration retains filters and parent/variant
  behavior, including `kind: variant`, nullable parent contracts and relation
  summaries. Search results use a single relevance section/column so
  category grouping cannot reorder the service ranking. Browse grouping and sort
  remain unchanged. Dragging remains disabled during search.
- **POS:** immediate local name/SKU matching, IndexedDB snapshots, exact code
  interaction and offline checkout are retained. A separate debounced online
  suggestions section requests at most 20 IDs. It never writes partial search
  rows into the offline cache. New or changed items are disabled until the normal
  full snapshot sync supplies the item, inventory, prices, variants, modifiers
  and taxes. Selection passes the synchronized same-site local item through the
  existing availability/add-to-cart path; unknown/unavailable stock is blocked.
  Offline transition, site change or query change hides obsolete suggestions.
  Existing backend checkout validation remains authoritative.

## Offline verification

Channel price hydration always uses actual input item IDs, site/list/item chunks
of at most 200, and ordered 500-row pages within every chunk. Only the selected
default active list for an item's own site can set its price. Database errors
fail explicitly, never fall back silently to base prices. Marketplace price
filters and price sorting use the same helper as display, including pools larger
than 200 items. PDP calls include the listing and its actual same-site variants.

Use the no-environment SWC Jest runner (does not load Next config or `.env` files):

```bash
npm test -- --config jest.catalog-offline.config.cjs --runInBand
node node_modules/typescript/bin/tsc --noEmit --pretty false > /tmp/market-fit-catalog-tsc.log 2>&1 &
```

Tests isolate transport and database calls. Credentials are synthesized at runtime
with `node:crypto`; reserved test hosts never receive network calls. Tests cover
malformed requests/responses, trusted origins, session/site authorization, safe
errors, bounded requests, relevance hydration, visibility predicates, and POS
offline/unsynced/unavailable gates. They do not prove live API/SQL integration,
semantic quality, concurrent inventory safety, or a completed POS sale.