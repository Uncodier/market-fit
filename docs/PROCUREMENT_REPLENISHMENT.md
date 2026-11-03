# Inventory replenishment

## Implemented scope

Operations → Inventory minimums (`/inventory/minimums`) manages a separate, versioned rule per
workspace, catalog SKU and stock location. Changing these rules does not rewrite
approval-policy versions. Catalog procurement links to this single configuration.

- Minimum stock, target stock, minimum purchase quantity and purchase multiple.
- Enabled/disabled switch and alert or draft-requisition action.
- The minimums list contains rules; each name opens `/inventory/minimums/[id]`.
  The rule detail follows the Deals/Leads layout: sticky case/requisition tabs,
  identity header and a configuration/worker-status sidebar. Cases no longer
  appear as a global section below the rule list.
- Minimums uses the full-width list layout instead of the narrow settings card
  and section index. Rules, cases and requisitions reuse the same document-list
  shell, compact headers, entity cells and status dots as Deals and Inventory;
  monetary values use the shared money cell. Tables scroll horizontally on small
  screens, with pagination outside the scroll area. Loading placeholders match
  the table layout. No purchasing or approval behavior changes with this styling.
- Rules and each rule's case/requisition histories use independent 50-row pages
  and exact counts. Case history includes open and closed incidents; the
  requisition tab links to the existing purchasing documents, including those
  from closed cases. It never copies a requisition or changes its lifecycle.
- Existing rules can be disabled after their SKU or location becomes inactive.
  Creating or re-enabling a rule still requires eligible data.
- Minimum and target are catalog units; generated requisitions use whole units.
- The latest manager saving a rule is its execution authority. Workers revalidate
  that manager's current access rather than granting a general automation role.
- `Check stock` executes immediately; an inventory trigger otherwise queues work.
- Persisted open cases show alerts and links to generated requisitions. Resolve
  requires a reason and preserves provenance. It never cancels the requisition.
- Existing approval workflows remain responsible for submission and approval.
  No tender, award, purchase order or payment is generated automatically.
- The detail has no redundant Back, Refresh or modal Edit action. Its name,
  quantity settings, action and enabled state use click-to-edit fields with
  explicit check/cancel controls (Enter/Escape for text and numbers), following
  the Lead property interaction. Each save uses the complete validated document
  and the edit session's expected version; conflicts preserve the draft and
  reconcile server state without automatic write retries. SKU/location remain
  immutable. Demo fields remain read-only; navigation uses the global breadcrumb.
- Editing and Check stock remain available from the list and detail. Only open
  cases can be resolved from the detail, with an explicit reason and the existing
  duplicate-guard warning. Loading, failed reads and missing rules have distinct
  states; changing workspace/rule discards the previous detail. Demo records stay
  read-only and never substitute for real API results.

## Rule detail read API

`GET /api/procurement/replenishment/[id]?site_id=<uuid>&case_page=1&request_page=1`
requires authenticated procurement manager access and uses only the user's
RLS-scoped client. The rule UUID and query parameters are validated; unknown or
duplicate parameters are rejected. Each page defaults to 1 and accepts decimal
integers from 1 through 999999, with a fixed page size of 50.

The private, non-cacheable response contains top-level `rule`, `queue` (one row or
null), `cases`, `case_count`, `case_page`, `requests`, `request_count`,
`request_page`, and `page_size`. Rule data includes nullable `catalog_item_name`
and `location_name`, resolved separately within the authorized site. Cases include
both open and closed history, original rule version and quantities, creator,
request link, and closure actor, timestamp and reason. Requests are flat summaries
with `id`, `title`, `status`, `currency`, `net_amount_minor` and `revision`.

Both histories are independently paginated with exact totals and deterministic
newest-case-first ordering. Requests are selected through this rule's cases,
including closed cases, using the existing unique request link and composite
same-site foreign key. No global request list or capped intermediate ID list is
loaded. Missing or inaccessible rules return 404; failed reads or unavailable
exact totals return a sanitized 503 rather than partial history. No additional
migration is required. Regression coverage is in
`__tests__/procurement/replenishment-detail-api.test.ts`.

## Calculation and limitations

The inspected inventory contract has `inventory_levels.quantity`, not separate
reserved or incoming quantities. This implementation explicitly uses **recorded
stock**, not projected available stock. Missing or ambiguous inventory rows block
evaluation instead of assuming zero. SKU must be active, inventory-tracked and
procurement-enabled; location must be active and belong to the same workspace.

When stock is at or below the minimum, quantity is:

