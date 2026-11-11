# SPA navigation and idle recovery

## Current behavior

### Mobile workspace navigation

Below 768px, a floating bottom navigation replaces the workspace sidebar. Each
icon includes its app's translated label, using the same localization keys as the
launcher. Labels use their full tab width on one line, truncating with an ellipsis
only when needed, without increasing the bar's height.
Each tab has explicit icon and label rows, including a scoped override for legacy
Safari Settings-link flex styles so automation/settings shortcuts cannot turn horizontal.
The same scoped override centers labels beneath their icons rather than inheriting
the legacy Settings links' left-aligned text.
The capsule-shaped glass bar uses a neutral translucent gradient, 32px backdrop
blur, inset highlights and a soft shadow. It is centered with a 440px maximum
width, 16px minimum side margins and a 12px gap above the bottom safe area.
The selected icon and compact highlight use the theme's accent foreground and
accent surface (green in the current dark theme), consistently across all five
positions. Glass surfaces, borders and inactive icons also use theme tokens,
without a fixed blue or gray palette. Press feedback respects reduced motion; reduced transparency
switches to an opaque surface. Light and dark surfaces have separate treatments.
AI Workspace stays in the center and Apps stays in the rightmost slot. The other
three slots fill as modules are opened, replacing the oldest opened module when
full. Revisiting a module updates its destination (including detail/query state)
without duplicating it. Tabs initialize from the site's saved sidebar shortcuts.
Without usable history (excluding the automatically inserted pinned Overview),
the defaults are Conversations, Leads (`/leads`), and Tasks (`/control-center`).
Tabs are filtered by screen access and reloaded on actor/site changes; new visits
stay session-local and do not change desktop pins. Late reads cannot overwrite
visits made during loading or publish into a different actor/site scope.
Apps remains reachable while its launcher page is open. Profile is the first tile
in the launcher's Settings section, not a mobile top-bar shortcut. This account
destination remains available regardless of site screen restrictions and does not
become a dynamic mobile tab. Full labels remain available to assistive technology.

The bar overlays the content without reserving padding or reducing viewport height;
the fixed conversation pane extends to the bottom edge. Embedded artifact views do not
render the bar. Desktop navigation and default landing routes are unchanged.
Detail routes use the breadcrumb engine's `hasId` classification to hide the
mobile bar. This includes entity paths and
selected conversations/robot instances in query parameters, but not nested module
roots or ordinary filters/tabs. Navigation tracking stays mounted so returning to
a module root restores the bar without losing open tabs.
Bottom-positioned Sonner toasts sit above the rendered mobile bar with a 12px
gap and the device safe-area inset. When the bar is absent, Sonner's normal
offset returns automatically. Desktop and top-positioned toasts are unchanged.
Regression coverage: `mobile-workspace-navigation.test.tsx` and
`mobile-profile-link.test.tsx` in `__tests__/components/navigation/`.

### Session recovery

On mobile, **Back to instances** pushes `/robots?view=instances` (preserving the
workspace mode), showing a searchable full-screen list and restoring bottom
navigation. Selecting a row pushes its instance URL, hiding the list/navigation;
browser back/forward follows the same screen state. No modal is used for this path.
The Robots parent breadcrumb also targets this explicit list on mobile instead
of using instance tabs. On desktop, Robots shows only its workspace title in the
top bar, without a breadcrumb trail or extra breadcrumb row; the instance tabs
provide navigation there. On mobile the parent breadcrumb targets the list instead
of `/robots`, which would immediately auto-select an instance again. It preserves
the current workspace mode; desktop, embedded views and detail links are unchanged.
The mobile sticky header contains Back and the floating Agent/Files/etc. selector,
not instance tabs. Desktop keeps its instance tabs and existing browser modal.
Automatic selection and creation remain enabled; URL canonicalization makes the
auto-selected instance a detail route. An automatic creation finishing while the
list is open cannot dismiss it. The workspace stays mounted behind the list to
retain its draft, and list scrolling leaves clearance for the floating bottom bar.

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