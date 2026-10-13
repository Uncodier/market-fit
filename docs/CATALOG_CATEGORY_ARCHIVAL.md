# Catalog category archival

The catalog category editor offers **Archive category**. Confirmation explicitly
includes every item in the category and its descendant variants, even when a
search, filter, pagination, or collapsed section hides them.

## Behavior

- Archival preserves category, item, accounting, and promotion records instead
  of deleting them. Existing sales and accounting references remain intact.
- The category and all affected items become `archived` in one database
  transaction. Pass redemption links for the archived reservable items are
  removed, matching individual item archival.
- Active category pickers exclude archived categories. The catalog's Archived
  filter retains archived category groupings, including empty categories.
- Empty active categories remain editable even when the catalog has no items.
- Only an authenticated site owner or admin can archive a category. The Server
  Action uses the user's Supabase client, and the database verifies permission
  and tenant ownership again. No service-role credential is used.
- A failed confirmation stays open for retry; controls are disabled while the
  operation is pending. Success closes the editor and reloads its catalog data.
- The Server Action expires shop, marketplace, and affected item-detail caches.
  Existing POS synchronization still governs already-open/offline terminals;
  server-side sellability checks reject archived items.

Category restoration is not included. Archived items cannot be reactivated while
assigned to an archived category or archived parent. Move an item to an active
category before restoring it; variants also require active ancestors. Creating a
category by name does not silently reuse an archived category.

## Rollout and validation

Apply `20261012190000_catalog_category_archival.sql` using the approved migration
workflow **before** deploying the archive action. It adds category lifecycle
state, an atomic archival RPC, and database lifecycle guards. Remote application
requires explicit approval; the implementation task does not apply it.

Membership and status changes use a transaction-scoped per-site lock. Conflicting
writes fail fast rather than waiting with an inverted row-lock order. The archive
action reports this conflict as retryable; the whole failed transaction rolls
back. Lifecycle writes require the normal `READ COMMITTED` isolation level.

Relevant entry points are `app/catalog/category-actions.ts`,
`app/catalog/components/EditCatalogCategoryDialog.tsx`, and the migration.

Run the focused regressions with:

```bash
npm test -- --runInBand __tests__/catalog
```

Live migration tests use an isolated local PostgreSQL cluster, not a configured
Supabase database. Missing local PostgreSQL binaries are reported as skipped
tests rather than evidence of live database validation.