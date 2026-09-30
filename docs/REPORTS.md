# Report sections and data contracts

The Reports sidebar selects `/dashboard?tab=<report>`. Sticky-header tabs select
sections within that report using `section=<section>`; they do not switch reports.
Section changes use native browser history, preserve other URL parameters and
support back/forward navigation. Invalid sections fall back to the report's first
section. Date and segment selections remain in page state. A new site starts at
all segments; filter changes remount report-local controls to prevent stale scope.

## Sections

| Report | Sections |
| --- | --- |
| Performance | Outcomes, Operations, AI usage |
| Business overview | Summary, Unit economics, Activity |
| Analytics | Distribution, Customer cohorts, Lead cohorts |
| Traffic | Acquisition, Audience, Sessions |
| Sales | Summary, Channels, Categories |
| Costs | Summary, Categories |
| Social | Engagement, Networks & audience, Top posts |

Only the active section mounts its widgets and charts. Report modules are loaded
on demand. Social metrics and traffic session attribution do not support segment
filtering; their header omits that control and states the all-segment scope. Direct
traffic distribution requests with a segment return 422 instead of silently
ignoring it. The overview activity
feed and active-segment count also have documented site-wide scope.

## Visual hierarchy

Reports share a bounded content canvas and one report heading. Sticky tabs retain
the application's standard segmented style, with filters separate from the analysis.
Embedded report panels suppress redundant section headings and repeated selected
date lines. The range selector is the visible source of the selected dates; chart
tooltips and disclosures retain exact bounds. The cost chart still labels its
different six-month context window explicitly.
Metric cards share title, value and status tracks within each row. Help icons have
an explicit inline box and loading values use the same line height as final values.
Mobile cards reserve two status lines while allowing longer content to grow, not
truncate. Desktop comparison panels share intrinsic header tracks and stretch to
the same bottom edge; stacked mobile panels retain natural heights.
KPI summaries use one column below 360px, two on wider phones, and four on wide
screens (three for Sales). Narrow phones keep long amounts readable without clipping.
Charts and rankings carry the main visual focus; source definitions and calculation
details remain accessible in native disclosures instead of repeated header cards.

- Overview Summary leads into the sales trend; Activity pairs its daily chart with
  the recent-record feed. The Activity pair shares its header and bottom tracks
  on desktop, with the chart filling the available body height. Module loading,
  data loading, empty results and chart retries retain the same panel shells;
  mobile panels remain naturally stacked. Unit economics has its own snapshot
  comparisons below.
- Performance keeps a compact KPI row over a full-width time series. Count charts
  use UTC labels, sparse markers and no entrance animation; they are not funnels.
- Analytics pairs lead and recorded-sale distributions by attribution dimension.
  Cohort sections mount their tables directly, without nested wrapper cards.
- Traffic pairs page rankings with referral context and aligns geography, device
  and browser panels without a tall secondary stack. Session detail no longer
  requires a fixed tall grid; its chart has its own responsive height.
- Sales and Costs lead with trends before secondary distributions. Social puts
  trends before source-quality details and keeps network and commenter panels in
  a responsive primary/secondary layout. Tables remain the detailed view.

## Date selection

The authenticated `/api/dashboard/date-limits` endpoint exposes section-specific
limits from the server's analytics setting and fixed cohort/cost/social limits.
The UI waits for this metadata before enabling the picker or mounting report data.
Cost Summary uses the stricter limit shared with its secondary Sales request.
No server limits are widened by this presentation change.

Report presets use inclusive calendar ranges. `All time` is explicitly unavailable
where the backend does not support an unbounded report; it no longer sends year
2000 and silently changes to a two-year or one-month range. Invalid or oversized
selections retain the previous range and show an explanation. Valid short ranges
from earlier years remain exact. Switching into a section with a stricter limit
keeps the user's selection and asks for an explicit shorter range rather than
querying it or silently replacing dates.

## Request behavior

- Performance and overview batch APIs accept a validated optional `group`.
  Omitting it preserves the full-batch API contract. Operations includes the
  activity time series as well as its four KPI metrics; duplicate keys are removed
  from the legacy full batch.
- The batch hook uses authenticated identity, site, segment, group and dates in
  its SWR key. Overview also keys by reporting currency. The authenticated identity
  is a browser-cache partition, not a client-supplied authorization parameter.
  Server batch caches also partition by authenticated identity so RLS-visible
  revenue cannot be reused for a different member.
