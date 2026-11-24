# Workspace startup and bounded read-only previews

## What runs on a workspace screen

Pending workspace/access checks render non-interactive skeletons with an
accessible busy state, not visible verification or loading messages. Once
authorized preview rows arrive they can be shown read-only. Denial, missing
selection, timeout and recoverable failure remain explicit, not an endless skeleton.
On the compatibility path, settings, the selector and the capability read may
finish in different orders. Pending checks do not report a verification failure;
a failed capability read or its eight-second timeout offers a fresh access check.

The workspace shell resolves an actor-bound selection. A local name or ID is a
presentation hint, **never** authorization. Navigation and UI capability hints
share one authenticated `read_workspace_screen_scope` response per actor/site and
explicit invalidation. On a verified modern installation, the permission provider
does not also call `get_my_site_capabilities` just to derive the same role flags.
RLS, fresh Auth where required, route/action authorization and specialized
capability/revocation checks still run. A transient RPC failure is not permission.
Only a missing RPC enables the old navigation/capability fallback; it cannot
start an early private read. Public/commerce and demo providers are separate.

The [preview registry](../app/workspace-preview/routes.ts) is an **exact URL and
screen-key allowlist**, not an exception for arbitrary SWR keys. A normal, fast
hydration makes zero preview calls. When required configuration is still loading
350 ms after the selected screen has been verified, the UI may request up to 12
display rows for that screen. It does not prefetch other modules. These are real,
user-scoped reads, not fake rows, global tables, totals, or a substitute for the
filtered/hydrated list. Some operational projections need their own Auth, role,
location, date-window or ownership checks before reading any rows. Quotations
uses the existing secured mixed sales/procurement RPC, not a direct table scan.

An early projection never mounts the normal page or its toolbar actions. It cannot
navigate to a row, start a workflow, charge a customer, download a document,
subscribe to realtime, or mutate data. It is discarded on navigation, account/site
change, scope invalidation or hydration. Underlying reads are aborted where the
SDK supports it; even uncancellable late completions cannot publish. A five-second
deadline and explicit retry bound the visible wait without retrying every screen
on focus or on a timer. No preview payload or permission is persisted. The preview
may add a small separate read on slow startup; it never seeds an incompatible full
list cache. Returning to the conversation inbox under the same actor, site and access
proof shows the cached list for that filter and search while page one revalidates.
The workspace keeps these rows only in memory. A new proof starts cold, even if
it grants the same role, and a denied list read retires the other cached views.
On desktop the cached rows do not choose a thread: automatic selection waits
for a successful page-one response for the current visit and filter. If the
legacy selector fails with an unchanged membership proof and selected site,
already loaded rows remain visible without list reads, navigation or actions.
Retrying the directory does not itself restore access to those operations.

## Coverage and deliberate exclusions

| Area | Preview-enabled destinations | Kept on the original full-authority path |
| --- | --- | --- |
| CRM, marketing and content | Leads, Deals, Tasks, Campaigns, Segments, Assets, Content, Promotions | Filtered deep links, edits, publication, contact or campaign mutations |
| Catalog and operations | Catalog, Modifier Groups, Price Lists, Orders, Order Lines, Reservations, Shipments, Inventory levels, Movements and Transfers | POS/checkout, check-in, inventory minimums, order processing, reservation changes and detail pages |
| Documents, automation | Quotations, Records (collection names only), Requirements, Agents and the exact `/robots?mode=workflow` instance list | Robot execution, bare Robots and Imprenta, approvals, prompts, files, account credentials, quote submission |
| Buying and subscriptions | Suppliers, purchase requests, procurement tenders, vendor bills (title/status) and customer subscriptions (plan name/status), using their module-specific admission | Payments, balances, subscription changes, purchase orders, sealed quotations, approval queues, policy editors and the company entitlement library |

Other screens still benefit from lighter shared startup even when no private
preview is appropriate. Reports, accounting, balances, settings, public shops,
buyer portals, access-token/artifact flows, and editors keep their own logic.
New registrations require reviewing the actual page's data contract, filters,
backend admission and row policies. Never authorize a form, service-role read or
unknown screen from the generic proof.

