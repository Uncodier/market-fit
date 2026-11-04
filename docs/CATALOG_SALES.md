# Catalog item sales

The Sales tab at `/catalog/[id]` reads real `sale_order_items` linked to
`sale_orders` and `sales`, including the item's direct child variants.

## Behavior

- Period presets cover 30, 90 or 365 inclusive UTC calendar days.
- The activity date is `sales.sale_date`, falling back to `created_at`.
- Only paid/completed sales qualify. Draft, cancelled and refunded orders and
  cancelled/refunded lines are excluded. Nested modifier lines are excluded.
- Item revenue uses persisted line subtotals, including line discounts. It is
  not cash collected or net revenue: order-wide discounts, taxes, shipping and
  partial refund allocations are not attributed to individual products.
- Currency and source filters apply to metrics, trend and paginated history.
  Monetary amounts in different currencies are never added together. Missing
  historical currency remains explicitly unspecified.
- Each history row links to its existing order detail page.
- Loading, error/retry and empty states are distinct. Tenant/item changes clear
  local data immediately; obsolete requests cannot publish their results.

## Access and limits

`GET /api/catalog/[id]/sales` validates UUIDs and a real calendar-date range of
at most 366 days. It authenticates and verifies site membership, site `select`
permission, unscoped location access and full linked-sales/order visibility.
Catalog items, variants and all joined relations are scoped to that site using
the signed-in user's Supabase client and RLS. Assigned-only users are denied
instead of receiving misleading partial site totals.

The loader uses immutable-ID keyset pagination and bounded ID batches. It scans
at most 5,000 direct variants and 50,000 eligible item lines, including older
history needed for legacy null sale dates. Exceeding a ceiling returns an error,
never a successful truncated total. The reads are not an MVCC snapshot.
Legacy JSON-only order items without normalized catalog links are not counted.
No migration or service-role access is introduced.

## Validation

```bash
npm test -- --runInBand __tests__/catalog/sales-history.test.ts __tests__/catalog/sales-history-route.test.ts __tests__/catalog/sales-tab.test.tsx
```

These offline tests cover calculations, date/status/currency boundaries,
variant paging, access denial, invalid inputs, UI filtering and stale requests.
They do not establish live database or authenticated-browser verification.