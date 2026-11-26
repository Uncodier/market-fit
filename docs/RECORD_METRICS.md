# Record metrics

The Records detail Insights panel uses the same numeric widget for any collection:
campaign results, stock observations, project measurements, periodic reports, or
other numeric template fields. It does not infer financial or industry semantics.

## Display and comparison contract

- Every numeric field has a compact selectable value row, using its display
  label when configured. Missing, empty, invalid and non-finite values display
  `No data`; a real zero remains zero.
- Selecting a row always updates a visible detail, even without history, and shows
  only that metric on the chart when available. Unrelated units and scales
  never share an axis. Field names do not imply currencies, percentages, units,
  targets or whether an increase is good.
- Templates without relation fields compare saved records within the same site and collection.
  When a template defines a relation, an empty subject does not widen that comparison.
  One populated relation is selected automatically and disclosed. With multiple
  populated relations the user must choose the subject relation before a history
  request starts. The authenticated existing Server Action returns accessible
  records from the same collection and relation target under RLS.
- In **Edit Category Template**, select **Primary date for Insights** from the
  category's Date fields. Edit the value in the record's normal form (or clear it
  if optional) and save; the original creation timestamp is not changed. The category default drives the
  metrics timeline, activity summary, and dated preview history. It falls back to
  creation date for each missing or invalid value. Metrics disclose the count of
  fallbacks and exclude observations without any valid date. Categories without a
  configured field continue to use creation date. The chart's temporary manual
  Date-field override still excludes missing values rather than mixing dates.
- Timeline observations are saved records, not versions of a record. The current
  saved snapshot keeps its original date. Unsaved form values remain on the rows
  with a label and never enter history, averages or the predecessor comparison.
- The comparison is an absolute change in recorded units against the immediately
  preceding dated observation relative to the open record, not the newest record.
  Missing prior values and ambiguous duplicate prior timestamps suppress the
  comparison. There are no arbitrary percentage growth or good/bad colors.
- A trend requires valid values at two distinct timestamps. Missing values remain
  chart gaps. Settings and the observations table are collapsed by default (subject
  selection opens when required). The table exposes exact values and source-record links;
  its initial six recent rows can be expanded to all loaded observations.
- Loading, read failure with explicit retry, no relation, and insufficient history
  are distinct states. Changing record, collection, site or subject retires the
  previous history immediately; late responses cannot restore it.

## Boundaries

The widget reads existing data; it does not collect measurements automatically,
create audit versions, schedule reports or persist the viewer's selector choices.
Units belong in configured field labels until the schema supports validated unit
metadata. Separate currencies/cohorts require appropriately separated collections
or relation groups; the widget performs no conversions or cohort inference.

History uses the existing Server Action and its database response limits. Counts
are explicitly **loaded records**, not a claim that arbitrarily large histories
are complete. No backend, RLS, migration or production configuration change is
part of the original metrics repair. Relation-free timelines reuse the category-wide read;
subject timelines use only the selected relation group.

The primary date setting requires the forward migration
`20261126001000_records_primary_date.sql` before app rollout. It does not backfill
records or change category RLS. The category editor clears the setting if the
selected field is removed or changed to a non-Date type; direct updates must
explicitly clear or replace it in the same write.

## Local regression checks

```bash
npm test -- --runInBand __tests__/records/record-metrics.test.ts __tests__/records/RecordMetrics.test.tsx __tests__/records/use-metric-history.test.tsx __tests__/records/use-record-insights.test.tsx __tests__/records/InsightsTab.test.tsx __tests__/records/insights-source.test.ts
npm run typecheck
```

These are offline calculation, lifecycle and component tests, including the real
Recharts chart in a sized jsdom container. Additional local Chromium verification
used an isolated component fixture with the real widget, shared controls and app
CSS: metric selection with/without history, date switching, table expansion,
narrow layout and dark mode. Fixture data and a read-only permission context were
test-only; no production backend was replaced or mutated. This is not an
authenticated full-app or production acceptance test.