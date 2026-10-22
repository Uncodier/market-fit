# Resource amplification guards

The commerce RLS planning migration is separate from these application guards.
These changes do not bypass RLS or grant additional tenant access.

## Navigation counts

- Six badge counters use completion-driven polling rather than unconditional
  intervals. A mounted badge keeps one request slot until its promise settles.
- Hidden/offline tabs pause work; SDK queries share an eight-second abort signal.
  Aborting is not treated as completed work if the underlying transport ignores it.
- Failures back off exponentially with jitter, capped at five minutes. Site,
  account and sign-in changes invalidate old results immediately.
- Requirements/campaign status filtering runs in PostgreSQL. Simple badges use
  exact HEAD counts rather than downloading rows. Leads still count distinct
  companies from the returned window; this retains the existing server row cap.

## Shared JSON cache

`readThroughJsonCache` coalesces pending work by the complete existing cache key,
including when Redis is unconfigured. No result remains in this local map after
settlement, and live entries are never evicted to admit duplicate work.

When configured Redis cannot grant a lock, the caller receives a stale result or
`busy`; optional Redis no longer permits duplicate recomputation. A Redis failure
and lock contention currently share the same boolean outcome, so both use this
safe admission behavior. Callers must retain their existing retryable busy paths.

Successful JSON values are cloned per caller. A failed analytics computation also
returns an independent Response body to each caller. Lock release follows the
settlement of both cache writes, including when one write fails.

Authorization still precedes cache access. This helper does not invent user/site
keys, grant permissions or make an incorrectly scoped caller key safe. It does not
renew a distributed lease or guarantee cross-instance single-flight after expiry.

## Control Center

Initial status loading uses five sequential queries instead of separate count and
data queries for each of five statuses. Each query retains exact totals, sorting,
the 50-row window and existing pagination behavior. Assignee enrichment resolves
each unique ID once per load with at most four concurrent lookups.

## Realtime

Orders, order lines and shipments retain their existing debounce and filtering,
but await the actual authoritative refresh promise. Events arriving during it
mark one dirty follow-up rather than launching parallel refreshes. Hidden/offline
tabs defer refresh; disposal suppresses pending work for an old subscription.
Consumers return their SWR mutation promises instead of discarding them. Order
alarms and printer events retain their existing business behavior.

## Offline checks

Run from the repository root:

```bash
node node_modules/jest/bin/jest.js --config __tests__/navigation/jest.badges-offline.config.cjs --runInBand
node node_modules/jest/bin/jest.js --config __tests__/lib/json-cache.jest.config.cjs --runInBand
node node_modules/jest/bin/jest.js --config __tests__/control-center/jest.data-offline.config.cjs --runInBand
node node_modules/jest/bin/jest.js --config __tests__/orders/jest.realtime-offline.config.cjs --runInBand
npm run typecheck
```

The focused configurations use the installed Next.js Jest transformer without
loading project environment files or performing provider/database requests.
Tests exercise deferred requests, failed locks, timeouts, visibility, account/site
changes, independent response bodies, query counts and preserved display values.

## Verified rollout — 2026-10-22

The commerce planning helpers were already present in Makinari when this rollout
started. Read-only catalog checks confirmed their saved bodies, invoker mode,
role sets and restrictive policy composition; the migration was not reapplied.

Application guards were deployed as `dpl_GxHr5grK482UVPmUQMJiraHdciHg` and promoted
to the existing project domains. `app.makinari.com` and `demo.makinari.com` resolved
to that deployment and returned HTTP 200 in the post-promotion checks.

The deployment was built from committed base
`a33941be62b210b8da8fbacf288800318f93f02d` plus only the repair files. Unrelated
working-tree localization changes and local environment files were not uploaded.
The frozen source passed TypeScript, 94 focused tests and the Vercel production
build without disabling the type gate. Two existing shipment response union
checks were corrected to discriminate success/error before reading data.

This direct deployment does not commit or push the working-tree changes. Publish
these source changes through the normal repository review process so a later
Git-triggered deployment does not replace them with the previous implementation.

