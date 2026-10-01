# Traffic report data contract

`GET /api/traffic/attribution` uses the existing analytics authorization and
date-range validation. `siteId`, `startDate`, and `endDate` are required; an
omitted/`all` `segmentId` is accepted, while any non-all segment is rejected
with 422 before creating an elevated client. Authentication and site access
are checked before the response cache, including cache hits.

The response contains `segments`, `campaigns` (arrays of `{ name, value }`),
`coverage`, `model: "session_entry"`, and `segmentMembership: "current"`.
Each session contributes one vote per attribution dimension, including the
`Unassigned segment` and `No campaign` buckets. The six largest named categories
are shown alongside any missing bucket and an `Other` residual. Bucket totals
always sum to `coverage.totalSessions`. Recorded names colliding with synthetic
buckets are escaped using `Recorded: `, including the escape prefix itself.

## Meaning and limitations

- Campaign means **campaign UTM**: a nonblank recorded `utm_campaign`, otherwise
  a valid `landing_url` query parameter. Lead CRM campaign relationships and
  mutable `current_url` never supply acquisition attribution.
- Source and medium follow the same recorded-field-first, landing-query-second
  precedence. Landing fallback is bounded to 8192 URL characters and 512 decoded
  characters per parameter; control characters and malformed decoding are
  rejected. Parameters are lowercase/exact; first duplicate wins, and fragments
  are not query parameters.
- `attributedSessions` counts an identifiable source: UTM source, Google/Microsoft
  ad click ID, or valid external referrer. `unattributedSessions` is the remainder.
  Medium/campaign-only tags do not identify a source by themselves, but remain
  visible as tagged referrals rather than being labeled direct. `fbclid` alone
  is not proof of paid traffic.
- `campaignSessions` counts campaign UTM evidence, independently of source
  coverage. `segmentedSessions` counts safely resolved current membership.
- Segment precedence is session-linked lead segment, then visitor segment. The
  lead and resolved segment must belong to the authorized site. Nullable to-one
  FK embeds are scoped and checked defensively; visitors have no `site_id`.
  No visitor lead fallback or historical segment snapshot is inferred.
- Missing/malformed referrers are `Direct / unknown`, not proven direct visits.
  Same-host navigation and navigation between Makinari properties are
  `Internal navigation`. A Makinari referrer to a non-Makinari site is external.
  With no absolute landing host, the legacy Makinari internal fallback applies.
  Provider recognition uses exact hostname/domain boundaries, not substrings.

## Complete loading and bounded errors

All six routes use `loadTrafficSessions`, constrained to the authorized site and
inclusive `created_at` date range. Pagination orders by immutable session ID and
continues after short pages until an empty page. To-one relations do not have
separate list-pagination limits or remove unassigned sessions from the result.
There is no transactional snapshot across requests: concurrent new sessions or
membership edits may affect a refresh. Cursor ordering does not use mutable
activity timestamps.

The loader admits up to 50,000 sessions, with an additional one-row lookahead.
An oversized range returns 422 with `code: "TRAFFIC_SESSION_LIMIT_EXCEEDED"` and
`maxSessions: 50000`, instructing the caller to shorten the range. Failed later
pages produce a sanitized error, never partial successful totals. Errors are
not response-cached. Cache namespaces are attribution v1 and breakdown v3.

Referrals, devices, browsers, and regions keep the top ten categories plus an
`Other` residual and retain missing metadata. Unknown devices are not assumed
desktop, and nested device OS objects are supported. The legacy pages report
counts distinct landing/current URL observations (up to two per session), not
event pageviews; missing URLs contribute one `Unknown Page` observation.

Focused regression suites are `__tests__/lib/traffic-*.test.ts`,
`__tests__/api/traffic-attribution-route.test.ts`, and
`__tests__/api/traffic-distribution-reports.test.ts`. All database and cache
transports in these suites are isolated test fixtures.