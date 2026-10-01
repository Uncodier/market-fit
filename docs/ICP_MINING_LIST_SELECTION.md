# Pending ICP mining list selection

## Settings contract

The Activities tab's **ICP Lead Generation** card stores these additional keys in
`settings.activities.icp_lead_generation`:

```json
{
  "status": "active",
  "target_leads": 150,
  "research_enabled": false,
  "all_lists": true,
  "list_ids": []
}
```

- `all_lists`: a boolean, default `true` for missing/legacy settings. All mode
  dynamically includes this site's eligible lists, including future pending lists
  and running lists that can resume; it does not save a snapshot of today's IDs.
- `list_ids`: an array of UUID strings, default `[]`. Input arrays allow at most
  1,000 entries, then normalize to canonical lowercase and deduplicate in order.
  Malformed values (including null, non-UUID entries, non-arrays and non-boolean
  `all_lists`) or oversized arrays block saves. They are not silently dropped or
  truncated during hydration.
- `all_lists: false` uses only `list_ids`. An empty array is valid and explicitly
  means **no mining work**, never all lists. Switching all mode on retains saved
  individual selections but ignores them until all mode is switched off again.
- Existing target, research and always-active behavior is unchanged. Mining does
  not send outreach. This selector does not start a workflow or change cadence,
  budgets or the existing one-request-per-run behavior.

Daily runs are distributed by site over 24 hours, independently of business hours
and weekends. There is no configurable fixed start time for ICP. The optional `start_time` controls
in Activities apply only to Daily Standup and Follow Up; list selection does not
change that scheduling contract.

The shared [schema and normalizer](../app/components/settings/icp-lead-generation-settings.ts)
feed activity normalization, form defaults/hydration, schema parsing, Activities
saves, Save All, and direct settings persistence. Existing merges preserve unknown
ICP keys, neighboring activity parameters, and future activity keys. Shape
validation does **not** query mining lists or require selected lists to stay
pending forever; status changes and list read failures do not prevent saving.

### Delayed settings and partial saves

[Activity hydration](../app/components/settings/use-activity-hydration.ts) rebases
the activities' default values to each incoming snapshot and restores only local
parameter edits. Editing Email Sync no longer blocks incoming ICP settings;
editing the ICP target does not block incoming research or list selection. Arrays
and selection maps are single parameters. An incoming manual-empty selection is
the clean baseline, so switching back to all mode is dirty and savable. Site
changes discard the previous site's activity edits.

The Activities UI submits only changed activity parameters. Both save handlers
keep partial updates partial after validation, until the existing settings writer
merges them with the latest readable row. This prevents synthetic form/context
defaults from widening persisted selection when saving before hydration. Legacy
string updates are status patches, not replacements for configured activities.

Save completion acknowledges only submitted activity fields for the same mounted
site, never globally resets the form, and preserves changes made while saving.
Activity save buttons are coordinated while a request is pending. The settings
writer owns the merged local state; an activity save does not issue a second site
update using stale context. This is not transactional conflict resolution between
multiple browser sessions; the existing read/merge/write persistence boundary is
unchanged.

## Selector and reads

[ActivitiesSection](../app/components/settings/ActivitiesSection.tsx) passes its
site ID (or current context site's ID) to
[IcpLeadGenerationFields](../app/components/settings/IcpLeadGenerationFields.tsx).
The nested [selector](../app/components/settings/IcpMiningListSelector.tsx) uses
existing form, checkbox, button and progress components. It displays:

- **All pending lists**, followed by scrollable individual list checkboxes;
- each list's name, processed/total targets, progress, and **Pending** or
  **Running — resumable** status;
- loading, sanitized error/retry, refresh, missing-site and empty-list states;
- clear no-work text for empty explicit selection or only unavailable selections.

[List reads](../app/components/settings/icp-mining-lists.ts) use the authenticated
same-origin [read-only route](../app/api/settings/icp-mining-lists/route.ts), with
browser credentials, no caching, explicit `site_id`, and statuses `pending` /
`running`. It returns only the fields displayed by the selector.
Unique immutable `id` ascending keyset pagination reads every page, not just the
first 50 rows. It continues until an empty page, including when a server caps
responses below the requested 200 rows. Errors discard partial results. An
invalid response or non-advancing cursor fails closed rather than looping.

[The hook](../app/components/settings/use-icp-mining-lists.ts) hides old-site options
on site changes, aborts obsolete requests, and ignores late results/errors after
site changes, refreshes or unmount. Loading lists never updates saved selections.
Reads are not a transactional snapshot: a list can change status after loading,
and newly inserted lists can appear after refresh or the next backend read.

After a successful full read, saved IDs absent from the options remain removable
and labeled **Unavailable list — completed, deleted, or no longer available on
this site**. The selector does not fetch foreign/deleted names to label them.
During loading/errors they are labeled **Saved list — availability not verified**,
not assumed completed. Removing IDs is always explicit, even in all mode.

## Authorization and execution boundary

The read route validates UUIDs and verifies the caller's site membership with
`requireSiteAccess` before constructing a server-only service client. Its database
query always filters by the authorized `site_id` and eligible statuses. This is
necessary because the existing browser SELECT policy relies on role-query
segments and can omit pending lists with no segment. Policies and production data
are unchanged. Settings still save through the existing authenticated client/RLS
path. Client filters and validation are not an authorization boundary.

Workflows enforce the site, eligible status and selection filter at execution-time
reads. With explicit selection, stale or foreign-site IDs are ignored without
falling back to all lists. A valid empty selection produces no work. This change
does not start workflows, mutate mining rows, or need a new database migration.

## Local evidence

Run the Jest settings and route regression suites (service boundaries are mocked):

```bash
npm test -- --runInBand __tests__/components/settings __tests__/api/icp-mining-lists.test.ts __tests__/api/api-site-access.test.ts
```

Focused selection coverage is in `icp-mining-list-settings.test.ts`,
`icp-mining-lists.test.ts`, `icp-mining-list-selector.test.tsx` and
`use-icp-mining-lists.test.tsx`, alongside the existing ICP fields/settings and
expanded persistence suites. These cover defaults, subset/empty/stale selection,
UUID validation and limits, no availability lookup on save, error/retry, paginated
site/status reads, cancellation/site changes, unknown-key preservation, and
roundtrips through Activities, Save All and direct settings saves. Persistence
uses an in-memory user-session/RLS double, not live authentication or RLS evidence.
The route suite exercises the actual site-access helper with mocked sessions and
role RPCs: missing credentials, signed-out sessions, denied membership, malformed
requests, cross-site filtering, unsegmented lists, pagination and error sanitization.

`activity-hydration-persistence.test.tsx` runs the actual hydration hook, activity
controls, save handlers and settings writer together against an in-memory row.
It covers delayed manual-empty hydration, neighboring and same-activity edits,
pre-hydration partial saves, saves racing hydration/new edits/site changes, and
legacy status writes. `activity-settings-merge.test.ts` covers typed parameters,
unknown extensions and legacy statuses on both sides of a merge. The initial 15
regressions failed before the repair; two additional refresh-avoidance cases
cover partial writes through the optimistic path.

No build, deploy, remote migration, production write or live browser test is
required for this local regression command.