- Batch callers send calendar dates. Batch handlers expand these to UTC day
  boundaries before authorization, caching and dispatch. Explicit timestamp
  requests remain supported. Revenue uses the calendar date portion for its
  sale-date report. Social uses its existing browser-time-zone contract.
- Child failures invalidate the selected batch rather than caching error objects
  or displaying zero metrics. The UI provides a retry state. Existing analytics
  authorization, rate limits and configurable date-range bounds still apply.
- Reports use an in-memory SWR scope without the application's optimistic
  error-masking middleware or persisted previous data. A failed refresh remains
  visible, rather than silently presenting stale figures as successful results.
- Initial site/auth/widget readiness and active fetches or retries show skeletons
  before settled error states. Cached batch failures are retried on re-entry without
  showing the old error first. There is no artificial loading delay. Missing site
  or authentication settles to an informative state, and Overview Activity bypasses
  its intentionally disabled overview batch rather than waiting forever.
- Module, policy and data loading use the selected section's layout: three Sales
  metrics, no invented metrics above category/cohort tables, paired economics
  plots and compact Traffic breakdowns. Chart loading and empty states retain the
  same plot frame. Skeletons do not delay successful responses or conceal errors.
- Sales, Costs, Social, distribution and cohort hooks share the same request
  lifecycle. A secondary request can retry without discarding a successful primary
  report. Cost efficiency waits for the resolved cost currency before requesting
  matching sales, rather than first issuing an unselected-currency request.
- Performance time-series queries run concurrently within each comparison
  interval. Report buckets use UTC, matching the batch's calendar boundaries;
  `sites` has no `timezone` column. Business-hours time zones are not used as
  reporting settings. Daily buckets index each returned row once and count an
  engaged lead once per UTC day. Conversations and tasks filter segments through
  their linked lead, since neither table has a `segment_id` column.
  Its sales series counts created records across all statuses, not revenue; the
  KPI tooltip and chart description distinguish it from the Sales report.
- Overview's sales chart shares the revenue batch result; it no longer fetches
  raw sales separately. Batch revenue skips category joins.
- Traffic Sessions also uses the shared, identity-partitioned request lifecycle:
  StrictMode mounts and concurrent consumers deduplicate requests, obsolete filter
  responses cannot overwrite the active report, and errors provide a retry action.
  Only a server-directed `503` with a bounded numeric `Retry-After` is automatically
  retried (at most three retries). Loading remains visible during that wait; access
  errors, rate limits and database failures remain settled errors, never zero visits.
- Sessions sends local calendar labels; its combined endpoint expands them to UTC
  start/end boundaries and emits inclusive daily buckets with UTC labels, including
  a one-day selection. Explicit timestamp ranges remain supported. It counts actual
  `session_events` pageviews, not `visitor_sessions`, and uses stable ordered pages
  until empty, with an explicit 50,000-record ceiling. The `v2` cache namespace keeps
  old end-exclusive results out of the corrected report.

## Sales definitions

The sales report calls `/api/revenue` and reports **confirmed amounts** from
`pending` and `completed` sales, excluding cancelled/refunded sales. These are not
cash receipts. The independent `/api/sales` array API keeps its completed-sale,
creation-timestamp semantics for existing consumers.

- Report dates are inclusive sale dates, falling back to the UTC creation date
  only when `sale_date` is missing.
- The preceding comparison interval has exactly the same number of calendar
  days. A zero prior amount has no percentage baseline, not an invented 100% gain.
- Monetary totals never combine currencies. Multiple currencies require an
  explicit selection (HTTP 422 with validated currency choices). Sales and the
  overview summary provide selectors. No currency conversion is performed.
- Sales reads use explicit columns, tenant filters and paginated user-scoped RLS
  queries. A 50,000-row ceiling fails explicitly rather than returning partial
  totals; use a shorter range or segment when it is reached.
- Summary and channel sections skip order/category queries. Category amounts
  allocate each sale's amount using top-level order-item subtotal weights, with
  product type or `Uncategorized` as fallback. Child items are not double-counted.
- Online includes online/shop/marketplace; retail includes retail/POS. Other
  sources remain visible as other/unassigned. Trend buckets only span the selected
  interval; first and last months can be partial.
- The additive `dailyData` and `metadata.trendCoverage` fields are assembled from
  the already fetched, currency-scoped sale rows. No per-day requests are made.
  Overview and Sales group by day through 45 inclusive days, by seven-day intervals
  through 180 days, and by calendar month for longer selections. Weekly groups
  begin at the requested start; the final group can be shorter.
