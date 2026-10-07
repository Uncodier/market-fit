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