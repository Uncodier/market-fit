# POS checkout recovery

## Operational behavior

### Device-stamped automatic resend

New checkout queue rows retain `posOperationIdentity` (version 1, a browser-profile
device UUID, and the original local creation timestamp). The server includes these
fields in its canonical SHA-256 fingerprint. The existing `(site_id,
client_mutation_id)` primary key remains the atomic admission identity; a hash is
not a replacement for authorization or a unique business-order identifier.
The queue does not stamp or rewrite existing legacy attempts. Retry preserves the
original mutation, device, timestamp and receipt IDs, even after browser reload.

For new rows containing payments, background synchronization checks failed/uncertain
attempts. Only `not_found` permits a resend through the original checkout admission lock.
A delayed original request and a resend cannot both acquire that same attempt.
Completed results are recovered; processing, rejection, recorded payments and
partial/inconsistent evidence never authorize replay. Failed evidence reads also
stop replay. The persisted resend cooldown grows from five seconds to five minutes;
the ordinary sync cycle performs retries when connected and authorized.

Unpaid device-stamped retries can query the same checkout admission directly rather
than the payment-status endpoint, which is restricted to cashier roles. Admission
returns the original outcome or refuses an existing unresolved claim before checkout
writes; this does not grant payment permissions. Explicit local rejection or recorded
payment evidence still blocks dispatch. Never-dispatched pending work does not accrue
recovery cooldown while waiting for dependencies. A rolled-back unsent claim restores
its previous cooldown together with its status and attempt count.

This closes the lost-before-admission transport case, not all partial checkout
failures. It does not take over abandoned processing claims, rearm rejected or
cancelled attempts, or replay reservations/inventory/finalization. Legacy incidents
still require reconciliation. No new migration is needed for this bounded protocol;
the existing durable-admission migration must be installed. Deploy matching server
and browser code before using the new metadata, and reload existing POS tabs.

Partial or mismatched receipts and incomplete legacy mutation records now return
`review_required`, not `not_found`. An absent usable result is not absent evidence.

### Device storage access failures

`POS_STORAGE_REFERENCE:DB_OPEN:INDEXEDDB` can originate from Dexie 4.4.4's
Safari readiness check: it reads the global `indexedDB` even when Dexie already
captured a native factory. The POS constructor now resolves the browser's native
factory on every handle creation, passes it explicitly to Dexie, and restores a
missing global alias from a vendor-prefixed or previously captured factory.
This uses the same origin and database name; it does not clear records, create
an in-memory substitute, or bypass an exception from a browser security getter.
If no factory is available, preparation reports `POS_STORAGE_UNSUPPORTED:DB_OPEN`
instead of a ReferenceError and does not admit checkout. Native open errors also
remain failures. Retrying can detect a native API that becomes available later.

`indexeddb-runtime-browser.test.ts` runs the production minified Dexie bundle in
isolated WebKit and Chromium. It verifies retained records and writes after
reopening with restored aliases, normal native access, and denial for absent,
restricted, or failing storage. This does not establish why a particular iPad
lost its global API or guarantee recovery when native storage is truly absent.

POS remains locked when browser storage cannot be prepared; it never falls back
to an in-memory payment queue. Storage errors display a fixed `POS_STORAGE_*`
diagnostic, not browser messages or private data. `OPEN` indicates an IndexedDB
open error, `QUOTA` a storage quota error, `DENIED` a security restriction, and
`TIMEOUT` a preparation that did not settle within eight seconds. These codes
identify the error category, not a confirmed device-level cause.

Diagnostics also include a fixed operation suffix such as `:PROBE`, `:DB_OPEN`,
`:OWNER_RESERVE`, `:PURGE`, `:OWNER_PUBLISH`, or `:SNAPSHOT`. For example,
`POS_STORAGE_TYPE:DB_OPEN` identifies a TypeError while opening IndexedDB,
not a quota error. `WRITE_UNVERIFIED` means a write could not be read back;
`EARLY_COMMIT` and `TRANSACTION_INACTIVE` identify transaction lifetime errors.
No raw exception messages, stacks, storage keys, or record values are displayed.
These diagnostics do not repair a device failure or authorize bypassing storage.

Temporary purge and snapshot handles have bounded waits. On timeout, Dexie's
pending open is closed and any active purge transaction is aborted so permission
serialization can accept a fresh retry. The database is never deleted/recreated
as a repair, and failed preparation never grants access. Same-scope rechecks
continue preserving unconfirmed drafts and receipts. Do not clear website data
or reinstall an app before reconciling pending orders/payments on the server.

