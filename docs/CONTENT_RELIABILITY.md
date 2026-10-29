# Content loading and trend-provider availability

## Content detail

Content detail models load failures as recoverable UI state. Missing, mismatched,
or failed records never render the editor or performance panel. The error state
offers explicit retry and navigation back to Content; it does not automatically
replay mutations. Responses from an older content request cannot replace the
current record or its relations.

A transport failure while calling the Server Action can still reflect a network
or deployment issue. The recoverable state prevents the secondary `content.id`
crash; it does not prove the original dependency is healthy.

## Explicit workspace navigation and onboarding

An unfinished guided tour must not redirect an explicitly opened Content, Leads,
Robots, or buyer screen to Onboarding. Automatic guidance is offered only while
the user is on `/onboarding`; it does not navigate again to that route. Pending
widget observers are cancelled when the route changes. Explicit `tour=start`,
resumed `showTour` steps, and the `tour:start` event retain manual navigation.
The repair does not mark users' tours or onboarding tasks complete.

The workspace shell uses `React.lazy` under its existing Suspense boundary rather
than the development `next/dynamic` react-loadable preload path that emitted a
missing chunk in fresh QA HTML. It still renders on the server and is not loaded
on routes without a workspace layout. The credits-widget CSS is included by the
root layout so removing dynamic CSS preloads does not delay its SSR styles.
Component/compiler regressions cover the boundary; an isolated development
fixture checks emitted assets and hydration without application/provider access.

Onboarding detects saved workflows through user-scoped `instance_nodes` reads,
filtered by site and the shared workflow definition node types. Generated results
and unrelated media are not workflow definitions. A failed read cannot mark the
task complete; the obsolete `workflows` table is no longer queried.

```sh
npm test -- --runInBand __tests__/components/onboarding/guided-tour-navigation.test.tsx __tests__/dashboard/use-onboarding-validation.test.tsx
```

Disposable QA traces reproduced the Content redirect with a successful persisted
content read. Local regression validation covers the correction; it is not proof
that the patch is deployed. Independent Reddit provider rejection and development
chunk preload failures remain errors, not successful empty data.

## Content Creator file uploads

The `/robots?mode=imprenta` canvas confirms both the Storage upload and the
persisted `instance_nodes` row before reporting success. Confirmed uploads update
the active instance's SWR cache as well as the visible canvas, so reopening it
does not hydrate an older list without the uploaded node.

Returning from the operating-system file picker can trigger a visibility refresh
while the upload is still running. A confirmed upload invalidates any older
refresh snapshot; stale responses and responses for a previously active instance
cannot replace the current canvas. A later refresh still uses the database as
the source of truth, including deletions. Uploads retain the instance/site scope
captured when they started and continue using the authenticated client and RLS.
PDF and plain-text outputs retain an explicit file link instead of an empty media
preview. Canvas state, synchronization, interaction and rendering are separated
under `app/components/agents/imprenta-panel/`; the public panel entry point is
unchanged.

Offline regression tests cover the upload, failed persistence, cache restoration,
overlapping refreshes, and instance navigation:

```sh
npm test -- --runInBand __tests__/hooks/use-imprenta-data.test.tsx __tests__/hooks/use-imprenta-upload.test.tsx __tests__/components/agents __tests__/lib/imprenta-instance-sync.test.ts
```

These tests do not verify live Storage configuration or database permissions.

## Trends

The Content list retains its existing table/Kanban skeleton while the site context
resolves and the first content request is loading. A disabled SWR key during site
initialization is not interpreted as a completed empty content list. Once data
loads, confirmed empty columns use their normal empty state; cached content is
not replaced by a skeleton for a background refresh.

The public service entry point remains `app/services/trends-service.ts`;
provider requests, normalization, caching and ranking live in
`app/services/trends/`. The browser adapts stored segment data to the existing
route contracts without weakening server validation:

- Google receives at most 5 non-empty segment names of at most 80 characters.
- Reddit receives at most 8 segments and 12 keywords of at most 80 characters.
- Both omit null descriptions and cap descriptions at 240 characters.

Provider requests make a single bounded attempt. Identical in-flight requests
are shared; successful responses are cached for five minutes and failures have
a 30-second cooldown. Explicit refresh bypasses settled cache entries, not an
already running request. Normalized request payloads include description and
limit in their cache identity.

Aggregation reports failure when all requested providers fail. Partial success
keeps available results and exposes `platformErrors` for the unavailable sources.
The UI shows these errors inline rather than repeatedly emitting error toasts,
and hides old-context results after navigation or refresh failure. Provider
transformations do not invent posts or random engagement metrics.

Reddit distinguishes client input from upstream failures. Listing transport,
non-success HTTP, malformed JSON and invalid payload shapes return the same
sanitized 502 dependency error and cannot populate the response cache. Configured
OAuth failure does not retry through anonymous access; missing both credential
fields retains the explicit public-read path. Diagnostic logs contain only phase,
classification and optional HTTP status, never provider payloads or credentials.
A genuine provider rejection still fails QA: this repair does not provide OAuth
access or fabricate successful empty trends.

While site/segment context resolves, Trends retains the same existing table,
cards or column skeleton used during the provider request. It does not replace
that layout with a waiting/loading message. Requests and refresh remain gated
until the context is ready; settled failures and empty results keep their distinct
recoverable states.

Only Google and Reddit are active trend providers. Twitter/X Trends has been
removed from requests, provider badges, results and availability notices. Its
service and `/api/trends/twitter` route are retired; even an explicit manager
request or refresh cannot contact X. No X Trends credentials or paid access are
required. Connected Twitter/X social publishing accounts are unaffected.

## Regression validation

Campaign and deal title editors now expose exact keyboard-accessible edit
buttons and labeled inputs. One edit session dispatches at most one save while
Enter/blur overlap; failed drafts remain visible and require explicit Enter retry
or Escape cancellation. UI failure never counts as a saved title. Their browser
journeys keep exact DB persistence, reload and cleanup assertions and use the
semantic controls rather than heading indexes or styling classes.

```sh
npm test -- --runInBand __tests__/content/content-page-loading.test.tsx __tests__/content/use-content-data.test.tsx __tests__/content/content-item-load-error.test.tsx __tests__/trends __tests__/trends-ui __tests__/api/provider-response-cache.test.ts
npm run typecheck
```

These local tests isolate provider and database dependencies. They do not prove
production credentials or connectivity. Instance deletion is a separate workflow;
see [Instance deletion](INSTANCE_DELETION.md) before retrying an unconfirmed
destructive request.