There are **28** registered lists plus the independent Conversations inbox. The
three newest lists perform fresh actor and module checks. Order Lines keeps its
date window, parent order/item and location constraints; Bills and Subscriptions
omit the trailing timestamp group if its order cannot be guaranteed at the limit.
Sales does **not** push its client-side date filter into a preview of the database:
that could surface rows outside the normal capped list. Experiments and Copywriting
have no independently verifiable navigation key and are not registered.

## Request reductions

Real workspace selections (cached, restored from the list, or explicitly picked)
require a full user-scoped settings read. A successful row and a confirmed zero-row
response are distinct; a transport, permission or cardinality failure clears the
operational selection and leaves only a target for recovery or an independently
verified preview. Resource-change events do not manufacture settings on directory
rows. Re-selecting a project cannot treat partial channel data as its currency,
shop or printer configuration. Refreshing the same active site does not repeat a
completed settings read just to update the selector.

The notification inbox shows an empty result only after its scoped GET succeeds.
During a refresh of the same inbox, including a settings sync for the same
verified workspace, it keeps the last result visible with row actions disabled.
A cold inbox still waits for settings. Losing the selection or its proof retires
the displayed result; returning to the inbox does not reuse another site's rows.
When verification or settings fail, retry the failed prerequisite rather than
fetching messages without it. A timed-out preview whose Auth request has not
settled offers an explicit page reload, not an ineffective retry. A normal retry
becomes available after settlement; neither path automatically replays writes.

* Workspace SWR waits for hydration as before. When it resumes, observers of one
  unchanged key share one in-flight revalidation in the actor's own cache. Keys
  that first become active at hydration use SWR's normal initial request instead
  of also forcing a refresh. Tests reproduced **two requests before, one after**
  for both cases. This does not deduplicate writes or suppress a pending denial.
* Desktop and mobile no longer both start shortcut queries. Hidden desktop
  widgets and badges do not start on mobile; the selector's bounded list-retry
  and existing keyboard shortcuts remain available. Setup progress is counted
  from the selected settings read, not another query. The raw task map is not
  copied into editable settings or saved to the browser.
* A closed project selector does not fetch the workspace directory's logos.
  A visible project list decorates only its missing IDs (up to 50 per request).
  The logo endpoint authenticates once, verifies unrestricted location, limits
  candidates to owners or active, non-suspended members, and reads non-archived
  sites with user RLS. It no longer enumerates every project under a service key.
  Results are bound to the server actor and list in memory; no site-only logo
  database is consulted. Logo failures leave initials, not missing project cards.
* Only the notification inbox loads notification bodies. A visible sidebar
  badge waits before requesting only its unread count; it reuses the list in
  the inbox and makes no request when absent. The count uses the same newest
  page (up to 1,000 rows) as the inbox, not a larger all-history total. Both
  reads verify membership and location and filter on the server's own actor.
* On the normal Reports and Costs screens, the segment and campaign directories
  load when their filter is used (or a deep link already needs that dictionary).
  Local cold-start tests went from **1 to 0** option queries on Dashboard and
  **2 to 0** on Costs; the date-policy and report calculations still run.
* The Sales index embeds its nullable same-site segment label in the sales read
  and defers location options until needed: **3 to 1** initial list/option calls
  in the regression test. Payments uses the root workspace provider instead of a
  second nested one: **one** selector and settings request each instead of two.
  Its payouts, payment operations and credit history still load for the ledger.
* Procurement reads reference and quotation options on demand. A purchase order
  mounts a receipt form only for the selected order; the approvals inbox mounts
  review detail only when selected. Service estimates share their tax choices,
  replenishment selectors share saved labels, and inactive tender/supplier
  panels no longer start those reads. Closing/switching retires in-flight GETs;
  the API/RPC still decides every approval, receipt, bid and other write.
* Settings keeps an already hydrated form mounted. Collapsed Activities editors
  skip mining-list/segment options unless a saved rule needs validation. The
  Shop hero's scroll and URL modes no longer load categories and a page of up to
  1,000 catalog items; category and item modes request only the relevant choices.
