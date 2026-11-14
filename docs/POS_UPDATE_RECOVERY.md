# POS updates and connection recovery

## Findings and boundaries

The global location-permission revision monitor previously reloaded an already
mounted document after an eight-second verification timeout or RPC/auth error.
That could interrupt POS without a deployment or an update-button click. The
version checker itself only offered an explicit reload; it was not an automatic
update mechanism. These are reproducible code paths, not proof of the initiating
event on a particular customer device.

The `/pos` page now relies on its own actor/site permission gate instead of the
global document-reset monitor. Its independent membership, site-exclusion and
global-exclusion checks, expiry, sign-out, cross-tab invalidation and revocation
handling remain active. Other pages, including `/pos/check-in`, retain the global
monitor. The shared monitor now preserves mounted work on transient auth/RPC
failures, malformed responses and verification timeouts. It aborts timed-out RPC
transport and stays single-flight until SDK work settles; later wake events retry.
Confirmed denials, missing authenticated users and changed permission fingerprints
still retire the private document. Ordinary navigation outside POS does not restart its deadline or discard
pending denials; the actor/site revision baseline survives the POS pause.
A confirmed denial still locks private data; a transient failure does
not gain remote access or erase stored POS work.

## Soft updates

- Deployment detection is advisory. Timers, focus and visibility do not apply an
  update or reload the document.
- The update action is deferred while any `/pos` route is open. Finish and sync
  work, reconcile unconfirmed payments, and leave POS before updating.
- Outside POS, the action requires an online browser and reloads directly on an
  explicit update-button click, without an additional confirmation dialog. The
  notice reminds users to save and sync first. It does not clear cookies, site
  selection, IndexedDB or the outbox.
- This is deferred, consent-only document replacement, not hot-swapping running
  application code. Old deployed Server Actions can still require a planned update.

The same live-route protection applies to navigation recovery and `safeReload`,
including its force option and asynchronous global creation/data-refresh callbacks.
Missing session-storage flags cannot bypass it. Outside POS, these recovery paths
also defer while the browser reports offline; reconnecting does not itself reload.
Successful data-only refreshes remain available. Confirmed security revocations
use their separate authorization boundary and are not suppressed by this policy.

This protects the mounted document, not browser-controlled reloads, tab eviction,
or a cold launch without network. A downloaded data snapshot is not an offline
application shell; those cases require separately verified shell caching.

## Connection and access recovery

`SyncStatus.online` retains its legacy meaning of remote-work availability so
existing checkout consumers cannot mistake a cached permission lease for remote
authorization. `networkOnline` separately reports the browser connectivity hint;
it is not proof that Supabase or the application server is reachable.

An online browser with a cached-only lease displays pending access verification,
not an offline-device warning. **Verify POS access** requests the existing gate
to recheck; it cannot unlock data or replay mutations on its own. The gate remains
single-flight. Accepted/restored leases publish a separate update notification,
refreshing diagnostics and resuming eligible sync lanes immediately without
clearing queue counts, errors, catalog progress or scheduling. DB permission RPCs
share an AbortSignal cancelled at the eight-second
deadline, disconnect and cleanup, so aborted DB transport can release the pending slot.
Auth SDK work is not forcibly replaced; a genuinely stuck auth operation still
needs to settle or explicit access retry. Late denials remain authoritative for
the same scope, and stale success cannot authorize a newer scope.

Transient service unavailability (HTTP 5xx, rate limiting, connection/schema-cache
errors PGRST000–002, and aborted transport) also restores only the same previously
verified actor/site with a complete downloaded snapshot. It preserves local work
and suspends remote replay until fresh verification succeeds. Explicit 401/403,
permission denial, confirmed sign-out and scope changes remain blocking; no initial
synchronization or missing snapshot is synthesized from a server error.

Continuity regressions:

```bash
npm test -- --runInBand __tests__/hooks/safe-reload.test.ts __tests__/lib/navigation/stale-router.test.ts __tests__/hooks/use-version-check.test.tsx __tests__/pos/pos-access-recovery.test.tsx __tests__/pos/use-pos-location-access.test.tsx __tests__/pos/pos-offline-access-revocation.test.tsx
```

