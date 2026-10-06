# Embedded application and external tracker diagnostics

## Scope and evidence (2026-10-06, ba603eb)

The initial investigation read saved Playwright traces and local source. The
follow-up also performed anonymous read-only GETs, read-only Vercel inspection,
CDN/local bundle hashing and isolated SDK tests. No build, deployment, remote
record change or sibling-source edit was performed. The errors have different
owners; the follow-up distinguishes cancellation from generic connectivity.

Trace roots, relative to this repository:

- `test-results/prod-smoke-after-push-20261006-ba603eb`
- `test-results/prod-smoke-read-rerun-20261006-ba603eb`

Relevant trace directories:

- CRM: `tests-smoke-workspace-CRM--02956-ce-without-a-login-fallback-admin`
- Content: `tests-smoke-workspace-cont-f8c2e-s-in-the-selected-workspace-admin`

Each contains `trace.zip`. Evidence below comes from its `0-trace.network`,
`0-trace.trace`, `test.trace`, and specifically selected saved response bodies.
Do not publish complete traces: they contain authenticated headers and customer
payloads. Frame references, static script paths, timestamps and header-presence
checks are sufficient for attribution.

## Nurture route: remote preview application defect

| Evidence | After-push CRM trace | Rerun Content trace |
| --- | --- | --- |
| Child frame | `frame@eb89b53be773c34109076a6512c0e389` | `frame@fa8807f026a57bac59943856ce08485a` |
| Preview root GET | 200 at `00:58:59.330Z` | 200 at `01:00:42.334Z` |
| Nurture GET | 404 at `00:59:00.382Z` | 404 at `01:00:43.174Z` |

Times are UTC on 2026-10-06. The failing path is
`/admin/nurture-sequences`; its only query key is `_rsc`.
Both requests have `RSC: 1` and `Next-Router-Prefetch: 1`, with the preview
root as referrer and the child frame as `_frameref`. They are not workspace API
requests or completed top-level navigations to that route.

The exact preview origin can be located in those trace entries. To avoid copying
an operational preview URL into repository documentation, its SHA-256 is:

```text
2d2c96076b9060b5f10338ca6d3361e00efa36a20427c07d3332fb6f014c9138
```

The shared saved root HTML body is
`resources/babbfb8dea8ce0c096b1eb75a4651d4a9ec040d9.html`.
It contains an anchor with `href="/admin/nurture-sequences"` and loads the
preview's own Next.js chunks. Thus the initiator is the preview application's
Next.js link prefetch, not a route string in this repository. The trace does not
include a CDP JavaScript initiator stack; this attribution rests on the child
frame, referrer, explicit prefetch headers and saved link together.

### Current repository boundary

- `app/robots/page.tsx` selects `latestPreviewUrl` from requirement-status rows
  (around lines 1149–1169), then supplies it to the preview iframe (around
  lines 2384–2403).
- A saved successful `/rest/v1/requirement_status` response contains a
  `preview_url` matching the observed child frame origin. No row identifiers or
  payloads are needed in a report.
- `app/hooks/use-iframe-url.ts` returns `iframeSrc: sourceUrl`; it does not append
  `/admin/nurture-sequences`. Its cross-origin catch only limits the address-bar
  display and does not suppress remote requests or errors.
- The saved main-frame snapshot is `/robots`, with a `Preview` iframe. At the
  recorded 1920×1080 viewport, its container has `hidden lg:flex lg:w-2/3`:
  the preview is visible at this desktop breakpoint, not a hidden desktop frame.
- Current source can retain a mounted browser behind CSS in other layouts, but
  these traces do not establish that such a hidden lifecycle caused this error.
- Neither this route nor `callSegmentApi` exists in current `app/` or `lib/`.
  `ba603eb` did not change the Robots iframe, URL hook, tracker loader or root
  layout. Temporal association with the push is not regression attribution.

