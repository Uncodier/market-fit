# Report exports

The Reports top bar exports **the current section as CSV**, not every section of
the report. Visit another section to export its datasets. The dedicated Costs
page uses the same exporter, including its campaign filter.

Exports reuse the validated data already loaded by the frontend. Clicking Export
does not call another reporting endpoint, repeat calculations on the server or
load unvisited sections. The obsolete `/api/dashboard/export` endpoint has been
removed: it always exported Overview metrics using a separate filter state.

## Scope and completeness

- The filename identifies the site, report, section and selected calendar dates.
- CSV rows include the selected dates, browser time zone, site and segment, along
  with dataset-specific filters and source metadata. Monetary sources retain
  their currency; no currency conversion is applied.
- Only mounted resources for the current account, site, dates and segment are
  registered. The exporter never enumerates historical entries in the SWR cache.
- Every required dataset must finish loading successfully before Export is
  enabled. Refreshes and errors disable downloads, including stale click handlers.
  Changing sections, filters, currency, site or account invalidates the prior data.
- Missing values remain unavailable, not zero. Genuine zero values and empty
  datasets remain distinguishable. Source coverage, comparison bounds and
  definitions are included where supplied.
- Recent activity exports the loaded, site-wide feed (currently up to six items),
  not all historical records. Session referrers retain the source's top-ten limit.
  Social posts include the loaded publication cohort, not just the visible page.

## Implementation

`app/dashboard/export/ReportExportScope.tsx` registers resources through
`app/hooks/use-report-resource.ts`. A per-scope registry publishes readiness and
the download action to the top bar. Registrations disappear on unmount; exports
are never persisted in browser storage.

Section-specific projections live in `app/dashboard/export/report-export-data.ts`
and adjacent modules. CSV serialization preserves numeric precision, quotes
delimiters/newlines, escapes spreadsheet formula prefixes in text and downloads
UTF-8 files. Backend authentication and authorization remain in the original data
routes and Server Actions; frontend export registration is not an access grant.

Exporting does not independently audit or repair the source metrics. Existing
source date-boundary, aggregation and provider-coverage limitations also apply to
the downloaded data; the export is not a separate accounting reconciliation.

The four legacy traffic KPI routes now reject database failures rather than cache
false zeros, and obtain identity from the authenticated session. Their existing
calculations were not redesigned here: calendar-date upper bounds are still
midnight-inclusive, previous/current ranges share a boundary, session duration and
visitor-to-lead reads remain unpaginated, and client conversion uses any recorded
sale linked to the lead cohort. These source limitations require a separate metric
audit; CSV exports preserve the same loaded KPI values as the screen.

When adding a report section or changing its mounted sources, update its expected
resource list and projection together, and add regression coverage. Avoid raw
provider JSON or unrelated internal fields in the export.