Startup preparation probes localStorage writes and opens IndexedDB without
clearing records. Only after server identity and permission verification may
admission replace a missing or different ownership marker. It first writes and
reads back a pending object at the real marker key; this object is never accepted
as an online/offline grant. If that write fails, the old records are untouched.
A successful ownership transition performs one purge, not separate preparation
and admission purges, then publishes the verified marker. The same verified
scope does not purge. Legacy/unowned data is still not adopted by a new actor;
successful admission retains the existing ownership-isolation purge policy.
The write probe cannot guarantee that a later write will succeed if device
storage becomes unavailable mid-transition; such failures still deny access.

An empty `INITIAL_SESSION` notification suspends access and requests verification
without purging. Confirmed sign-out, a different authenticated actor, or an
authoritative permission denial still revoke access. These changes do not
provide an in-memory fallback when durable storage is unavailable.

The isolated IndexedDB permission tests exercise Chromium and WebKit when the
corresponding Playwright browser is installed; they do not reproduce every
iPadOS version or device storage restriction.

### Optimistic checkout interface

The payment modal closes after order/register preflight and durable local enqueue,
not after the full server checkout. A per-attempt notification says the order is
saved on this device and is being confirmed in the background. This is **not** a
paid/completed receipt. The queue shows processing, server-confirmed, or review
required states. Unconfirmed payments never publish a reduced cached balance or
completed order. Other customers can start a new cart immediately.

The original mutation, receipt IDs, and cart identity stay in the outbox. Pending
payments still block duplicate collection for that order and register closing.
Timeouts and ambiguous errors retain the attempt for **Check payment status**;
they do not recreate the sale. Storage/preflight failures leave the cart available
instead of reporting optimistic acceptance.
The blank cart snapshot is persisted before its local identity rotates; checkout
awaits this local cleanup before dropping the attempt alias. A failed reset keeps
the original payment fence across remount/reload while confirmation continues.

Receipt-specific confirmation and automatic printing can finish while the cashier
works on a different cart; they never clear, overwrite, or reopen that cart.
Printing requires a confirmed outbox result. Permission changes suppress old
notifications/printing. Concurrent observers of the same receipt share their wait
and printing, including retries after local cart cleanup fails. The durable queue,
rather than the notification, remains the recovery source after reload or
navigation. A response after the bounded wait
updates the queue through the existing worker; use the order's print action if
automatic printing was no longer observing that attempt.

Server finalization remains awaited and must finish before an attempt is marked
completed. Optimistic UI does not move financial, stock, or entitlement writes to
an untracked background task, nor does it enable offline payment collection.

Collected payments are never replayed blindly after a failure or timeout. The
queue's **Check payment status** action reads server evidence using the original
mutation and receipt IDs. It does not collect money, delete a queue entry, cancel
an order, issue a refund, or mark incomplete checkout as successful.

The queue offers status checks for both failed and syncing checkouts. Checks have
per-operation busy states: a slow lookup or global sync does not disable another
lookup, order review, or closing the queue. List loading and action waits in the
dialog expire after ten seconds with an actionable message; this only releases
the UI wait, never aborts checkout writes, deletes evidence, or releases worker
ownership. Storage timeouts offer **Refresh list**. Unconfirmed entries explain
why deletion and blind payment replay are unavailable. Other orders remain usable.

### Explicit resolution actions

**Cancel operation** is available from the queue and order review. It requires a
reason and explicit confirmation, then calls the authenticated same-origin
`/api/pos/checkout-cancel` endpoint. It cancels only the original checkout attempt,
not the order, a provider charge, or a refund. Server admission is atomically
fenced before the client marks the attempt rejected; evidence and audit history
remain. A late processing status read cannot undo confirmed rejection.
Rejected/cancelled attempts remain visible for audit but no longer count as active
sync errors or block register closing. They are not reported as paid/synchronized.

The local order selector filters a rejected creator draft only when every related
local attempt is also rejected and there are no recorded server order/sale links.
This also applies to legacy rows already rejected before this update: no hash
backfill is needed. Queue history is retained. An unresolved dependent payment keeps
the local draft visible. Selecting a stale rejected-only draft explains that it was
cancelled before creation instead of reporting a payment conflict. Rejected attempts
on an existing server order no longer block loading its freshly authorized snapshot.
Cancellation conflicts distinguish missing admission evidence from started/completed
writes; neither is presented as successful cancellation or removed from the selector.