Anonymous HTTP smoke checks are not an authenticated end-to-end checkout proof.
Postgres/Realtime logs in the sampled post-migration window had no errors, but
that observation does not guarantee future stability or establish the host-level
cause of the earlier restarts. Reservations, chat windows and other residual RLS
graphs still require workload-specific validation rather than blanket bypasses.

## Follow-up repairs — 2026-10-22

### Bounded orders and calendar reads

Orders retain exact totals and all status/date/location/unpaid/search filters in
the base page query. Empty PostgREST search embeds avoid preliminary 5,000-ID
search truncation. Display enrichment uses flat user-scoped, site-filtered reads
for page IDs, IN batches of 100, complete 500-row pagination and bounded fan-out.
Regular order pages no longer embed items/sales/leads; unpaid pages retain only
the inner sales predicate needed to filter before counting and pagination.
Order-line pages retain minimal item/order inner joins, then hydrate relations
separately. Missing required relations after pagination return a retryable error
instead of silently changing the count. Public document bearer tokens are not
selected. One eight-second SDK signal spans the complete read; sibling requests
settle before the computation releases ownership.

Reservations and calendar blocks read the displayed local day/week/month/year
window, including adjacent month cells. List views expose month navigation and
state the search period explicitly. Long/open-ended events preserve overlap and
canonical edit/payment identity. Server windows validate ordered, timezone-aware
timestamps and a maximum of 366 days. Complete 500-row pagination shares a
15-second/100-page budget; failure returns an error, never truncated success.
Timeout abort does not release a transport that has not actually settled.
Payment enrichment is explicitly site-scoped and retains session RLS.

**Remaining calendar limitation:** tasks have no reliable `end_date` column and
legacy metadata can describe arbitrary-length spans. Assigned tasks retain a
safe upper date bound and are filtered by mapped overlap, but historical tasks
still require scanning. A reliable indexed task end-time contract needs a new
data-model/backfill review; an arbitrary lookback would hide valid events.

### Verified database indexes and history

`20261022011443_operational_read_indexes.sql` was applied through the Supabase
Management migration endpoint to project `rnjgeloamtszdjplmqxy`. Its generated
remote version is also the local filename. Catalog verification confirmed all
six exact indexes: recent requirement history; order created/updated sorting;
reservation time window; task status/priority/scheduled sorting and task scheduled
window. A name collision fails and rolls back rather than blessing a wrong index.
No RLS, grants, data backfills or instance settings were changed by this migration.

A production requirement with 5,680 history rows uses the new composite index
for the latest ten without a sort (sample planner allocation 64 KiB and planning
1.404 ms). This is a plan observation, not a full authenticated endpoint latency
guarantee. Empty search alias and nested unit-search shapes returned HTTP 200 in
minimal parser checks; existing test-user requests also validated those shapes.

The already-installed commerce migration's missing history entry was repaired
only after verifying all seven helper bodies, policy/parent identities,
restrictive authenticated roles, USING/WITH CHECK, invoker/STABLE configuration,
grants and protected backup access in the same transaction. Historical SQL was
stored as metadata, **not executed again**. Other missing historical versions
remain unverified; do not replay them or mark them applied blindly.

### Operational RLS decision

The broader eleven-table candidate was tested and **rejected for production**:
it reduced laboratory planner allocation but increased restricted execution.
It lives outside the migration pipeline, with evidence and limitations in
[Operational RLS review](OPERATIONAL_RLS_REVIEW.md). Do not call inventory,
transactions, receipts, GPS or comment policies optimized by this release.

The previously reported credit-email RPC mismatch is no longer present in the
remote catalog: the three-argument owner-bound function now exists. That change
was observed, not applied by this performance repair.

### Validation and release boundary

The isolated release source, not the unrelated localization working tree, passed
63 order/unit tests, 36 reservation tests, the original 94 guard tests, three
native index tests and 33 commerce RLS security/planning/write tests. TypeScript
was also checked with the installed Next.js type generator. Additional chat and
experiment checks are recorded with the final release evidence.

