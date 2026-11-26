# Architecture

## Runtime overview

### Selected workspace recovery

Workspace clients request `/api/sites?view=selector`, not the legacy enriched
response. The selector path does not query billing or tracking/details. Auth and
the existing unrestricted-location gate are freshly verified once per request;
only then may a server-only client read the actor's own/licensed-member list.
The redundant ownership lookup is removed. Ordered, count-checked pagination and
bounded ID batches (at most three concurrent batches of 100 IDs) reject failures or incomplete results rather than publishing a
partial list as a revocation. Ordinary Auth outages return 503, not logout/401.

The existing `REDIS_URL` transport caches only basic selector metadata for 60
seconds, scoped by Supabase environment and authenticated actor. Redis commands
have a 250 ms budget; missing/broken Redis falls back to the database. In-process
pending requests for the same scope are coalesced, with independent result copies.
An ordinary lookup can join an in-flight authoritative fill. A fresh request does
not reuse an earlier cache-miss scan: it supersedes that scan, and process-local
write ordering keeps its replacement from being overwritten by the older fill.
This is not a distributed lease or cross-instance ordering guarantee.
There is no role, billing, settings, credential or mutation authorization in Redis.
Hits are marked `authoritative: false`; `fresh=1` bypasses the cache for current
membership reconciliation. A cache miss reads the complete list before writing.
Membership/site changes may remain visible as presentation hints until fresh
revalidation (at most the 60-second Redis entry lifetime for cache-only callers).
No cross-service invalidation or instant revocation of cached labels is claimed.

The browser publishes a cache hit immediately. Versioned Redis entries retain
their original scan-start timestamp and return the remaining freshness budget; a hit does
not extend that budget or trigger a DB query. Settings hydration does not renew the
budget. One `fresh=1` read runs at expiry,
unless a newer load, selection or auth change cancels it. Missing selected IDs,
explicit refreshes, and local site/settings mutations revalidate immediately.
Cached absence never revokes the active selection. Retiring a generation aborts selector HTTP and releases pending
load deduplication; settings responses still use guarded publication. Active-site
billing is loaded separately under user-scoped RLS, including explicit site
switches, without gating POS. That read retains its own eight-second transport
deadline and cannot publish into a retired user/site selection. Financial data is
not fabricated from the metadata cache; unavailable markers remain explicit.

Billing reads use latest-started ordering per site, rechecked inside deferred React
setters. A newer failed read also retires older results. Weak request tokens avoid
retaining a permanent per-site registry. An empty RLS read does not prove absence:
the reader calls the read-only `/api/billing/presence?site_id=...` endpoint, which
validates UUID input and current membership/location access before a minimal
service-role existence read. Only a confirmed missing row publishes `missing`
and exposes the existing billing setup action; hidden rows, errors and denials
remain unavailable. No credits are granted by this read. The presence endpoint
has a six-second response deadline within the client's eight-second read budget.

The route has an 8-second response deadline; cache-fill database transport has a
5-second deadline and is independent of any single coalesced caller disconnect.
`Cache-Control: private, no-store` prevents shared HTTP caching. `Server-Timing`
reports auth/location/list/total and performed Redis I/O timings. `X-Sites-Cache`
reports hit/miss; `X-Sites-Cache-Reason` distinguishes bypass, unavailable/disabled
Redis, expired/invalid entries, empty cache and coalesced work.
`X-Sites-Timeout-Stage` identifies the stage active at the eight-second deadline.
Selector 503s also log the last measured/timeout stage and timings without request identifiers or payloads.
None contain tokens, keys, actor IDs or customer payloads. Authentication and the
location gate remain fresh and sequential, even on a cache hit. The legacy enriched endpoint remains for
compatibility and is not stored in Redis.

The browser keeps a 24-hour, actor-bound identity hint in `mf_site_selection_v1`,
matched against `currentSiteId`. It excludes settings, credentials, billing and
roles. After resolving local session identity, `SiteProvider` can restore this
hint and hydrate the selected site's settings independently of the full sites
list. Initial auth-triggered loads share the same pending request.

An auth event takes precedence over an older pending session read. Foreign-actor
cache hints cannot select a shared workspace via a later successful list. List
authentication retries run inside the original load generation and deadline,
independently of pending settings; they do not re-enter hydration deduplication.
The sidebar never selects the first workspace automatically: a missing or revoked
selection requires an explicit choice in `/projects`.