Only the original authorized cashier can cancel an existing attempt still before
checkout writes (`processing`), or acknowledge one already `rejected`. Missing
legacy attempts, completed payments, `writes_started`, and `review_required`
attempts are refused: absence of receipts does not prove absence of side effects.
Those cases still require financial/fulfillment investigation; this change does
not introduce a force-cancel or replay partial checkout finalization.

**Register payment** in review requires a server-rejected/cancelled attempt and a
current open unpaid server order with complete lines. After explicit consent to
replace the current cart, it rechecks payment evidence, reloads the order, and
opens the normal payment form once the selected cart renders. The cashier must
confirm the payment method/amount there. Existing register, price, permission,
receipt-identity, and duplicate-payment guards remain in force. An attempt without
a server order cannot be restored using this action. Recorded/uncertain payments
remain blocked from replacement collection, with an explanation rather than an
unexplained disabled control.

The cancellation endpoint requires forward migration
`20261027190000_pos_checkout_cancel.sql` before use. Apply it only to an explicitly
approved target and deploy matching application code; missing RPCs fail closed.
Local implementation/testing does not resolve an affected production queue.

| Evidence | Local outcome | Other orders | Register closing |
| --- | --- | --- | --- |
| Completed checkout | Synced, restored result | Allowed | Allowed if all receipts settled |
| All exact receipts recorded, incomplete checkout | Failed, payment recorded/review required | Allowed | Blocked |
| Durable rejection before checkout writes | Failed, rejected for audit | Allowed | Allowed |
| Missing/partial/mismatched evidence or processing | Failed, review required | Allowed | Blocked |

An unresolved payment blocks further payment of that same order, even if a new
mutation ID is supplied. It never blocks unrelated orders or the entire POS.
A rejected attempt remains visible and immutable in the queue; a newly confirmed
attempt uses new mutation and receipt IDs. Review keeps
the original queue identity, including when no server order has been linked yet.

Offline continuity uses a local grant separate from remote admission. Receipt
creation and each new transport call recheck online permission after asynchronous
lookups; an offline fallback cannot create a new unresolved receipt. Unpaid sends
remain local. Remote admission has its own generation across disconnect/reconnect,
so retaining the cart does not authorize old requests to resume.

A submitted payment whose wait expires offline is retained as failed/review-required
with its original IDs, exposing **Check payment status** once access is verified
again. Its live mutation still owns its slot and must never be replayed. Explicit
success or rejection received after disconnect is persisted for the same local
scope; losing network access suppresses new requests, not receipt evidence. An
unsent claim restores its previous status and attempt count instead of pretending
a payment was submitted.
The authenticated, site-scoped order read remains separate from payment recovery:
refreshing order details is not proof of checkout finalization. **Check payment
status** reconciles the original attempt without replaying it. Only a verified
pre-write rejection can offer reloading an unpaid order for a new confirmation.
**Continue selling** returns to the POS without deleting or confirming the pending
operation. Use **New Order** for another customer; do not re-enter the ambiguous
payment as a new sale. Top-bar consumers can show diagnostic IDs without owning
the order-review callback.

Collected-payment confirmation synchronizes only its own outbox item and required
local dependencies. It does not wait for unrelated failed payments, catalog pulls,
or the full background queue to drain. Background and foreground work share a
per-row in-flight slot; a timeout is not permission to send a second checkout.
Browser evidence reads use the authenticated, read-only `/api/pos/checkout-status`
transport with a bounded wait, outside Next.js's serialized Server Action queue.
This keeps a slow recovery lookup from holding subsequent checkout actions.
Checkout writes, local-customer creation, order reads, and cash-register operations
also use the authenticated same-origin `/api/pos/operation` transport, outside that
dispatcher. Read-only requests have an eight-second deadline including response
decoding. Checkout mutations are never aborted or retried by the transport: the
existing 45-second outbox wait retains ownership until the real request settles.
New unpaid sends (including splits) start only their own queued operation and
dependencies, without waiting for old background work. Splits enqueue new customers
locally instead of calling a Server Action before saving the orders.

Payment admission uses the site Web Lock only until the receipt is durably queued.
Confirmation runs outside that lock; the pending row still prevents closing the
register or collecting that order again. Waiting to acquire the lock expires after
eight seconds without running the queued callback. An acquired lock is not stolen
while a write may commit. Closing checks existing receipts without draining the
background queue under the lock. Resolve pending receipts explicitly before closing.

