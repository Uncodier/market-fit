# Report sections and data contracts

For current-section CSV downloads and completeness rules, see [Report exports](REPORT_EXPORTS.md).

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

Only the active section mounts its widgets and charts. Omitting a section selects
the report's default section; it never renders all sections together. The dedicated
`/costs` entry also separates Summary and Categories using `section`, retains its
campaign filter and uses the same bounded report canvas. Dashboard cost deep links
remain supported and highlight Costs in the sidebar.

Route-level loading is neutral until the report is known; it must not display
Performance KPIs while opening another report. Module and data loading then use
the active report's section, without inheriting a section from a different report.
Back/forward and subsequent navigation intents cancel pending navigation fallbacks
so an earlier report cannot reopen after the user leaves it.

Report modules are loaded
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

Time-series, sales/cost distribution and unit-economics plots use a shared
`ReportChartFrame` within the dashboard canvas. Their minimum height is the dynamic
viewport (`100dvh`) minus the measured space above the plot (navigation, filters,
headings and preceding widgets), the canvas bottom gutter and an additional 71px
of bottom clearance so the plot does not fill to the viewport edge. Resize observers
recalculate this offset when responsive wrapping or async content changes; scroll
positions are excluded so scrolling cannot inflate a chart. Existing responsive
heights remain a readability floor on smaller windows. Loading and empty chart
frames use the same rule, nested Activity frames inherit their outer size, and
charts embedded outside Reports retain their original sizing.
Attribution/traffic donuts and table-only sections retain their natural layout
rather than reserving a full-height time-series canvas.

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
  and browser panels without a tall secondary stack. Traffic donuts use an explicit
  stacked variant: a centered plot in a full-width top track, followed by full-width
  table rows that fill the remaining card height instead of a capped side legend.
  Loading states share these tracks. Analytics keeps its compact side-by-side
  distributions; Sales and Costs keep their own chart layouts. Acquisition includes
  session-by-segment and session-by-campaign donuts above the page/referral panels.
  Session detail no longer requires a fixed tall grid; its chart has its own
  responsive height.
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

## Traffic attribution and coverage

Acquisition loads `/api/traffic/attribution` once for both donuts and their coverage
summary. It uses the same authenticated identity, site and inclusive date range as
the other traffic distributions. Responses include `model: "session_entry"`,
`segmentMembership: "current"`, `segments`, `campaigns` and `coverage`. The browser
validates nonnegative integer counts and requires each donut to reconcile with
`coverage.totalSessions`; malformed or partial data is an error, not a new 100%.

- Campaign attribution uses the session's recorded `utm_campaign`, falling back
  to its **landing** URL. It never uses a later `current_url`, guesses from the
  lead's CRM campaign, or carries another session's campaign forward.
- Source attribution prefers recorded UTM evidence and landing-URL fallback.
  Referrer host matching uses domain boundaries, not substring matches. Missing
  or invalid referrers remain **Direct / unknown**; absence is not proof of a
  direct visit. Internal navigation remains visible instead of being removed.
- Segment attribution uses the linked lead's same-site segment, then the
  visitor's same-site segment. This is **current membership**, not a historical
  snapshot. Anonymous or unassigned sessions remain **Unassigned segment**.
  Campaign-free sessions remain **No campaign**. Each session contributes once
  to each donut, not once per visitor or once per lead.
- The coverage summary reports total sessions, identifiable sources, assigned
  segments and tagged campaigns. These measures overlap and must not be added.
  A campaign tag alone does not identify an external source.
- All six traffic distribution routes authorize site/date access before using
  elevated reads. Segment/lead embeds are nullable and scoped to the authorized
  site; missing or foreign relationships never remove a session from the total.
  Non-`all` segment filters still return 422: adding a distribution is not support
  for filtering every traffic KPI by that dimension.
- Reads use stable ID cursor pagination until an empty page, including after
  short server-limited pages. More than 50,000 sessions produces a typed 422
  (`TRAFFIC_SESSION_LIMIT_EXCEEDED`) prompting a shorter range, never a partial
  aggregate. Existing five distributions use cache version `v3`; attribution
  starts at `v1`. These multi-page reads are not transactional snapshots.
- Top-category truncation retains remaining counts in **Other**, so a long tail
  cannot inflate the displayed shares. Unknown devices remain unknown instead
  of defaulting to desktop. Device OS fields support both strings and objects.
- **Top Visited Pages** retains its distinct legacy unit: recorded landing and
  current URLs. It is not a full pageview count and can count a session more than
  once. The Sessions tab reads pageview events instead. Do not compare these
  denominators as though all three were the same metric.

For better future coverage, consistently tag outbound campaign links with
`utm_source`, `utm_medium` and `utm_campaign`, preserve them through redirects,
and connect identified sessions to leads/segments. The companion API capture
normalizes URL-only UTM values into session and first-visitor fields without
overwriting first touch on heartbeats. Existing landing URLs can recover missing
UTM columns at read time; missing historical evidence cannot be reconstructed.
First-touch comparisons, last-non-direct attribution, cross-device identity and
historical segment snapshots are not implemented by this report.

