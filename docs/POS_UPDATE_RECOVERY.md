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
monitor. Ordinary navigation outside POS does not restart its deadline or discard
pending denials; the actor/site revision baseline survives the POS pause.
A confirmed denial still locks private data; a transient failure does
not gain remote access or erase stored POS work.

## Soft updates

- Deployment detection is advisory. Timers, focus and visibility do not apply an
  update or reload the document.
- The update action is deferred while any `/pos` route is open. Finish and sync
  work, reconcile unconfirmed payments, and leave POS before updating.
- Outside POS, the action requires an online browser and explicit confirmation
  warning about unsaved work. It does not clear cookies, site selection, IndexedDB
  or the outbox.
- This is deferred, consent-only document replacement, not hot-swapping running
  application code. Old deployed Server Actions can still require a planned update.

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