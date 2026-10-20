# Catalog import and large catalogs

The Catalog toolbar exposes **Import**, alongside the existing modifiers, sort,
and view controls. The dialog loads its spreadsheet parser only when needed.

The upload screen follows the Leads import design: descriptive progress steps,
sample download buttons, and a keyboard-accessible click/drag-and-drop area.
**CSV Sample** and **Excel Sample** download two editable example products using
all supported column names. Excel produces a real `.xlsx` workbook with text SKUs
to preserve leading zeros; it is not a legacy `.xls` or a renamed text file.
Category and image URL examples are blank so they do not depend on site-specific
categories or external assets. Replace the example products before importing.
Detailed file requirements remain available in an expandable section.

## File contract

- CSV or modern Excel `.xlsx`; legacy `.xls` must be converted first.
- Excel imports the first worksheet. The first row contains unique column names.
- Maximum 10 MB, 20,000 product rows, and 50 columns per file.
- Sparse files are bounded to 100,001 source rows including the header. XLSX
  ZIP expansion is checked before parsing and is limited to 50 MB.
  The allocated worksheet rectangle is limited to 1,000,050 cells. Workbooks with
  malformed relationships, inconsistent dimensions, invalid coordinates, or ZIP
  metadata are rejected before the spreadsheet reader can discard data or allocate
  an excessive matrix. Export a fresh XLSX or CSV when these checks fail.
- Map **SKU** and **Name**. Optional fields are description, sale price, cost,
  minimum sale price, currency, category name, and image URL.
- SKUs are exact, case-sensitive identifiers within a site. Keep leading zeros
  as text in Excel. Every repeated SKU in the file is rejected, not first-row-wins.
  This also applies when another occurrence contains an invalid price or name.
- Prices are plain non-negative numbers with at most four decimals. Do not use
  currency symbols or thousands separators. A single decimal comma is accepted.
- Select the default currency explicitly. It applies to new products whose file
  does not supply a currency; it does not overwrite existing currencies.
- Image URLs must use HTTPS without embedded credentials or custom ports.
  Accepted URLs are canonicalized (including international hostnames and escaped
  path spaces) before database validation. Control characters, backslashes, and
  invalid Unicode are rejected during review rather than failing an entire batch.
- Categories are matched by name within the same site, ignoring case and leading,
  trailing, or repeated ASCII whitespace. Accents and punctuation remain significant.
  Missing categories are created as active categories only when their product row
  is imported. Equivalent names in later rows/batches reuse that category. Archived
  categories are never reused or restored; a new active category can share their name.
  Multiple active matches are ambiguous: those rows are rejected until duplicate
  category names are resolved or the category column is unmapped.
  Quotes, commas, and backslashes in SKUs are escaped as literal PostgREST operands;
  category lookups use bounded JSON RPC arguments, not name filter interpolation.
- This flow imports products, not inventory quantities, variants, taxes, or
  modifier relationships. Those keep their existing dedicated workflows.

## Review and execution

File parsing and column mapping do not write to the database. Review shows valid
rows, validation errors, and existing SKUs from bounded preflight queries.
Missing category names are informational, not row errors. Review creates nothing;
category creation and product assignment commit together during execution. Skipped
existing SKUs do not create unused categories, and failed rows roll back new categories.
**Skip existing SKUs** is the default. **Update existing SKUs** is explicit and
updates only supported fields present in each row. Blank optional cells preserve
existing values. Publication, status, parent/variant relationships, inventory,
and other commerce flags are never changed by an update.

New products are active and purchasable but are not automatically published to
the marketplace or POS. Review and configure their sales channels separately.

Execution uses sequential batches of at most 100 rows and 400,000 UTF-8 bytes.
The server includes PostgreSQL JSONB formatting overhead in that limit; the
browser leaves extra headroom when forming each batch.
Valid rows can commit while other rows in that batch are rejected; the result
reports created, updated, skipped, and rejected rows separately. Previously
committed batches are not rolled back when the user stops or a later batch fails.

Keep the dialog open while importing. This is not a durable background worker.
Stop pauses between batches; Resume retries the pending batch with the same
request ID. Replays return the committed receipt rather than creating duplicate
products or applying an update twice. Closing, reloading, or changing sites ends
the in-memory session. Reimporting the original file in skip mode safely skips
existing SKUs; update mode is a new explicit operation, not session recovery.

## Authorization and installation

Server Actions verify identity, site membership, and `user_can` permissions.
Import requires select/insert, and update mode additionally requires update.
The database function independently checks these permissions and site ownership
of every matched item/category. No service-role client is used by the application.

Before enabling database execution, review and apply
`supabase/migrations/20261019230000_catalog_batch_import.sql` to the confirmed
target project through the approved migration workflow. This change does not
apply remote SQL automatically. The migration adds replay receipts and an
explicitly authorized batch function; receipt writes cannot be forged by direct
authenticated Data API requests. The existing per-site SKU unique index remains
the final concurrent-insert safeguard.

Automatic category creation and name matching additionally require
`supabase/migrations/20261020010000_catalog_import_categories.sql` before deploying
the updated importer. It adds a read-only category preview RPC, a normalized-name
lookup index, and category name-write guards sharing the archival/import site gate.
Existing categories are not renamed, merged, or deleted by the migration. A
concurrent category write fails fast for retry rather than creating duplicate
categories during an import. Existing permissions and replay receipts are retained;
replaying a previously committed request still returns its original result.

The migration also adds timestamp/display-order paging indexes and trigram
indexes for substring name/SKU searches. It requires `pg_trgm` in the confirmed
`extensions` schema. Index creation is transactional, not concurrent: schedule
rollout appropriately for a busy catalog and review lock acquisition failures.

The local PostgreSQL regression tests exercise the migration against an isolated
fixture database. They are not a substitute for checking the target schema,
deployment migration history, and non-privileged access after rollout.

## Large-catalog browsing

The workspace lists 50 products per page with server-side search/sorting and
pagination in table and Kanban views. Sorting uses a stable ID tie-breaker;
search covers names and SKUs. Drag reordering is available only when the complete
unfiltered list fits on the loaded page, never over an incomplete dataset.
If archival removes the final page, navigation returns to the last available page
instead of leaving an empty list with no way back.

Catalog import and browsing do not load the entire product catalog into the
browser. Pagination uses bounded offset queries; very large catalogs may later
benefit from cursor pagination. Existing POS/storefront data flows are separate
and retain their own pagination/cache contracts.