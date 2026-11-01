# Commerce and operations browser backlog — 2026-10-31

See [audit scope, evidence labels and release gates](preproduction-20261031.md).
All rows are scenario families missing the specified browser proof. Existing
Jest/SQL tests are inspected implementation coverage, not newly executed results.
Paths below are relative to `/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit`.

| ID | Priority | Screens and missing edge scenarios | Source / existing evidence |
|---|---|---|---|
| C01 | P0 | POS collection → Sales → Orders: positive total, cash/change, partial/full balance, on-account/mixed methods if supported; duplicate confirmation, insufficient tender, wrong currency and closed shift. Reload and reconcile one payment/receipt and exact outstanding balance. | `app/commerce/checkout.ts`; `__tests__/pos/payment-math.test.ts`, `checkout-atomic-records.test.ts`. Recent live POS only selected a lead. |
| C02 | P0 | POS offline/lost acknowledgement: disconnect before admission vs after commit, reload/reconnect, delayed success versus cancel, another order while original is uncertain, failed status lookup. Preserve operation ID, reconcile before resend and drain once. | `app/pos/local/sync-outbox-worker.ts`; `__tests__/pos/checkout-http-isolation.test.ts`, `checkout-attempt-postgres.test.ts`. |
| C03 | P0 | POS register opening/closing and concurrent cashiers: opening money, receipt/movement attribution, count difference, cash-in/out, stale session, closed during checkout, terminal response lost. No post-close movement or duplicate register receipt. | `docs/POS_REGISTER.md`; `app/pos/register`; `__tests__/pos` register/ledger suites; register forward migrations. |
| C04 | P0 | Last available stock sold concurrently from POS and Shop; stale availability, cart quantity changed, cancellation/expiry/refund rollback, failed later order line. Assert stock reservation/deduction/restoration exactly once, never oversell. | `app/commerce/checkout.ts`, `docs/SHOP_SELF_SERVICE.md`, `docs/POS_INVENTORY.md`; `__tests__/commerce`, `__tests__/pos` checkout/inventory suites. |
| C05 | P0 | Reconnect after actor/site/location revocation: offline cached catalog/cart/outbox, fresh denial, late old success/denial, two-tab sign-out. Local access cannot grant remote replay; retained work must not execute under another account. | `docs/LOCATION_ACCESS_ENFORCEMENT.md`, `docs/POS_UPDATE_RECOVERY.md`; `__tests__/pos` permission-gate/sync suites. |
| C06 | P0 | Stripe test-mode Shop/marketplace purchase: payment success/rejection/cancel, refresh/back/new tab, repeated/reordered webhook, partial settlement failure, charge already succeeded but response lost. One sale/order/inventory/entitlement outcome; success URL never means paid. | `app/api/stripe/webhook/route.ts`, `app/commerce`, `__tests__/commerce` and Stripe route suites. No live paid settlement certificate. |
| C07 | P1 | Catalog channel rules: sales/procurement-only, purchasable/POS/marketplace flags, archived category/product, variants, unsupported stock/service combinations; change while cart or picker is open. Every consumer must use authoritative eligibility, not stale list visibility. | `app/catalog`, `docs/CATALOG_CATEGORY_ARCHIVAL.md`, `docs/CATALOG_SEARCH.md`; `__tests__/catalog`. |
| C08 | P1 | Modifier groups/options: min/max, required selection, nested modifier quantities/prices, duplicate/deleted options, variant swap, taxes and edit existing sent line. Group CRUD alone does not establish checkout consumption. | `app/catalog/modifier-groups`, `app/commerce/checkout-order-items.ts`; `__tests__/pos`, `__tests__/commerce`. |
| C09 | P0 | Price list/promotions: customer eligibility, inclusive expiry boundary, quantities, zero/fractional/huge discount, overlapping promotions, stale cart price, archived product and wrong currency. Server recomputes totals; UI is not authoritative. | `app/price-lists`, `app/promotions`, `docs/SHOP_SELF_SERVICE.md`; `__tests__/price-lists`, `__tests__/promotions`. Price-list YAML mainly renames a list. |
| C10 | P1 | Catalog CSV/XLSX import: malformed encoding/numbers, duplicate SKU/case, blank optional update, rejected row after valid row, category rollback, stop/resume same request ID, lost batch response, close/reload/site switch. Preserve completed batches; never duplicate or change channel flags implicitly. | `docs/CATALOG_IMPORT.md`, `app/catalog/import-actions.ts`, `app/catalog/components/ImportCatalogRunner.ts`, `__tests__/catalog` import suites. |
| C11 | P0 | Public documents `/q`, `/so`, `/i`, `/vb`: valid/missing/expired/revoked/rotated tokens, wrong document type, foreign IDs, stale accepted quote, partial payment, disabled actions and leaked private metadata. Browser/PDF/API must agree on scope. | `app/q`, `app/so`, `app/i`, `app/vb`; `__tests__/documents/public-token-actions.test.ts`, public checkout suites. |
| C12 | P1 | Leads → Deals/Quotes/Sales: identical customer names, deleted/archived customer while picker is open, change customer with existing line/tax/payment data, foreign relation injection and pagination. Verify IDs end-to-end, not labels. | `app/leads/[id]`, `app/deals`, `app/quotations`; recent live lead→quote verifies only a zero-total draft. |
| C13 | P1 | Sales quotations: multiline prices/taxes/discounts, decimal precision, save conflict, PDF/download, send versus status change, dynamic pricing failure, convert twice, accepted quote edited concurrently. Sending and collection require their own authoritative evidence. | `app/quotations/actions.ts`, `app/quotations/dynamic-quote-request.ts`; `__tests__/quotations`. |
| C14 | P1 | Finder/People → saved list → enriched lead: zero vs unavailable, duplicate/partial results, pagination, account/site change while enrichment is pending, failed backend admission and cancellation. Accepted request is not completed enrichment; preserve scoped list/member IDs. | `app/people`, `app/api/finder/[...path]`; `__tests__/leads`, `__tests__/api` Finder tests; read-person YAML is limited browser evidence. |
| C15 | P0 | Cart isolation and fulfillment: two seller shops vs marketplace, buy-now versus shared cart, storage pressure, eligibility/prices changed mid-cart, pickup/delivery incompatibility, missing address and nearest-location failure. No cross-site basket leakage or silent fulfillment substitution. | `app/cart/checkout`, `docs/SHOP_SELF_SERVICE.md`; `__tests__/shop`, `__tests__/commerce` cart/fulfillment suites. |
| C16 | P1 | Public browse/profile/booking: name-derived shop/tender slug renamed or colliding, stale links, private/delisted product, empty/filtered results, unsupported mode, exact host split and actual cached/static images. Signed generation and public image delivery are different capabilities. | `app/book/site-slug.ts`, `app/shop`, `app/marketplace`; `docs/PUBLIC_VISITOR_AND_IMAGE_DELIVERY.md`; smoke reads one fixture. |
| C17 | P0 | Buyer Orders/Quotes/Library/Subscriptions: two buyers direct-ID/action denial; purchased entitlement vs fake URL, revoked/refunded/expired access, missing/ambiguous balance, payment retry and course/download/ticket ownership. Header/login is not ownership proof. | `app/buyer/actions.ts`, `app/home`; `__tests__/buyer/buyer-quote-ownership.test.ts`; buyer YAML is primarily a read journey. |
| C18 | P1 | Order → Lines → Shipment → Customer: split quantities conserve totals, nested modifiers, sent-versus-draft cancellation, bulk progress, stale assignment, partial/multiple shipments, supplier/provider event reorder, returned/cancelled history. Deep links and browser back preserve all parent IDs. | `app/orders`, `app/order-lines`, `app/shipments`; `__tests__/orders`, `__tests__/order-lines`, `__tests__/shipments`, `__tests__/commerce`. Shipment/order YAML does not complete fulfillment. |
| C19 | P0 | Reservations/book/check-in: DST/employee availability, capacity-one concurrent booking, reservation committed but order link failed, paid/unpaid release, one-use pass double scan, expired/cancelled/foreign code, camera denied/lost response. One capacity/use consumed and one audit event. | `app/commerce/ticket-check-in.ts`, `app/reservations`, `app/book`; `__tests__/reservations`, `__tests__/commerce/redeem.test.ts`; check-in YAML mainly rejects invalid code. |
| C20 | P0 | Inventory set/transfer/receive → POS/Shop: insufficient quantity, same location, foreign/restricted endpoints, simultaneous transfer/receipt, later write fails, offline reconciliation, warm-cache refresh. Quantity conservation and source/target/operation identity are mandatory. | `app/inventory/actions.ts`, `docs/POS_INVENTORY.md`; `__tests__/inventory/location-transfer.test.ts`. Inventory YAML reads stock tabs. |