```text
ceil(max(target - recordedStock, minimumPurchaseQuantity) / purchaseMultiple)
  * purchaseMultiple
```

The result must be 1–1,000,000 catalog units. Server-side catalog cost, currency,
classification and taxes are snapshotted by the existing requisition RPC; client
prices and quantities are not accepted by the evaluation endpoint.

An unresolved case prevents another request for its SKU/location. Unallocated
open requisitions for the SKU and outstanding purchase orders conservatively
block evaluation: there is no reliable location-specific incoming allocation to
subtract. This may require human reconciliation rather than partial top-up.
Serial evaluation, row locks and a unique open-case index prevent automation
retries/concurrent workers creating duplicate demand. New manual requisition and
purchase-order headers acquire the same site lock: evaluation sees their completed
transactions before scanning supply. Manual edits made after evaluation remain
human-controlled and must still be reviewed by procurement staff.

At target stock, alert incidents reset. Generated-requisition cases still require
explicit resolution: stock could have recovered independently of that request.
Explicit resolution intentionally releases
that incident's duplicate guard, so managers must reconcile any existing demand
before resolving. Returned/rejected/approved generated requisitions do not alone
resolve a case. Alert delivery is in-app case recording, not email or push.

Preferred suppliers, separate assignees, automatic submission for approval,
supplier-specific quantity/conversion lookup, reservations, projected incoming
supply and stock-posting receipts are **not implemented**. Minimum purchase and
multiple are explicitly entered in catalog units; do not represent them as an
automatic supplier-unit conversion.

## Worker and rollout

Required forward migrations, after the preceding procurement migrations:

- `20261028010000_procurement_replenishment.sql`
- `20261028010001_procurement_replenishment_queue.sql`
- `20261028021000_procurement_replenishment_repair.sql`

These migrations have not been applied remotely as part of this change. Inspect the
target schema and obtain explicit deployment approval before application.

`inventory_levels` changes only enqueue checks; draft creation does not run in a
sale's stock transaction. Saving a rule also queues a check. The durable queue
tracks a generation, evaluated generation, last result and sanitized last error.
Changes arriving during evaluation remain pending for a later run. Failed jobs
consume that generation; stock/rule changes enqueue another check, or a manager
can use Check stock. Monitor failures and stale pending generations operationally.

Configure server-only `PROCUREMENT_REPLENISHMENT_WORKER_SECRET` (at least 32
characters, generated securely). The worker route fails closed without it.
An approved external scheduler should send an empty-body **POST** to
`/api/procurement/replenishment/process` with the secret in the Bearer authorization
header. Do not send site IDs, actor IDs, query parameters or JSON. Each call runs
up to 25 separate, awaited RPC transactions. Inventory locks commit before the
next rule is evaluated, avoiding reverse-order deadlocks with multi-item Stripe
stock writes. The processor accepts only `p_limit: 1`; the old SQL batch contract
is rejected, not silently retained. The response contains top-level
`processed`, `failed`, and `busy` counts/state and stops immediately on an empty
queue or another active worker. A transport failure may follow completed jobs;
retries consult the durable queue rather than replaying completed demand.

No scheduler, remote configuration, migration, deployment or commit is created
by this implementation. Automatic execution remains inactive until operators
deploy the migrations/application and configure worker invocation. The worker's
service client explicitly uses the cookie-free system contract after validating
the worker secret and calls only the service-only fixed queue processor; each rule's
saved manager is reauthorized inside the database before mutation.

## Validation

Rule-detail validation: TypeScript and targeted ESLint pass. The final selected
UI/API/navigation/localization run passed 131 tests; one existing broad
localization audit still fails on hardcoded copy in unchanged files outside this
change. The isolated replenishment PostgreSQL suite also passes. These checks do
not constitute authenticated browser or production acceptance; no deployment or
remote migration was performed.

```bash
npm test -- --runInBand __tests__/procurement/replenishment-api.test.ts \
  __tests__/procurement/replenishment-detail-api.test.ts \
  __tests__/procurement/replenishment-detail-ui.test.tsx \
  __tests__/procurement/replenishment-ui.test.tsx \
  __tests__/procurement/replenishment-postgres.test.ts \
  __tests__/procurement/replenishment-queue-postgres.test.ts
```

PostgreSQL suites use isolated socket-only local databases, never the configured
Supabase project. They test RLS, malformed input, tenant boundaries, duplicate
coverage, stock updates, generation handling and worker authority revocation.
Authenticated live visual acceptance requires a separately approved environment
with migrations installed; local unit/API tests are not that acceptance.