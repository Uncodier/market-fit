# Marketplace sorting

The public `/marketplace` catalog defaults to **Featured**. A compact icon button
above the product grid opens a menu with Featured, Best selling, Newest, and
ascending or descending price on desktop and mobile. Sorting is not part of the
left filter sidebar. The `sort` URL parameter persists the choice while category
filters change. Discounts is a separate promotion feed, so it hides the product
sort control without discarding the selection.

## Product filters and locations

Below categories (and digital subtypes), the sidebar shows the buyer's current
location as text with a **Set** link, not a leading location button. Mobile uses
the same controls below category chips, followed by the grid's sorting menu.

On desktop, the sidebar stays sticky below the floating header while retaining
its 256px column in the catalog's flex layout; it never overlays the products.
Tall filter sets scroll inside the sidebar within the available viewport height,
keeping price, availability and Clear filters reachable. Mobile controls keep
their existing layout rather than using the desktop sticky column.

- **Top regions** lists the six countries with the most matching public products,
  with product counts. A selected country outside the top six stays visible.
- **All regions** clears the geographic filter. **Near me** matches the buyer's
  city, postal code, region or country against seller locations. Selecting a
  country filters seller geography; it does not overwrite the buyer's location
  or delivery destination.
- Countries come from public seller settings and active inventory locations for
  sellers with active marketplace listings. Duplicate offices do not double-count
  a product in a country. Real ISO/localized country names are normalized to
  English; placeholders and inferred freeform geography are excluded.
- **Price range** uses the displayed currency at Apply time and effective
  marketplace price-list values. The applied currency is retained in the URL.
- **Available now** requires available manual/always items or positive inventory;
  parent variants qualify when a purchasable active variant is available.
- Region, price and availability filters run before ranking, totals and
  pagination. Country counts reflect category/search/price/availability but
  exclude the selected geographic filter so visitors can switch countries.

Listing filters use `regionCountry`, `nearMe`, `minPrice`, `maxPrice`,
`priceCurrency` and `availableOnly` URL parameters. Country and Near me are
mutually exclusive. Clear filters preserves category, sort and buyer/checkout
context. Product filters are hidden on the separate Discounts feed.

## Ranking rules

- Featured prioritizes units sold in the buyer's selected or approximate area,
  then global units sold. Without local sales it naturally uses global ranking.
- Best selling always ranks by global units sold.
- Only paid/completed sales count. Cancelled/refunded orders or lines, draft
  orders, modifiers, nonpositive quantities and cross-site relationships do not.
- Variant sales contribute to the parent listing. Sales are all-time, not a
  rolling window, and are not restricted to the marketplace checkout channel.
- Delivery sales use the shipping area; pickup/dine-in sales use the origin
  inventory location. Missing geography never counts as local. City is preferred
  over postal code, then region and country, with normalized names/country aliases.
- Ties and catalogs without sales use newest-first, then a stable item ID.
- Price sorting uses marketplace price-list overrides and existing USD FX rates
  to compare currencies. Unpriced items or unavailable FX conversions sort last.

`app/marketplace/load-marketplace-products.ts` filters active public parent
listings and non-archived sellers before ranking and pagination. It reads
lightweight candidates in batches to avoid the Data API row cap, aggregates sales
server-side, then hydrates only the requested page. Private sales/address data
never enters the listing response. This reuses the existing server-only public
aggregation boundary; no database migration is required.

The global Featured home is cached for 60 seconds. Buyer geography is read outside
the cache and local/custom sorting is fetched by the client. Larger catalogs may
eventually benefit from a database aggregate instead of reading all candidates
and matching sale lines; changes must preserve ranking before pagination.

## Public-domain API routing

The client fetches `/api/marketplace/products` on the current browser origin.
The separate `commercial-site` deployment serving www must forward that exact
path to the app in its `beforeFiles` rewrites. This repository's conditional
`MARKET_FIT_ORIGIN` rewrite includes the same endpoint, but changing only the app
deployment does not update www's routing table. No broad `/api/*` proxy is needed.

Without the API rewrite, www can serve the marketplace HTML while geography,
filters, sorting or pagination trigger an HTML 404 instead of a JSON response.
An unset local buyer location can mask this because the default first page uses
server-loaded products without a client request. Release verification must compare
anonymous catalog API requests on www and app, including buyer geography.

Focused regression coverage is in `__tests__/marketplace/product-*.test.ts`,
`sort-url.test.ts`, `sort-ui.test.tsx`, `use-marketplace-products.test.tsx`, and
`archived-site-exposure.test.ts`.