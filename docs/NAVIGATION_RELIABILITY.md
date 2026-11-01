# SPA navigation and idle recovery

## Current behavior

Internal workspace navigation stays client-side after inactivity. Returning to a
tab does not mark the App Router stale, reload the page, or call `router.refresh()`.
The wake hook checks the session in the background and refreshes it only when
needed. Observation ends after 5 seconds; an outstanding SDK operation stays
single-flight until it actually settles, so repeated wake events do not race
token refreshes. A transient network error is not evidence that the user signed out.

The shared navigation helper and `NavigationLink` report pending navigation after
approximately 300–500 ms. After 10 seconds of visible waiting, the notification
offers **Reload page**, warning that unsaved changes may be discarded. It never
automatically reloads on a timer. Completion, a newer tracked navigation,
back/forward, or layout cleanup dismisses recovery for the old destination.
Background time does not trigger the slow-navigation warning on return.

SPA navigation preserves `replace` history semantics and artifact URLs. Explicit
recovery reloads the current document without replaying a captured destination:
a newer direct-router intent may exist outside the shared helper. Link handlers
use Next.js `onNavigate`, so cancelled clicks, new tabs, downloads, and external
links do not start the SPA recovery timer. Existing `prefetch={false}` defaults
remain unchanged: changing prefetch traffic is a separate optimization.

Explicit logout, external redirects, demo transitions, and site-archival document
reloads retain their existing behavior. These are not idle-recovery mechanisms.

The main POS uses its own permission gate rather than the global location-revision
document reset. Deployment notices defer updates while POS is open; see
[POS updates and connection recovery](POS_UPDATE_RECOVERY.md).

The shared location-revision monitor no longer reloads mounted workspace pages on
transport errors, malformed responses or its eight-second verification timeout.
RPC transport is aborted at the deadline; SDK work remains single-flight until it
settles. Confirmed authentication/membership denials and changed permission scopes
still retire private data, including late denials. Cached UI is not authorization:
server checks and RLS remain mandatory. Hidden tabs do not run interval checks.

### Robots file-picker recovery

Robots checks subscription changes on focus/visibility through the existing
user-scoped `refreshSiteBilling` read, not `refreshSites`. A full-site refresh
sets the workspace loading flag, which pauses SWR and temporarily removes the
active robot and Imprenta file input. OS file pickers can emit those wake events
before the selected file's change event, interrupting the upload. Billing-only
refresh keeps the site, selected instance, canvas, and input mounted; concurrent
wake events share one billing read. A failed read does not reload the page or
replay an upload. Later wake events may retry the read.

Regression coverage includes the real Robots controller's wake handler and a
pending upload through the real Imprenta panel controller. Authenticated browser
verification of the native OS picker still requires a configured test target.

## Version checks from public storefronts

Storefronts on www query the app's public `/api/version` endpoint directly to
detect a new deployment and offer an explicit reload. The endpoint owns CORS for
the exact HTTPS origins `www.makinari.com`, `makinari.com`, `app.makinari.com` and
`demo.makinari.com`; it does not enable wildcard origins or credentialed access.
Both 200 and 304 responses include the same CORS policy and expose `ETag`.
All responses vary on `Origin`, including requests without an Origin header.
Browser caching remains limited to 60 seconds with stale revalidation, while
`private` prevents shared CDN entries from mixing origin-specific responses.
Preflight permits only GET/HEAD with `If-None-Match` and `Cache-Control` headers.
Middleware leaves this endpoint's CORS and OPTIONS handling to the route without
changing API admission or the policies of other endpoints.

## Middleware budget

Auth and screen-access lookups share an **8-second total wall-clock budget per
request**, including SDK retries and response processing. Each operation disposes
its deadline scope on settlement. The transport observes cancellation, refuses
new work after disposal, and cookie callbacks ignore late results. A transport
that ignores abort cannot keep the middleware waiting indefinitely.

Auth-js has no public cancellation API for its internal retry-backoff sleeps.
Those may drain after the deadline, but the closed transport refuses further
network attempts and late cookie writes are ignored. This is bounded middleware
latency and side-effect isolation, not a claim that arbitrary promises are killed.

Screen checks disable automatic query retries, use the remaining budget, and do
not mistake a failed membership lookup for an absent membership. The middleware's
existing transient lookup policy is unchanged. Invalid refresh tokens still clear
auth cookies; unauthenticated requests and known blocked screens retain their
redirect behavior. This is not an authorization bypass for APIs or Server Actions:
they remain independently authenticated and authorized, with user-scoped RLS.

## Implementation

### Initial Orders loading

Orders waits for site loading and persisted date-filter hydration before starting
its list request. The table and kanban retain their loading skeleton during that
initialization; location loading and order realtime subscriptions also wait for
the site load to finish.