The sidebar can show a **name only** from an unexpired same-account hint while the
saved selection is synchronizing or temporarily unavailable. It does not load a
cached logo URL or mount switching/creation actions from that hint. A confirmed
denial/removal or account change retires it; a manual retry requests a fresh list.
Once hydrated, its menu distinguishes an unavailable list from zero matching projects and
offers retry/picker navigation. Missing-list recovery retries after 15, 30 and 60
seconds (three automatic attempts), on reconnection, and on explicit menu opening
or retry. It stops when the list arrives or the actor/site scope disappears.
Only an initialized, non-loading selection with an empty list may bypass refresh
prevention for this recovery; same-site settings and POS state remain mounted.

Successful settings hydration releases the workspace loading gate even while the
list is pending. List failures and deadlines preserve the hydrated selection;
successful removal, repeated authentication denial, location denial, sign-out and identity changes
invalidate it. Late responses cannot republish a retired scope. The list is not
reported as loaded until it actually succeeds, preventing empty-list redirects
during recovery. A fresh browser or expired hint still requires the normal list.

`/projects` retains its current actor's in-memory cards during revalidation or
settings hydration, showing a skeleton only while no displayable rows exist.
The settings selection gate and automatic redirect still wait for hydration.
Refresh failures remain visible; confirmed 401/403 denial retires parallel
hydration before clearing the list. No project-list browser persistence, stale
authorization, or automatic mutation retry is introduced.

This cache is not authorization or complete offline startup. Settings remain a
network dependency and failed recovery does not supply invented checkout defaults.
POS waits for settings hydration and retains its independent permission checks,
local snapshot restrictions and server-side mutation authorization. No payment or
mutation is automatically retried by site recovery.

### Independent conversation list

The inbox and [reviewed workspace lists](WORKSPACE_SCREEN_STARTUP.md) may read while settings synchronize.
The target is an account-bound site identity, not a grant from local storage.
Navigation and capability hints share one user-scoped `read_workspace_screen_scope` RPC. It
checks effective membership/license and archival, the current user's blocked
screens and global location restrictions. Only a matching, non-anonymous actor
and allowed scope may start early. Each data read still uses the user's JWT and
table RLS. If the RPC is **missing** during rollout, the old navigation lookup may
run, but the list must wait for the selector and settings; other RPC errors never
fall back to broader access. A transient settings failure preserves the read
target, not an operational workspace for payments, settings or other modules.

The provisional list has no row actions, auto-selection, realtime or pagination.
Scope loss retires the list's memory cache; completing hydration does not refetch
page one. The normal first page reads at most 21 candidate rows across the two
status groups for a 20-row page; it skips the previous exact count. Lead labels
reuse the RLS embed and assignee profiles use one batch, never an Auth lookup by
assignee. Task and initiation filters keep their existing bounded history windows.
List failures expose retry separately from confirmed empty and denied results.