**Classification:** a broken link/route-delivery contract in the independently
deployed preview application. Follow-up anonymous GETs confirmed the root returns
200 while the direct `/admin/nurture-sequences` page returns 404, so the failure
is not limited to speculative RSC prefetch. Read-only Vercel inspection identifies
deployment `dpl_6q4onjjS2zgt1VsjgDXGBDC8KRxA`, application `apps`, target `preview`,
state `READY`, with no Git metadata in the returned inspection DTO. The source
repository/revision is still not established. No wrapper lifecycle fix is proven.

**Work left for the preview deployment owner:**

1. Resolve the exact origin from the saved frame/request to its source revision
   and deployment. Read-only inspection of local `apps-base`, `sites` and
   `makinari` found no matching nurture route; no proper replacement path was
   established. Do not guess an alternate route or rewrite it into this app.
2. Verify the intended route's page and RSC/prefetch delivery under that
   deployment's framework/configuration. Repair the route or point the link to
   the verified existing equivalent; do not just disable prefetch to hide a 404.
3. Publish the corrected external application through its authorized release
   process. If it needs a new preview URL, updating the appropriate requirement
   status is a separate authorized remote mutation, not part of this diagnosis.
4. Verify preview root, explicit link navigation and prefetch with strict console
   observation still enabled. Deploying this repository alone cannot add the
   external preview's route.

## Segment API: top-level external SDK transport failure

The rerun CRM trace contains:

```text
[Visitor] Error calling segment API: Error: Network connectivity issues
Object.sendRequest — tracking.min.js:1:366860
s.callSegmentApi — tracking.min.js:1:286785
```

Both stack locations are in `https://files.uncodie.com/tracking.min.js`, with
version query `v=1.964`. The console `location` points to the workspace chunk
`3n84-899u9dom.js`; that location alone is not the error producer. The SDK stack
and network frame provide the useful attribution.

`app/components/TrackingInit.tsx` loads this script from the root layout with
visitor/action tracking and support chat enabled. It is distinct from the
storefront's current `useSiteTracking` implementation and from the preview frame.

| Rerun CRM event | Trace monotonic time (ms) |
| --- | ---: |
| Top-level segment POST starts | 50231.672 |
| Test invokes full-document `page.goto('/leads')` | 50259.463 |
| SDK emits segment error | 50972.764 |
| New document loads tracker | 51085.960 |
| Next segment POST starts | 51328.592 |

The first POST is to `https://backend.makinari.com/api/visitors/segment`, at
`2026-10-06T01:01:15.450Z`, in main frame
`frame@5258c52ef46307020659f8f4ea3a835b`. Its trace status is `-1`, not an HTTP
401, 403 or 5xx. Its saved `_failureText` is `net::ERR_ABORTED`; there is no response body. A
visitor-session proof header is present (value deliberately not inspected or
reported). The next POST completes with 200. All other captured segment POSTs
in the four workspace traces have status 200.

Two tracker loads per workspace trace bracket full-document navigation. That is
not evidence of duplicate initialization within one document. Likewise, a 200
on the later request does not turn the earlier error into success.

### Read-only SDK source corroboration

The sibling `Script` repository contains the matching method and error text:

- `src/modules/visitor/VisitorSegments.ts`: `callSegmentApi` sends the segment
  POST and reports failures at line 113.
- `src/utils/network/index.ts`: the fetch catch maps classified fetch failures
  to `Network connectivity issues` around lines 241–262; `shouldFail` around
  lines 378–394 accepts TypeError and network/CORS messages.
- `docs/tracking-transport.md` explains the separate SDK/API release boundary.

The trace did not save the CDN tracker body. Follow-up read-only retrieval of
`tracking.min.js?v=1.964` returned 200 with seven-day cache policy. It exactly
matches the currently available local `Script/dist/tracking.min.js` (386,002 bytes),
SHA-256 `0172838164553d4e9518a61116ff823f8f67f369861ba01d0e212745c07329ca`.
This establishes bundle equality at retrieval time, not the historical bytes of
each saved browser response. There is no current evidence of a stale CDN bundle.