The processing indicator belongs to the selected cart/session, not the whole POS.
Selecting **New Order** can start another customer while an old confirmation waits;
a late response cannot clear the new cart or unlock its active submission. A cart
changed while waiting for register admission is checked again before enqueueing.

When online, selecting a local pending order resolves only its original unpaid
checkout and dependencies, then loads the current server order before accepting payment. It
does not create a replacement order or accept local totals as payment evidence.
Uncertain collected payments, missing evidence, and rejected attempts still require
review. Server snapshot and inventory validation remain mandatory at confirmation.

Offline selection (browser connectivity or a restored offline permission lease)
takes precedence over pending or in-flight synchronization,
including forced refreshes and connection loss during selection. It opens the
device's saved snapshot or reconstructs a legacy summary from the original queued
checkout and cached catalog, without dispatching or changing queue entries.
Missing local data, revoked access, and foreign-site data still fail safely.
Local line placeholders are not server IDs, and reconstructed snapshots are not
server order versions or proof of payment. Payment collection continues to require
verified online access; opening the ticket offline does not confirm a receipt.

Queued-cart reconstruction preserves each host/modifier currency separately:
new lines use catalog currencies, while persisted references require the saved
server order currency. It also restores reservation start/end times and existing
or queued customer identities without creating replacement customers. New local
summaries retain the applied promotion preview. Legacy summaries restore only
the originally requested promotion from the local catalog, with current local
eligibility checks; missing or invalid promotions stop selection rather than
silently remove the discount. Server-side promotion validation remains mandatory.

New queued payments retain their cart-session ID outside the server payload.
Changing a payment in the same new-order cart cannot evade the unresolved-payment
guard. A deliberate **New Order** rotates that identity while preserving previous
attempt aliases and queue entries, so an identical basket for the next customer
is not mistaken for an old retry. Legacy entries retain conservative matching
until that explicit new-order boundary.

Do not clear IndexedDB or browser storage to recover a register. Do not collect
again merely because checkout returned an error. Existing refunds remain separate
financial actions; recovery does not invent a refund or reverse accounting.

## Server boundaries

The checkout-status route and `app/pos/actions/reconcile-checkout.ts` share request
validation and authorization. Each boundary authenticates and
requires an authorized POS role and unrestricted location access before using a
server-only, read-only service client. Receipt verification checks the original
actor, site, shift, IDs, amounts, methods, tendered/change, and linked order. A
client-provided total or tenant ID never proves payment state.

The operation route additionally requires JSON with a bounded body and a matching
browser Origin, validates its operation-specific input, and independently checks
POS/site/actor access before invoking the existing authorized server workflows.
Checkout references are checked against the authorized site; selected attribution
does not grant authority. Responses are non-cacheable and errors are sanitized.
This transport change requires no additional database migration.

The forward-only migration
`20261022140000_pos_checkout_attempt_recovery.sql` introduces server-owned durable
admission and guarded transitions. The same identity/payload cannot be reassigned;
one unresolved attempt per existing order is admitted. An expired/abandoned
attempt is not automatically considered unapplied. Post-write failures enter
review rather than restarting checkout.

For collected payments on existing orders, a service-only commit RPC applies
server-calculated sale/order patches, captures register receipts through the
existing trigger, and links the attempt in one transaction. It locks rows, checks
complete expected sale/order snapshots, reauthorizes the admitted actor, and
rolls all writes back if either update fails. New-order creation still uses the
existing persistence path, protected by durable admission; it is **not** made
fully transactional by this change.

Kitchen progress alone no longer invalidates the payment baseline. Cancellations,
prices, quantities, payment evidence, attribution and notes still do. Notes are
retained in the baseline to prevent lost instructions. Unpaid partial payment
does not regress a completed kitchen order to pending.

## Limitations and recovery of legacy incidents

Legacy attempts have no durable admission. Exact receipts can establish recorded
money; missing receipts cannot establish that an old request never ran. Legacy
receipts with no stable UUIDs require manual financial review. A recorded receipt
does not prove that reservations, promotions, stock, subscriptions or entitlements
all finalized. This change deliberately does **not** replay those effects or
automatically mark such an attempt completed. Repair demonstrated missing effects
through authorized workflows before closing the affected register.

Checkout's broader finalization is not a fully transactional/idempotent saga.
Concurrent non-checkout order-line writers remain a separate boundary; snapshot
validation and admission do not replace a global order-edit transaction protocol.
The browser queue check covers the current device, not every cashier's device.
Collection still requires an authorized session, connectivity, a valid open
register, and current order validation. Separating sync errors is not an offline
payment protocol. Catalog and other existing Server Actions still use the
framework's serialization behavior, but they are no longer the transport for POS
checkout, customer dependencies, order verification, or register operations.
Storage failures, unavailable backend services, revoked permissions, and an
actually closing register are not bypassed by sync isolation.