Successful member/access edits invalidate the in-memory screen snapshot in this
tab and, best effort, other same-origin tabs. Notifications never carry grants.
No persistent permission cache, global revocation broadcast, service-role shortcut
or Supabase outage immunity is implied. See the [local-only RPC and release gates](DATABASE_MIGRATIONS.md#workspace-screen-scope-local-only).

Regression coverage: `__tests__/context/site-selection-cache.test.ts`,
`__tests__/context/site-background-refresh.test.tsx` and
`__tests__/pos/pos-page-access.test.tsx`. Race and real-sidebar integration cases
are in `__tests__/context/site-recovery-races.test.tsx` (including StrictMode).
Selector API/cache/transport regressions are in `__tests__/api/sites-selector.test.ts`,
`__tests__/lib/sites/selector-cache.test.ts`, `__tests__/lib/sites/list-accessible-sites.test.ts`
and `__tests__/context/site-selector-lifecycle.test.tsx`. These are offline tests,
not evidence of deployed Redis configuration or measured production latency.

Makinari is a Next.js 16 App Router application using React 19 and TypeScript.
The same repository contains the authenticated workspace, public storefront and
document surfaces, route handlers, Server Actions, Supabase migrations, and
automated tests.

Primary external boundaries:

- **Supabase** provides PostgreSQL, authentication, storage, and Row Level
  Security (RLS).
- **Stripe** handles subscriptions and commerce payments.
- **External API server** handles robot orchestration and selected integrations.
- **Cloudflare and Vercel** support deployment and custom-domain workflows.

### Workflow execution debugging

The Robots file viewer loads historical `write_cloud_file` receipts independently
of the chat's visible log window. The user-scoped query filters by instance, site
and tool, selects only receipt fields, and pages in batches of 500. A separate
SWR key deduplicates background reads; the existing chat cache supplies live
receipts without another realtime channel or polling. Discovery keeps the highest
revision per distinct file and exposes read-only file tabs through the existing
authenticated archive viewer. It does not fetch archive contents until opened,
persist synthetic artifacts, or infer repository/database capabilities from files.

Robots treats `should_reload` as a publication hint. Refetching the same
artifact row must not remount the iframe. A Leads artifact with a `segment_id`
query parameter scopes the list, search, counts, and Kanban page requests to
that segment within the current site's existing RLS boundary.

Temporal execution metadata supersedes the former per-activity `cron_status`
debugging view. The unused `ActivitiesView` component and `/api/cron-status`
endpoint are retired; do not reintroduce a parallel activity status API for this
purpose. The historical database table is retained pending verification of any
external consumers. Its removal is not part of the frontend/API retirement.

## Repository map

Public tender routes use the same name-derived site slug as Shop, via
`app/book/site-slug.ts`. `app/tenders/site-identity.ts` reads only enabled,
non-archived portal identity on the server. Legacy portal UUID URLs redirect to
the readable URL; the stored portal slug remains the input to the RLS-scoped
`public_procurement_tenders` RPC, preserving publication visibility checks.
Public DTOs include the display name, including directories with no publications.
Identity enrichment uses one batch for the RPC's bounded result set and never
serializes site settings, ownership, or contact details. Name-collision behavior
matches the existing Shop resolver. No database migration is required.

- `app/` — routes, layouts, route handlers, Server Actions, and feature code.
- `app/components/` — shared application components.
- `app/commerce/` — checkout, entitlement, settlement, and post-payment logic.
- `app/api/` — HTTP boundaries. Every route must perform its own validation and
  authorization.
- `lib/` — cross-feature utilities, Supabase clients, authorization helpers,
  and shared types.
- `supabase/migrations/` — ordered database and authorization changes.
- `__tests__/` — Jest unit, integration, regression, and source-contract tests.
- `tests/` — Shiplight YAML E2E tests and agent verification fixtures.
- `specs/` — test specifications and generated coverage artifacts.
- `scripts/` — local operational and test-support scripts.
- `public/` — static assets only; never place secrets or internal docs here.

Prefer colocating feature-specific code below its `app/<feature>/` directory.
Move code to `lib/` only when it is genuinely shared across features.

## Request and authorization boundaries

`middleware.ts` re-exports the canonical implementation in
`app/middleware.ts`. Middleware refreshes browser sessions and protects page
navigation, but it deliberately skips authentication for `/api/**`.
Consequently, every API route is an independent security boundary.

Use these client patterns:

- `createClient()` from `lib/supabase/server.ts` for user-scoped server work.
  It carries the authenticated session and relies on RLS.
- `createServiceClient()` or `createServiceApiClient()` only in server-only code
  after identity, tenant membership, and operation-specific authorization have
  already been verified.
- `requireSiteAccess()` from `lib/auth/api-site-access.ts` for authenticated API
  routes that operate on a supplied site ID. Use `requireManager: true` for
  owner/admin operations.

The service role bypasses RLS. It is not an authorization mechanism, and a
successful login is not proof that the user may access a requested site.
The mutation guard in `lib/permissions/mutation-guard.ts` improves UI behavior;
it is not a server authorization boundary. Demo clients and `demo-*` IDs are
also not evidence of permission.

Prefer the client family under `lib/supabase/`. A second legacy family remains
under `utils/supabase/`; do not introduce another client wrapper or mix cookie
APIs without first consolidating the affected path.

## Display language preferences

`app/providers/AccountLocalizationProvider.tsx` loads the signed-in workspace
user's `profiles.language` through the session-scoped browser client and RLS.
Its SWR cache key includes the account identity and never retains the previous
account's data while switching users. Profile reads have a ten-second deadline.

Workspace priority is the saved profile language, the account-scoped browser
selection (`makinari-locale:user:<userId>`), the site's `settings.default_locale`,
and then the browser language. An explicit selection applies immediately; a
successful profile preference save updates both the active UI and the profile
cache. Failed saves do not alter the active language. Other tabs revalidate the
profile when the account's locale storage key changes.

Public storefronts retain the visitor's legacy `makinari-locale` storage/cookie
preference before the site/browser fallback. Workspace preferences neither read
nor overwrite that public cookie. Regional codes such as `es-MX` are normalized
to supported languages. Locale and messages are derived together so there is no
render with a newly selected language and the previous language's translations.

`app/context/locale-catalog.ts` combines the legacy dictionaries with Spanish
workspace overlays under `app/context/locales/workspace/`, screen overlays under
`app/context/locales/screens/`, and feature overlays under
`app/context/locales/commerce/`. Commerce overlays cover English,
Spanish, French, German and Japanese and take precedence over legacy copy without
changing the workspace fallback policy. The document translator reuses this
catalog while retaining its English/Spanish public contract. Both marketplace
language selectors expose the same supported languages. Country display labels
are localized separately from canonical filter values; changing language does
not change the selected country, prices, dates or checkout currency.

`__tests__/context/commerce-locales-contract.test.ts` checks commerce keys against
each language's own dictionaries, without English fallback, including dynamic
category/sort maps and retail/service checkout labels. Feature key sets and
interpolation parameters must remain identical across all five languages.

`rawLocaleMessages` exposes own-language coverage without fallback. Workspace
regressions check English/Spanish references and explicit overlay registration.
See [Localization coverage and repair](LOCALIZATION_AUDIT.md) for the reproducible
audit, translated surfaces, and remaining hardcoded legacy UI. Zero missing
dictionary entries does not imply that all UI text is connected to the catalog.

## Password recovery navigation

`app/auth/confirm/page.tsx` verifies recovery tokens only after a user click,
then routes the established session to `/auth/set-password`. Recovery must take
precedence over the `password_set` metadata check used for normal sign-in:
having an existing password is not a reason to skip resetting it. The validated
post-auth destination is carried as `returnTo` for use after the password update.
Invalid tokens and missing sessions must not navigate to the password form.

## Settings save lifecycle

Settings writers persist through the user-scoped Supabase client and publish the
merged row to site context. Section handlers must not call `updateSite` to
"refresh locally": it performs another database write. Combined site/settings
saves omit settings from the first write and pass `{ syncVoiceAgent: false }`;
the following settings write requests one resync after both writes succeed.
If the site write succeeds but the settings write fails, the combined-save helper
requests a resync for the already-persisted site changes and preserves the original
save error. Demo saves remain local and never request provider synchronization.
If that settings write fails, the shared paired-save helper requests a resync for
the already-persisted site fields before propagating the original save error.
Demo edits stay local and do not contact the database or Voice API.

Browser-triggered resync uses `POST /api/settings/voice-sync`. The route validates
the same-origin JSON request, authenticates the user, checks site membership and
update permission, and captures the matching session token before returning
`202 accepted`. Next.js `after()` performs the real authenticated backend PATCH
after the response; Settings no longer waits for provider synchronization. The
browser bounds acceptance to 10 seconds, and upstream work is bounded to 240
seconds within a 300-second route budget (deployment-platform limits still apply).

Acceptance is not provider completion or a durable queue guarantee. Background
failures are logged without secrets and are not automatically replayed. An
acceptance failure does not undo or misreport a successful database save. Explicit
Voice preference/setup operations retain their existing synchronous backend
contract; only the generic post-save resync uses this deferred route.

## Public surfaces

Public pages and APIs must expose an explicit data-transfer object rather than
returning a database row. Public document links use opaque tokens and lifecycle
fields (expiry and revocation); see `app/documents/public-token.ts` and the
corresponding timestamped migrations.

Public commerce paths must derive prices and ownership from trusted server data.
Checkout return URLs are restricted by
`app/api/stripe/checkout/checkout-url-security.ts`.

Storefront category navigation at `/shop/[siteSlug]` uses the existing
`{ name, offset, count }` category response to mount ordered sections before
their products load. `ShopCatalogSections` reserves grid rows from the unloaded
item count with responsive CSS geometry. `ShopPendingGrid` mounts detailed
skeletons only within a viewport-sized window plus overscan; offscreen rows use
a single spacer, even inside large categories. A shared intersection observer
activates passive, animation-frame-throttled scroll measurements only for nearby
pending regions. Shop category cards and their skeletons share bounded text slots
and the same responsive media aspect ratio, so replacing a placeholder does not
change row height. The mounted catalog keeps its original layout threshold even
when a refreshed count crosses a compact/featured boundary. Other listing surfaces
retain their existing variable-height layout.

Loaded items hidden by fulfillment do not remain as placeholders. A completed
category read replaces only that category's bucket and reconciles its exact count,
including zero, while retaining other loaded categories. Category navigation never
advances the contiguous global pagination cursor. A total/category count mismatch
keeps global pagination available when no category placeholders remain.
Nearby incomplete sections load through an observer without initiating navigation;
failed reads can retry after leaving/reentering, connectivity recovery, or the
explicit retry button, without an immediate automatic request loop. Search retains
its separate paginated feed. The category
offset fallback paginates using exact totals to avoid truncated counts under
Supabase row limits.

## Payment processing

Stripe checkout creation and webhook settlement are separate trust boundaries:

1. Checkout routes validate the caller, referenced records, trusted prices, and
   return origin.
2. `app/api/stripe/webhook/route.ts` verifies the Stripe signature over the raw
   request body.
3. Database-backed delivery claims serialize retries and prevent duplicate
   event processing.
4. Settlement effects use durable database state so retries do not duplicate
   credits, inventory, entitlements, or related records.

Changes in this area should include focused regression tests under
`__tests__/api/` or `__tests__/commerce/` and a migration when invariants depend
on database constraints or atomic functions.

## Database ownership

The repository stores forward-only SQL migrations in
`supabase/migrations/`. There is no `db:migrate` npm script and no checked-in
Supabase local project configuration. Do not invent a migration command in
automation or documentation; use the deployment workflow approved for the
target Supabase project.

`lib/types/database.types.ts` contains database-facing TypeScript types. Keep
types synchronized after schema changes using the team's established generation
workflow.

## UI conventions

- User-facing interface text is English.
- Reuse components and icon exports already present in the repository,
  especially `app/components/ui/icons.tsx`.
- Do not add direct `lucide-react` usage.
- Keep modules below 500 lines; split by responsibility when a change would
  exceed that limit.

## Assistant send lifecycle

The Robots conversation initially queries only the newest 100 logs, ordered by
`created_at DESC, id DESC`, then displays that page chronologically. Both fresh
and cached conversations land at the latest log before paint, with or without a
requirement. Older pages use a stable `(created_at, id)` cursor and load only on
an upward scroll near the top; layout changes and scrolling down must not fetch
history. Prepending history preserves the reader's position. Realtime updates,
plans, and asynchronous content follow the bottom only until the reader scrolls
up; the **Latest** control resumes following.

Team-member chat interventions use a separate authenticated same-origin proxy.
The API owns their persisted message IDs. Voice interventions currently place
tracked provider calls directly rather than starting Temporal; see
[Chat intervention delivery](CHAT_INTERVENTION_DELIVERY.md) for lifecycle,
retry, and uncertainty handling.

Browser assistant sends use the authenticated same-origin
`/api/robots/instance/assistant` proxy, not the configured external API URL
directly. The API owns user-log persistence; a new send carries a fresh
`request_id`. Repeating the same text is a new turn, not a duplicate. Retries
of a keyed HTTP submission reuse its server-scoped action identity, including
on first session creation. A matching duplicate returns `202` with the original
action ID/status instead of starting another workflow; changed content returns
`409`. A replay acknowledgement is not an assistant answer. Current access
checks still apply. The web client does not automatically replay an ambiguous
POST or queue its unchanged unresolved draft as a new command.

The Robots timeline previews a submitted assistant message immediately, before
context/session checks or admission. This local-only preview shares the send's
`request_id`, stays visible across log refreshes, and is replaced by the matching
persisted user action (not by text alone). It never claims a running workflow
before persistence. A pre-admission failure removes only that preview and retains
the draft; an accepted send remains visible even if its stream later fails.
An empty, missing, or whitespace-only persisted user message does not erase the
submitted or last displayed text. Reconciliation keeps only that text locally;
the durable row still owns its ID and lifecycle metadata. Complete server text
replaces the fallback. This applies to Realtime, refreshes, and live polling;
retained text is scoped to the instance/site and cannot recreate an absent row.

The user-action timeline key also uses `request_id` so persistence updates the
existing message DOM instead of remounting it. A local `Sending` row reserves the
same space as `Running`, without enabling cancellation before persistence. Sends
resume tail following immediately, without smooth-scroll intermediate positions.
The floating composer is measured before paint to reserve its full height; browser
scroll clamping after content shrinks does not enable the `Latest`/pinned-request
UI. Real upward scrolling still pauses following and preserves history pagination.

The API client waits for SSE `completed` or `error` events; `accepted` and
keepalives are not completion. Explicit stream failures, interrupted streams,
and ambiguous gateway/start failures are shown without automatically replaying
the request. Context/session checks and stream waits are bounded, and secondary
error logging cannot delay the user-visible failure.

Missing, interrupted or incomplete assistant streams report an unconfirmed status,
not a workflow failure. Background continuation also uses a neutral notice.
Already-observed completion of the same request suppresses these notices, and
late send notices are not shown in another conversation. The composer retains
its turn preview and Thinking state until the matching persisted user action
settles, not another turn or a local timer. While status is unconfirmed, a resend
is blocked; different commands may still use the queue for a durable running action.

Realtime log observation does not stop server-managed assistant actions. An
`assistant_step` (even a final text chunk) is not a workflow terminal event: the
workflow may still checkpoint, call tools or execute a plan. Its persisted user
action status and the SSE result own completion. Polling follows the same rule,
and the interactive process spinner respects the corresponding action status.

Legacy frontend-owned actions retain automatic `stopped` on a final response or
standalone terminal error. Intermediate/tool-bearing steps, placeholders, active
streams, stream-final chunks without a tool count, and plan/step logs cannot
trigger it. The write checks instance, chronology and available request/action
IDs, rechecks ownership, and conditionally updates only the observed running
state/details. A late event cannot overwrite a cancellation or a newer checkpoint.
Explicit Stop still uses `/api/robots/instance/assistant/cancel`; queue dispatch
continues to use the persisted running state. No new controller or queue is added.
After deploying this change, reload open Robots tabs to retire old log listeners.

Roll out the API lifecycle producer and web consumer together: the consumer
requires an explicit terminal event and treats an older, silently closed stream
as unconfirmed. The proxy requests an 800-second execution budget to allow the
API's 750-second terminal timeout; deployment-platform limits still apply.

Assistant admission distinguishes a busy execution (409) from unavailable Redis
or global capacity (503), with an explicit `execution_started: false` and error
code. These rejections do not mark the robot as failed or consume the unsent
draft. They are not evidence that a new workflow failed.

The proxy uses a non-renewing 815-second admission lease and closes its response
within a 790-second budget from request entry. EOF, errors, downstream cancellation,
and request abort release owner-scoped leases; release never waits for upstream
stream cancellation. Failed releases are retried within the bounded Redis
request timeout. Ambiguous acquisition failures clean up only their own token.
These are HTTP admission leases, not durable workflow ownership: disconnecting
or timing out does not prove that background work stopped, so never automatically
replay an ambiguous started request or delete another execution's lease.

## Workflow relations

The workflow canvas saves each incoming relation on its destination `wf-step`:
`parent_node_id` identifies the source and `settings.relation_context` holds its
label (default `on success`). Clicking the line or its label opens the same
screen-anchored relation editor used by the other graph views, with a searchable
picker for presets and custom labels and a control to disconnect the step.
The external orchestration API copies both into the run plan. `on success` runs
after a completed parent, `on fail` / `on error` after an exhausted failure, and
`always` after either result; an omitted branch is cancelled. Custom text is
passed to the agent alongside the trigger payload and previous step outputs so
it can assess the condition and skip the step without side effects when it does
not apply. A trigger has no failure status, so failure-only relations directly
from a trigger do not run. Existing unlabeled relations behave as `on success`.