Chat history now throws a sanitized, coded error rather than replacing an
existing SWR window with `[]`. Its cache identity includes the authenticated
user and conversation. Startup has one physical read; focus/Realtime bursts
coalesce until completion, with one dirty follow-up and bounded retries.
Cleanup aborts stale work and disables old callbacks/subscriptions. The existing
40-history/1,000-pending windows and exact-conversation social-parent checks
remain unchanged. Optional unavailable parent/profile enrichment keeps its
existing explicit fallback. Nineteen offline chat regressions verify these
boundaries; sibling transport rejection waits for actual fan-out settlement.

Authenticated browser checks uncovered a pre-existing HTTP 400 in Control
Center: `leads:lead_id` no longer resolves the composite `(site_id, lead_id)` FK.
List, pagination and detail reads now name `leads!tasks_lead_id_fkey` explicitly.
All five status reads returned correct totals under the test-user session after
the fix. No foreign key, policy or grant was relaxed to make the query succeed.

Successful authenticated reads and route loading are not a mutating checkout,
shipping or payment E2E proof. No production order/payment/message mutations were
used for these checks. Existing database security-advisor notices are separate
work: [Supabase database linter](https://supabase.com/docs/guides/database/database-linter).

## Final release evidence — 2026-10-22 01:38 UTC

- Repair source committed and pushed as
  `9331cc8ea0733ce24a0986c9e0a329be1e26576e`. Only 83 frozen repair files were
  included. Unrelated localization edits, including edits in the same task-detail
  page, stayed in the working tree. No environment files were uploaded or committed.
- Final deployment `dpl_6ME4GGSKZ181Lzib5ZGEc5EKkX7q`:
  `https://makinari-46jzd2pko-uncodie.vercel.app`. The production build passed
  compilation, its TypeScript gate and generation of 229 static pages. Promotion
  completed at 01:37 UTC; the app/demo aliases were verified against this exact ID
  and both returned HTTP 200. GitHub also started a deployment of the same repair
  commit; the repair is no longer an uncommitted direct-deploy-only patch.
- **274 focused tests passed**: orders/units 63, reservations 36, badges 32, JSON
  and analytics caches 40, Control Center 6, Realtime 16, chat 19, native read
  indexes 3, commerce security/planning/writes 33, rejected operational experiment
  26. The complete isolated source passed `npm run typecheck` without disabling
  strictness. These are focused regressions, not a claim that all repository
  test suites or all existing lint findings are clean.
- Final authenticated browser validation used an existing configured test user,
  actual password sign-in and actual workspace selection. Orders, order lines,
  reservations, Control Center and chat all loaded at their expected routes with
  HTTP 200 and no failed API/Data API responses in the sampled observation.
  Control Center issued all five successful corrected task queries. No order,
  payment, shipment or message was created/changed by the validation.
- Last database capture at 01:37:56 UTC: postmaster start remained
  `2026-10-22 00:02:46.412272+00`, 32 client connections and zero Lock waits.
  The 01:33–01:38 log sample had no PostgreSQL timeout/OOM/shutdown events.
  This short window does not establish long-term stability or a host restart cause.

### Remaining measured work (not silently declared fixed)

1. Historical task spans in the reservation calendar still need a reliable
   indexed end-time model and reviewed backfill.
2. Broader operational RLS was rejected; inventory, transaction, receipt, GPS and
   comment workloads require their own measured read/permission regressions.
3. Missing foundation/correction migration-history entries are not reconciled by
   this release. Only the verified seven-table commerce entry was repaired.
4. A separate `bill_sandbox_sessions` RPC timed out at 01:31:19 UTC. Logs identified
   that function, not orders or `requirement_status`; no billing changes were made
   here. Investigate bounded session batches, lock contention and its own atomic
   billing/idempotency contract rather than blindly replaying migrations.
5. Authenticated read-only navigation is not mutating checkout/shipping/payment
   E2E coverage. Production writes need a dedicated approved disposable workflow.

Sanitized local release manifest and detailed logs are in
`/tmp/makinari-resource-final-manifest.json`, `/tmp/resource-final-*.log` and
`/tmp/resource-auth-browser-final.log`. Temporary evidence is not a durable
monitoring service; the decisions and release identifiers above are tracked here.