**Classification:** explicit browser cancellation during document navigation,
reported by the SDK as generic connectivity failure. The full-document
navigation starts about 28 ms after the segment POST. The saved failure reason
is `net::ERR_ABORTED`, not an HTTP auth error. SDK `events.ts` handles pagehide by
stopping recording but does not cancel the network's segment controllers.
`network/index.ts` maps unclassified TypeError to `Network connectivity issues`,
and both discovery/assignment catch blocks log cancellation as errors.

The existing SDK auth suite passed all 10 tests. A temporary, isolated 11th test
using the real VisitorSegments/network transport reproduced that pagehide leaves
the pending controller active and a subsequent fetch failure reaches the generic
connectivity log. The test lived outside both repositories and was removed after
execution. This is diagnostic evidence, not regression coverage of a fix.

**Work left in the SDK repository:** install a document lifecycle for in-flight
tracking/segment reads, explicitly abort on pagehide and resume safely after
back-forward-cache restoration. Classify only that explicit cancellation with a
typed result/error so discovery and assignment do not log it as connectivity.
Keep unknown TypeError, CORS, timeout, 401/403 and real provider failures visible;
do not replay an ambiguously completed assignment. Add lifecycle/cancellation
tests that cover pending requests, consent withdrawal, restore and real errors.
Existing timeout composition must distinguish caller cancellation from timeout.

Preserve session proof/authorization. Publish the verified SDK fix and associated
bundle/compressed assets through a separately authorized release process; update
the embedding only after confirming delivery. No backend defect was demonstrated
by this specific cancelled POST. Do not monkey-patch fetch, turn tracking off or
filter the console error in E2E. `Script` has unrelated uncommitted changes that
must be preserved; no sibling or remote SDK/API change was made here.

## Safe repeatable attribution checklist

1. Read `docs/README.md`, `specs/context.md`, and the installed Next.js routing,
   prefetching and script guides before changing framework behavior.
2. Parse the saved zip locally. Use `_frameref` in network entries and
   `frameId`/`isMainFrame` in snapshots to distinguish parent from child.
3. Inspect only method, origin/path, status, UTC/monotonic time and the specific
   referrer/prefetch header names. Never dump authorization, cookies, session
   proofs, request bodies, arbitrary query values or full DOM snapshots.
4. Inspect console stack function names and static source locations. Console
   forwarding can attribute a message's location to a workspace chunk even when
   an external SDK threw it.
5. Inspect a selected static HTML body for the exact link and script paths, not
   unrelated Supabase responses. Join source-selection evidence using a match
   boolean or origin hash without printing tenant/user rows.
6. Check visibility at the recorded viewport and compare timestamps with actual
   test actions. Do not infer hidden-frame loading or duplicate SDK execution
   merely from multiple requests across documents.
7. Keep console and dependency assertions intact. These diagnostic findings do
   not establish a green smoke run or repair unrelated image-delivery failures.

## Local outcome

After explicit authorization, the SDK source was repaired in the `Script`
repository: typed cancellation, pagehide suspension, bfcache restore without
replay, signal/deadline composition and discovery/assignment cancellation
handling. Existing proof/consent and real-error reporting remain intact. See
`Script/docs/tracking-transport.md` and its lifecycle/network/segment tests.
The SDK production build was subsequently approved and completed as `1.965`,
with validated full/lite bundles and compressed assets. The local TrackingInit
head loader now requests `tracking.min.js?v=1.965` to change the browser/CDN cache
key. No CDN publication or deployment was performed; changing a query version
does not publish the built files or reload an already running SDK. Publish the
matching artifacts before deploying the embedding and reloading existing tabs.

The preview route still requires identifying its source. Earlier market-fit
image, notification and observer repairs remain uncommitted and need reviewed
deployment; current app production still reports `ba603eb`. Strict console
coverage remains intact. There is no dedicated E2E scenario for
`/admin/nurture-sequences`: workspace selection renders a preview whose own link
prefetch emits the error, detected by the generic console/dependency observer.