The server verifies membership before any cache or order read. A temporary
connection failure in that role lookup gets one additional attempt after 150 ms;
a successful lookup without a role returns `Forbidden` immediately. Unavailable
or malformed lookup results instead return a safe access-verification error and
never authorize a cache read. Orders does not automatically retry confirmed
`Forbidden` or `Not authenticated` responses. Location restrictions and user-scoped
RLS remain enforced. Regression coverage lives in
`__tests__/orders/date-filter-page.test.tsx` and
`__tests__/orders/location-cache-boundary.test.ts`.

### Other workspace screens

`WorkspaceSiteSWRScope` defers workspace SWR requests while `SiteContext.isLoading`
is true, regardless of array, object, or URL key shape. It keeps previously loaded
data mounted for the same actor, site and resource during that pause. Initial
loads and scope/key changes report loading rather than borrowing previous data.
Terminal request errors invalidate the retained snapshot. Cross-key SWR
`keepPreviousData` is disabled inside this workspace scope to avoid displaying a
different tenant or resource while its request is pending.
The workspace cache is memory-only and isolated per mounted authenticated actor;
an account transition replaces this cache and its private component tree. Ordinary
same-account refreshes do not remount it. Workspace reads do not reuse the global
local-storage cache after another account signs in.
It does not gate public commerce or account-global providers. Reports retain
their deliberately independent `ReportSWRScope` and their explicit site gate.

Non-SWR Applications/Repositories, Records and Requirements reads explicitly
wait for site loading too. Applications' URL site fallback cannot bypass this
gate. Records and Requirements invalidate pending responses when the site or
loading state changes, so a late result cannot replace the current site's data.

`lib/auth/site-role-lookup.ts` centralizes the bounded role-read retry used by
`getCurrentUserSiteRole`, Orders, catalog search, private commerce, POS and social
data. Unavailable or malformed membership results never authorize data access.
`requireSiteAccess` returns a safe 503 for an unavailable role lookup, reserving
403 for a confirmed denial. Mutations themselves are never automatically replayed.

The app-wide SWR retry policy recognizes both HTTP 4xx status and exact access
errors returned by Server Actions. Confirmed access failures are shown immediately,
without automatic retries or keeping an older cached result visible.

SiteContext distinguishes initial/site-identity hydration from same-workspace
background reads. Background refresh retains hydrated settings and does not raise
the loading gate; successful authorized reads refresh metadata/billing and clear
a revoked selection. Request generations fence overlapping reads, site switches,
signout, actor changes and unmount, including deferred settings and retries. Auth
subscriptions use current committed site state rather than their initial closure.
An already selected real workspace is tab-local during background refresh: another
tab changing the saved preference cannot switch it. Malformed successful site-list
responses are errors, not authoritative empty lists or evidence of revoked access.
Site switches remain gated through hydration. A request-owned ten-second deadline
reports a recoverable error and rejects late publications instead of silently
unlocking an incomplete selection. Background timeouts retain the mounted site;
initial/selection timeouts clear only the incomplete selection. Explicit selection
hydration cannot be superseded by a metadata refresh. Identity restoration and
missing-site retry bypass route-based background-refresh suppression.
Resource-ID chat/robot artifact flows retain their own authorization and lifecycle
rules and still need live verification. No mutation is automatically replayed.

Deals distinguishes missing site, initial load, failed reads and a successful empty
list. Read failures preserve status/code metadata, and retry revalidates data without
reloading the page. Missing tables and null payloads are errors, not empty results.

### Navigation modules

- [Wake session hook](../app/hooks/use-wake-session-refresh.ts)
- [Navigation helper and progress state](../lib/navigation/stale-router.ts)
- [Navigation feedback](../app/hooks/use-navigation-feedback.ts)
- [NavigationLink](../app/components/navigation/NavigationLink.tsx)
- [Middleware deadline](../lib/supabase/middleware-deadline.ts)
- [Middleware auth](../lib/supabase/middleware-client.ts)
- [Screen access](../lib/auth/enforce-screen-access.ts)

The helper keeps its existing `navigateOrAssign` name for callers, but elapsed
time no longer causes an assignment. Internal destinations use the router;
document navigation is only explicit recovery or an external destination.

## Validation and remaining live checks

Jest covers wake events, valid/expiring sessions, transient failures, pending
navigation, consent-only recovery, cancellation, history, artifact preservation,
and the installed Next Link's click behavior. Middleware tests exercise deadlines,
cookie isolation, permission lookups, and real SDK code with synthetic transports.
No production responses are mocked or replaced in the application.

These are regression tests, not proof that every browser suspension scenario is
resolved. Before release, use a configured dedicated test account and target to
verify:

1. Navigate between workspace pages; verify the document is not replaced.
2. Hide the tab for 3–10 minutes and return with a valid and then expired token.
3. Suspend/resume the browser and test a restored back/forward-cache page.
4. Go offline, attempt navigation, reconnect, and navigate again.
5. Keep an unsaved draft while returning to the tab; no automatic reload occurs.
6. Exercise back/forward, query-only report switches, modifier-clicks, and
   `replace` navigation while a prior navigation is pending.
7. Confirm unauthenticated redirects and role-based screen restrictions.

Do not run authenticated browser tests against an unspecified target or interpret
a demo session as evidence for real authentication recovery.