- Chart bounds come from the selection, coverage or observed dates, never the
  current year. Explicit complete coverage distinguishes observed zero days from
  missing data. Incomplete buckets remain unavailable. Legacy `monthlyData` is
  still supported and explicitly labeled monthly-only; daily detail is not inferred.

## Unit economics snapshots

Unit economics consumes the existing overview batch without additional requests.
The value-versus-acquisition chart compares reported LTV/CAC estimates only when
their currency labels match. The return chart shows the ROI source's revenue and
positive transaction-cost or campaign-budget baseline. Budget-based returns are
explicitly estimates. No temporal series or LTV:CAC ratio is fabricated.

Missing observations and the legacy `-1` CAC sentinel display as unavailable.
CPL with zero observed leads is unavailable, not zero cost per lead. Return is
calculated from supplied revenue and a positive cost baseline, including losses;
the legacy no-cost `100%` fallback is not treated as measurable return.

These are **source snapshots, not verified lifetime/currency-normalized economics**:
LTV can expand dates and fall back to average sale value, LTV/CAC label USD without
validating underlying record currencies, and ROI/CPL do not report currencies.
ROI uses an all-status sales basis distinct from Summary's confirmed sales. The
UI exposes these caveats. Legacy endpoints can write KPI snapshots on GET unless
their no-write option is set; isolated component previews do not exercise those
endpoints and are not authenticated E2E evidence.

## Validation and remaining limits

Jest regression suites cover section/deep-link navigation, accessible tabs,
conditional mounting, query keys and stale responses, authorization, batch error
caching, pagination, category reconciliation and currency/period contracts.
Additional regressions cover responsive composition, snapshot charts, adaptive
daily/weekly/monthly buckets, real Recharts rendering, pending-to-error/retry
sequences and the installed Next compiler's literal dynamic-import options.

No schema migration or new database RPC is required. These changes do not establish
production latency measurements. The older unit-economics calculations have not
been comprehensively rewritten; their pre-existing metric definitions, aggregation
limits and some fallback behavior remain separate audit work. Live
authenticated verification requires an explicitly configured test target, as
described in `E2E_TESTING.md`.

Analytics distribution endpoints retain creation-date, all-status sale attribution
and do not provide currency metadata. The UI labels these as recorded amounts,
not paid revenue, and directs currency-specific analysis to Sales. Their displayed
shares describe returned rows, not a guarantee of exhaustive population coverage.

Exhaustive pagination in older distribution/performance APIs remains follow-up
work, not a guarantee introduced by this change.

## Observed cohort retention

The customer and lead cohort endpoints no longer generate random retention or
substitute repeat-purchase data for unavailable engagement data.

- Each identified lead enters a customer cohort once, at its earliest confirmed
  sale **observed inside the selected window**. These cohorts use `sales.created_at`
  and current pending/completed status, not lifetime-first purchase, sale date or
  paid-invoice status. The sales segment filter scopes cohort membership.
- Lead cohorts use lead creation dates and current segment membership.
- Repeat-purchase retention counts distinct cohort members with another confirmed
  sale in a later week. Engagement retention uses actual `user` or `visitor`
  messages in lead-linked conversations, scoped to the authorized site. It is not
  website-usage retention and does not infer activity from a lead's mere existence.
- Week 0 is membership (100%). Follow-up percentages are calculated only for
  complete Monday-starting UTC weeks through the earlier of the selected end and
  request time. Incomplete/future weeks are `null`, distinct from an observed 0%.
- Missing activity schema returns `activityAvailable: false`, an explanation and
  null follow-up cells. Other database failures return errors, not empty success.
- Anonymous sales are excluded from customer cohorts and their count is reported;
  unrelated anonymous buyers are never combined into a synthetic customer.
- Tables display cohort size, baseline week, all returned follow-up columns and
  explicit unobserved states. Requests are keyed by account/site/segment/calendar
  range and support retry without stale rows from an earlier filter.
- Every request validates access and segment ownership before reading a cache.
  Reads use the authenticated RLS client and user-partitioned cache. Paginated
  reads probe through server-short pages and fail at 50,000 records rather than
  presenting truncated retention. Selected intervals are limited to 93 days.

## Cost report integrity