## Additional consumer checks within these families

- Purchases → order → customer → shipment roundtrip with real same-site UUID graph;
  a row label or route 200 is not proof of correct parent linkage.
- Buyer course/library: unavailable media, malformed/unsafe URLs, duplicate
  progression saves, entitlement revoked mid-player and demo-to-real transitions.
- POS printer: no device permission/disconnect, explicit print cancellation,
  unsupported driver, duplicate receipt print and connection return. Hardware
  acceptance needs the actual device; Chromium emulation cannot certify USB.
- Native marketplace providers: unknown merchant/order IDs, duplicate/reordered
  notifications, reconnect, cancellation versus courier assignment, no shared
  provider ownership. Use sandbox integrations and independently inspect orders.

## Required fixtures and evidence

Provide nonzero tax-bearing SKUs, tracked inventory, modifiers/price lists,
two cashiers, open/closed shifts, two buyers, two sites, permitted/restricted
locations, multiline orders, finite booking capacity and one-use passes. Keep
provider test keys and all operation/token evidence private. Prefer synthetic
UUID graphs created through authorized APIs and record each setup intent.

Expected results must independently reconcile the browser, database receipts,
financial/stock/use ledger and related screens. For lost HTTP acknowledgements,
prove reconciliation of the original operation rather than a new replay. Never
mock the application's mutation response to call a real integration green.