## Sales definitions

The sales report calls `/api/revenue`. Its summary separates **Net collected**,
**Active sales**, and **Outstanding balance**, rather than labeling unpaid sales
as confirmed revenue. The independent `/api/sales` array API retains its existing
columns, completed-sale status filter and creation-timestamp semantics.

- Active sales (`totalSales`, counts, averages, channels, categories and trends)
  include `pending` and `completed` sale amounts regardless of payment. They exclude
  cancelled/refunded sales and any sale linked to a cancelled order. Multiple-order
  sales with a cancelled order are conservatively excluded in full: there is no
  approved allocation of one sale's value to surviving orders. This does not change
  source statuses, accounting recognition or fulfillment.
- `financialSummary.receipts`, `refunds`, and `netCollected` use dated entries in
  `sales.payments` and successful records in `accounting_sale_refunds`, grouped by
  each movement's UTC calendar date. They include older and future-dated sales,
  cancelled orders and cancelled/refunded sales. A cancellation does not fabricate
  a cash refund. Partial refunds reduce net cash, not the gross active-sale value.
  Pending/processing/failed/cancelled payment attempts are not receipts. Current
  writers mark receipts `completed`; older manual receipts may omit status.
  Offset-free legacy payment timestamps retain the accounting module's UTC
  compatibility rule; their original browser timezone cannot be reconstructed.
- Receipt/refund IDs are deduplicated; conflicting duplicates, malformed money,
  dates or currencies, unexplained paid balances, and refunds without dated evidence
  make the affected cash measure unavailable (`null`), not zero. Balance-only legacy
  payments and `legacy_inferred` / `legacy_balance` receipts never acquire invented
  cash dates. A history issue can affect any selected cash period; narrowing the
  sale-date range does not hide it. The UI exposes the affected-record count.
- `financialSummary.outstanding` and `paymentStatus` use the **current** saved balance
  on active sales dated in the selected period. They are not historical closing
  balances and have no prior-period percentage comparison. Unknown/inconsistent
  balances are not classified as paid. Payment status amounts are full sale values,
  not received amounts. Excluded sale counts/amounts use the selected sale-date cohort.

- Report dates are inclusive sale dates, falling back to the UTC creation date
  only when `sale_date` is missing.
- The preceding comparison interval has exactly the same number of calendar
  days. A zero prior amount has no percentage baseline, not an invented 100% gain.
- Monetary totals never combine currencies. Multiple currencies require an
  explicit selection (HTTP 422 with validated currency choices). Sales and the
  overview summary provide selectors. No currency conversion is performed.
- With no sale or cash activity (or unresolved cash history) in either comparison
  period and no explicit currency selection,
  revenue reads the authorized site's `settings.currency` through user-scoped RLS.
  This labels the empty KPI and trend consistently without inventing transactions.
  Recorded sales (including those missing a currency) retain their own currency
  grouping. Missing or invalid site currency remains unspecified; settings read
  failures return an error instead of a successful empty report.
- Sales reads use explicit columns, tenant filters and paginated user-scoped RLS
  queries. Receipt-date reporting scans complete site/segment sales history since
  receipts are nested JSON, not filtered by sale date. Sales and each related source
  have a 50,000-row ceiling and fail explicitly instead of returning partial totals;
  select a segment if reached. Immutable-ID keyset pages avoid offset shifts and
  reject repeated IDs. Multi-page/cross-table reads are not a transactional snapshot.
  Unrelated concurrent updates can still change the source between reads.
- Owners/co-owners and explicitly unrestricted active members may view this report.
  Assigned-only members receive a visibility error before financial reads because
  sales and orders have independent assignment RLS; a hidden cancelled order must
  not look like a sale without cancellations. Reporting never elevates to service
  role to bypass that restriction.
- Every section reads linked order statuses and refund records. Summary and channel
  sections skip order-item/category queries. Category amounts
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
- `dailyPendingData` and `monthlyPendingData` reuse validated current balances for
  those same active sales, currencies and sale-date buckets. In the chart, the amber
  **Pending** segment is stacked **above** the settled portion in a single column.
  Settled is active value minus current pending; it is not receipts by payment date.
  The complete stack equals active sales, never active sales plus pending. Channel
  views split the lower settled portion by channel, with pending at the very top.
  Unknown/inconsistent balances make that bucket's payment split unavailable, shown
  as an unclassified grey active-sales total. Missing legacy pending series are not
  inferred from monthly values, treated as zero, or used to classify all sales paid.
  The series reuse loaded rows without additional queries. The overview cache
  namespace is `v5` to retire responses without this series.
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
ROI uses an all-status sales basis distinct from Summary's active sales. The
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

No new schema migration or database RPC is added by the sales repair. Dated refunds
depend on the existing `20260929220300_accounting_sale_refunds.sql` migration; a
missing or inaccessible refund source fails the report instead of implying no
refunds. Historical provider refunds still require the separately approved backfill
described in `ACCOUNTING.md`. These changes do not establish
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