Without eligible cached data, online auth transport errors report session
verification failure; DB transport errors report permission verification failure.
Storage and timeout failures retain their own messages. If the account is loaded
but the active site is missing, explicit access retry requests the authorized site
loader. Only this missing-context `/pos` recovery bypasses automatic-refresh
prevention; a mounted site is never refreshed by that exception. Stored site IDs
remain preferences, not authorization, and another site is not auto-selected.

## Incident follow-up

For a device still affected, record the exact time and timezone, application URL,
site, browser/version, visible error and sanitized request statuses. Distinguish
401/403, DB permission errors, timeouts and transport failures. Never collect
cookies, bearer tokens or full customer/payment payloads. Do not clear browser
storage, sign out, switch accounts or recreate uncertain payments as a repair:
existing security ownership transitions can discard local projections, and
unconfirmed payments require reconciliation.

Regression coverage includes the location monitor, access gate, transport abort,
scope revocation, site recovery policy, sync badge/retry and version checker.
No migration, remote data repair or deployment is included. Device recovery and
the original incident cause require live evidence after an approved rollout.

## Local read recovery

POS catalog hydration and order/customer refresh have independent publication
paths. Queue and open-order notifications no longer reload the complete catalog,
taxes and price lists. Bursts of notifications are coalesced; an invalidation
received during a read schedules one trailing refresh instead of being lost.
Customer publication belongs only to the order/customer lane, including after a
catalog invalidation. A late catalog read cannot overwrite newer customers.
Local customer edits retire older customer reads, and failed reads after a site
switch cannot expose the previous site's customer list.
`readLocalCatalog` does not access or return customers; a rejected or stalled
customer-table read cannot delay initial catalog/pricing readiness. Customer
errors and retries remain in the order/customer lane, without a duplicate read
from the catalog lane. `catalog-customer-isolation.test.tsx` exercises the actual
snapshot readers with failing and stalled customer storage, not a mocked
catalog-reader result.

Local reads have an eight-second UI deadline. Rejected or timed-out reads retry
after one, two and four seconds, then await another sync notification or explicit
**Retry local data**. Late read results cannot publish after timeout, workspace
retirement, or a newer same-domain read. These deadlines apply only to reads;
they never cancel or replay a payment or clear IndexedDB.

An order/customer refresh failure keeps a successfully loaded catalog usable.
Pricing, taxes, promotions and catalog publication stay together: a failed
refresh retains the complete last-good bundle. Without a successfully loaded
bundle, the UI shows an actionable failure instead of an endless skeleton, and
checkout readiness remains false. A transient read error is not permission to
invent empty taxes, prices, stock or orders from another site.

Focused regressions:

```bash
npm test -- --runInBand __tests__/pos/use-pos-catalog.test.tsx __tests__/pos/catalog-customer-isolation.test.tsx __tests__/pos/local-read-notice.test.tsx __tests__/pos/refresh-queue.test.ts
```

## Background synchronization efficiency

Catalog refresh after checkout follows an observed persisted transition to
`synced`, including late worker completion. Visiting skipped, backed-off or
unconfirmed operations no longer forces full downloads. Refresh intent is
versioned so an active download cannot consume a newer confirmation or reconnect
request. Failed catalog downloads retain that intent and use a 30-second
exponential cooldown capped at five minutes. Manual requests cannot bypass the
cooldown; successful refresh clears it. No checkout admission or payment
reconciliation rules are relaxed.

Full catalog and open-order reads use authenticated, uncached HTTP endpoints
instead of the browser's sequential Server Action dispatcher. Request and
response contracts are validated before local replacement; late or malformed
responses cannot clear last-good data. Browser waits are bounded to 30 seconds
for catalog and 12 seconds for orders. The existing server-side eight-second
PostgREST deadline for orders remains in place. Catalog fan-out does not yet
propagate cancellation through every server reader: browser timeout aborts its
transport, but must not be described as cancelling all server database work.

The order read contract preserves cancelled historical lines and children of
cancelled parents with nullable or absent pricing fields. Active line prices
and quantities accept finite numeric strings, normalized to numbers; blanks,
booleans and non-finite values remain invalid. Historical rows retain tenant
checks and never become payable through this compatibility rule. Existing cart
completeness and server checkout validation still decide payment eligibility.

Inventory and catalog reads overlap on the server, but both must succeed before
publishing a snapshot. Independent catalog/inventory versions and eliminating
the optional revision wait remain future optimizations; this repair does not
introduce a database revision protocol or change the five-minute full-refresh
safety policy. Measure deployment latency separately from offline tests.