## Checkout performance diagnostics

`/api/pos/operation` returns a `Server-Timing` header with fixed metric names and
durations only (no customer data, tokens, payloads, or order IDs). Inspect it on
the checkout request in the browser Network panel. `pos_total` covers operation
execution; `pos_auth` and `pos_references` cover HTTP admission. Checkout phases
separate authorization, admission, environment, attribution, lines, records,
finalization, and durable completion. Early returns report only reached phases.
These are measurements, not fixed delays or payment confirmation evidence.

POS site authorization and its authenticated client are reused only inside the
current server-created operation scope. Separate HTTP requests and direct Server
Action calls still authorize independently; clients cannot supply a trusted
authorization result. No cross-request permission or price cache is introduced.

Product/modifier metadata and inherited reservation modes are read in tenant-scoped
100-ID batches. Price resolution is deduplicated by SKU and limited to eight
concurrent resolver calls; the authoritative price resolver, overrides, channel
eligibility, and currency rules remain intact. This removes repeated metadata
round trips and serial price waits, but is not a single bulk pricing RPC.

Finalization also batches inventory-tracking metadata. Stock quantities are not
cached or parallelized: repeated products must observe the preceding decrement.
Order-item writes remain ordered to preserve parent/modifier relationships and
failure behavior. Broader atomic inventory writes and transactional finalization
remain separate work; these optimizations do not claim to solve those existing
concurrency limitations.

## Rollout and validation

### Production rollout, 2026-10-22

The application deployment for commit `cb13babe` reached Ready on the workspace
production domain. The Management API applied the forward correction and recorded
version `20261022201051` (`complete_pos_checkout_recovery`). The local filename
matches that server-assigned version; the applied SQL is unchanged. The original
`20261022140000` migration is not recorded remotely because older admission objects
were already installed outside that history. Do not replay it against this target.

Post-application checks confirmed the eight-argument RPC is visible in PostgREST,
the obsolete six-argument overload is unavailable to API roles, and RLS/table/RPC
grants remain server-only. No historical order or receipt was changed. POS browser
tabs must reload to retire the old action bundle. The informational
[RLS-without-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
for the attempts table is intentional: browser roles have no grants and only the
authorized server workflow can access admission evidence. These checks are not a
live paid checkout test or proof that the affected device's queue has reconciled.

1. Review/apply the complete migration to the explicitly approved target using the
   established migration workflow. No backfill, historical receipt edits, or
   automatic legacy voids are included.
   For partially installed admission objects or the obsolete six-argument commit
   RPC, use `20261022201051_complete_pos_checkout_recovery.sql`. It validates the
   existing table, preserves attempts, installs the snapshot-aware commit, and
   revokes API execution of the obsolete overload without dropping it.
2. Deploy matching server and browser code, then reload POS tabs to retire old
   replay loops. Stop old in-flight checkout requests before targeted incident repair.
3. On the affected device, choose **Check payment status**, then **Review order**.
   Recorded-but-incomplete attempts still need manager review before closing, but
   must not prevent other orders from being paid.

Missing migration/RPCs fail closed. Do not deploy browser/server changes without
the migration. Local tests never use a remote database or live payment provider:

```bash
npm test -- --runInBand __tests__/pos __tests__/commerce/checkout-finalize.test.ts
npm run typecheck
```

`__tests__/pos/checkout-attempt-postgres.test.ts` executes admission, replay,
concurrency, authorization, atomic receipt persistence and rollback in a new
socket-only PostgreSQL cluster using the existing isolated test harness.
`__tests__/pos/payment-math-postgres.test.ts` reproduces the rejected floating-point
cash change and verifies new rounded cash/split entries against the unchanged
receipt trigger. The checkout-status client, route, and scheduling tests cover
bounded read transport, authorization, and continued checkout during a hung
recovery request. No additional database migration is required for sync isolation
or the cash-entry correction.

`checkout-http-isolation.test.ts` exercises the real browser transport, payment
preparation, and queue worker against an isolated HTTP adapter while background
actions and an old checkout hang. It checks independent collection, bounded
register reads, retained receipt identities, no timeout replay, and late success.
Operation route/client tests cover origin/auth/tenant validation and response
contracts. These tests do not perform a live payment or deploy the new route.