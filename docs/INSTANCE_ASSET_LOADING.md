# Instance asset and browser-data loading

## Database prerequisite

`20261111223000_instance_asset_summaries.sql` is already applied to linked Makinari.
The bounded invoker RPC and instance/date/image indexes remain unchanged by the
follow-up frontend repair. Canonical application evidence is in the sibling
`makinari-db-scheme/supabase/validation/20261111_instance_asset_summaries.md`.

## Runtime contract

- Asset summaries use sequential batches of at most 100 instance IDs; stable,
  sorted IDs prevent name/status-only array updates from restarting requests.
- Completed batches survive ID additions. Auth identity replacement, sign-out,
  user updates and site changes invalidate caches and obsolete requests.
- Same-user SIGNED_IN confirmations and token refreshes retain fresh results.
  INITIAL_SESSION establishes the comparison identity without forcing a reload.
- Visible-page freshness checks run every five seconds, but fetch only expired
  assets (60-second TTL). Fresh cache checks do not issue RPCs. Errors back off
  for 60 seconds unless the user explicitly retries.
- Auxiliary nodes, requirements and message previews refresh after at least
  60 seconds since completion, checked every five seconds while visible. There
  is at most one auxiliary refresh running per consumer, with a 30-second abort
  deadline, sequential node pages and four-instance requirement/message blocks.
- Successful requirement counts are retained until their replacement arrives.
  First-load unknown counts remain undefined, never manufactured zeros.
- Counts, previews and asset fields resolve independently; the table renders
  per-field loading state. Unknown counts do not hide instances from filters.
- Failures clear the failed dataset, expose an unavailable/retry alert, and do
  not silently claim successful empty data. Cross-site snapshots are masked.
- There is no global cross-user or cross-tab cache. Multiple consumers can each
  perform their own bounded read.

## Verification

The offline `jest.instance-assets.config.cjs` suite has 49 passing tests, including
same-user auth confirmation, different-user cancellation, 394-ID batching, cache
progress, stale site replies, scheduled refresh, retained counts during refresh,
unknown-vs-zero filtering, query failure and existing creation/model regressions.
Pagination retains the selected page for equivalent ID lists, resets when list
membership/order changes, and clamps changed page sizes without state-setting
effects. Mobile button CSS regressions retain all mobile-scope and style checks.
No live credentials or network are needed by the suite.

Targeted lint is clean for the loaders, model, modal, table, pagination and tests.
The table uses next/image with fixed avatar dimensions and unoptimized loading
to preserve direct URL/auth behavior instead of adding server-side image fetches.
The PostCSS test uses the library's discriminated AnyNode union for ancestor
traversal, preserving media-query assertions without casts or relaxed checking.
No rule suppression, applied migration edits, deployment or production build.

Deploy the frontend to activate these fixes. Browser E2E and post-deployment
traffic verification remain release gates; offline tests do not prove the
observed database outage's root cause.