`/api/costs` authenticates and authorizes its own site, validates calendar dates
and filter IDs, and reuses the authorized user-scoped client. Segment/campaign
filters must belong to the selected site. It does not use a service-role client.

- A single bounded transaction scan covers current, previous and six-month trend
  intervals. Stable primary-key pagination and batched purchase items replace
  duplicate scans and unbounded `IN` filters. The existing bill cost categories
  and recognized statuses are retained.
- Selected and preceding intervals contain the same number of calendar days;
  database filters exclude the next day. Previous-only amounts/categories remain
  available even when there is no current activity. Every query failure is visible.
- The six-month trend is separate from selected-period category totals.
- Cost amounts are grouped by their stored currency. When multiple groups exist,
  the API returns HTTP 422 with `availableCurrencies` and the UI requests an
  explicit selection. The selected group applies to current, previous and trend
  periods as well as bills; no conversion is performed. Missing/invalid stored
  labels remain a separate `UNSPECIFIED` bucket with no assumed dollar symbol.
  Matching known currency is required for the sales-to-cost ratio.
- Bounds: 366 selected days; 500-row pages; 10,000 records per source; 20,000 bill
  items; 100 purchase IDs per item batch; 200 queries per request. Exceeding a bound
  returns an actionable error rather than partial figures. Segment attribution
  can require a site scan, so its record cap applies before local filtering.
- Pagination is not a transactional database snapshot; concurrent changes can
  still affect a report while pages are read.

## Social report integrity

The report reads `content_performance` snapshots and synchronized inbound messages.
The external metrics producer is not implemented in this repository; reading or
refreshing the report never triggers provider synchronization or modifies social
accounts. Provider API accuracy and live synchronization require separate testing
against the authorized external service.

- Every social Server Action validates its site/reference IDs, authenticates the
  current session, checks `current_user_site_role`, and uses a real user-scoped
  client with RLS. Reporting ranges/time zones are validated and limited to 366
  inclusive calendar days. Provider references are equality-filter values, never
  interpolated PostgREST filter syntax. Provider/database errors are sanitized.
- Snapshot and commenter reads select explicit columns and use immutable ID
  pagination, continuing after short server-limited pages. Reads stop with an
  explicit error above 20,000 rows rather than return partial aggregate success.
  Snapshot reads cover the bounded site cache, not only the selected dates, since
  publication dates live on linked content and missing dates need coverage
  accounting. A shorter date selection does not bypass this snapshot ceiling.
- Latest snapshots are chosen by valid `fetched_at` then stable ID per site and
  external post. Different posts sharing content remain distinct. Content lookup
  indexes retain the newest match rather than overwriting it with older rows.
- Count values, including legacy numeric strings, are validated before addition.
  Missing, invalid and negative measurements remain unavailable. Report totals
  sum observed values only and expose missing metric counts; the UI labels partial
  totals and suppresses comparisons with incomplete metric coverage.
- Engagement retains the existing legacy ratio/percentage compatibility rule:
  values greater than one are divided by 100; values from zero through one are
  ratios. The cache does not identify units or formulas, so this is disclosed,
  not asserted as a verified provider formula. Averages are unweighted means of
  reported rates only; no observed rates means unavailable, not zero engagement.
- Trends use publication dates only. Missing/invalid publication dates are
  excluded and counted, never replaced by sync time. Current and prior cohorts
  have equal calendar duration, but older posts have had more time to accumulate
  metrics; comparisons are not like-for-like activity growth. Reach is summed
  across posts and is not a deduplicated audience count.
- Network names are normalized (including Twitter/X). Repeated stable account IDs
  are deduplicated within a post/network, choosing a newer account timestamp when
  available. Rows without stable IDs are preserved and counted as unidentified;
  deduplication is not invented. Network coverage may not reconcile with totals.
- Commenters use message creation dates, separately from publication cohorts and
  accumulated provider comment counts. Replayed message IDs or known provider
  comment IDs scoped by post/network do not increase rankings. Only safe HTTPS
  avatar URLs are displayed. Missing synchronized authors do not imply zero
  provider comments.
- The UI exposes oldest/newest stored sync times, missing-date/metric/account
  coverage, and a reload-stored-data action. Top posts can be sorted and paged
  beyond ten, with publication dates, comments, shares and content links.

Schema defaults of zero cannot reveal whether an external producer actually
observed a zero; only explicitly missing/invalid values can be flagged. Multi-page
reads are not transactional snapshots. These are known source limitations, not
guarantees fixed by frontend presentation.