* Repositories skip database log enrichment and tenant-link reads when there are
  no visible requirements. Responsive layout changes do not remount the initial
  Applications list. Marketplace cards share their manager-only connection read;
  inactive integration tabs do not load webhooks. Finder coalesces its initial
  session notification without skipping later permission refreshes. Skills loads
  only the active tab's code after site hydration.
* Visits waits for a valid kiosk identity/contact before requesting its four
  resource lists. POS manual receipts reuse the seller label already restored in
  the active cart instead of rereading the entire IndexedDB cart session. This
  removes a device read, not a Supabase authorization check. Check-in, offline
  reconciliation, trusted pricing, checkout and the ledger remain authoritative.
* Basic site details such as the logo are not required workspace settings.
  Settings may release the normal gate without waiting for those optional details.
* Toolbar creation dialogs on Leads, Content, Campaigns, Requirements and
  Experiments make no segment/campaign option requests until opened by mouse or
  keyboard; New Task likewise defers its lead, assignee and calendar choices.
  The Experiments index no longer reads separate creation directories at all; it
  keeps its embedded segment labels and batches only the campaigns referenced by
  the visible experiments. Ordinary settings/logo updates do not restart the list.
* The campaign list embeds subtask, segment and requirement relations in **one**
  user-scoped request instead of one plus three per campaign. The table does not
  load the Kanban requirements payload. Content reuses selected-site publishing
  settings rather than downloading the complete settings row again.
* Control Center defers lead/member filter options until the picker is opened. Lead
  assignee labels use batches of up to 50 profiles with no per-person Auth fallback.
  Read-only profile display uses RLS, never calls Auth with a profile UUID and
  does not retain names in an actor-independent module-level cache. The normal
  Content index verifies its actor, effective membership and location guard then
  reads `content` with the user client, not privileged credentials.

## Validation and release

Run `npm test -- --runInBand __tests__/workspace-preview` and `npm run typecheck`.
Additional regressions cover site/selection races, permission invalidation, POS,
control-center filter options, content hydration and navigation. Tests exercise
real React/SWR and Supabase SDK query builders with isolated transports. They
do not establish a production latency percentile or replace a staging browser run.

Local extension verification: the combined 169-suite regression run passed 1,882
of 1,887 tests. Five existing presentation expectations failed: the dashboard
breadcrumb on leaving reports, the mobile navigation tab height, two procurement
toolbar positioning expectations and a procurement detail loading label. Type
checking and diff whitespace validation passed. This is not a full repository
test run or an owner/restricted-account sign-off in staging.

The [screen-scope migration](DATABASE_MIGRATIONS.md#workspace-screen-scope-local-only)
from the inbox rollout must be applied separately with approval before enabling
early reads. No new cross-user permission cache or independent service-role fast
path is required. In staging compare fast/slow hydration, time to first usable row,
queries per screen, denial and account switches for both owners and restricted
members. Monitor selector `503` stages and actual database timeouts after release.

### Staging acceptance checklist (not production measurements)

| Exercise | Expected result |
| --- | --- |
| Open a registered root with fast settings | Normal list and actions after admission; zero preview GETs. A closed filter, dialog or project menu must not start its auxiliary reads. |
| Delay only settings beyond 350 ms | At most one projection of the active screen after proof, at most 12 inert rows, no finance totals, approvals or mutations. Hydration restores the real filtered list. |
| Deny the screen, revoke membership, switch sites, sign out or switch accounts at the same site | Old rows, options and pending actions disappear; a late read cannot restore them. Re-run with both a restricted member and an owner. |
| Force a selector 503, then restore the dependency | A retry recovers the list; no invented workspace, data or purchase defaults. Record `X-Sites-Timeout-Stage` and `Server-Timing` without tokens or customer rows. |
| Open/close auxiliary UI and repeat on mobile | Only the visible UI requests its data. An open failure allows a read retry, not a replay of a charge, approval, receipt or robot run. |

For before/after comparisons, keep actor, site, route, filters, cache state and
network profile the same. Record Auth calls and first **authorized** row separately
from first **interactive** row; compare p50/p95 for each and distinguish failed
loads from slow successes. Keep unrelated Leads and connector changes out of the
rollout unless they have their own review and migration approval.