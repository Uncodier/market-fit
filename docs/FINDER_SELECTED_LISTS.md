# Finder selected-person lists

Finder's selection toolbar exposes three distinct operations:

1. **Add to list** appends selected provider person IDs to an existing accessible
   list for background enrichment.
2. **Create list** saves a new named list containing only selected people, not the
   complete search result or its filters.
3. **Enrich selected** invokes the existing immediate person enrichment flow.

The first two operations persist at most 100 selected IDs per request. They do
not spend provider credits or run enrichment in the browser. Background processing
depends on the configured dispatcher, enabled site enrichment and available credits.
Selected-only lists are not hydrated as empty provider searches.

## Boundaries

The same-origin proxy authenticates and checks site capabilities, input size,
provider ID syntax, list ownership through RLS and insert/update permission.
The API independently verifies the bearer and calls atomic authenticated RPCs.
Receipts scoped to actor/request UUID prevent duplicate creation or repeated
membership insertion after an uncertain response. Client retries reuse the request
UUID for unchanged payloads; confirmed saves clear only the submitted selection.

`restrict_to_assigned_only` applies to destination lists through the existing
ownership migration. Membership creator attribution comes from the authenticated
actor, never a browser-provided owner. Background work must use persisted creator
attribution and preserve its execution budgets and checkpoint ownership.

## Rollout

This feature requires matching web, API and Workflows deployment, plus forward
membership and consumption migrations, in order:

- `20261117220000_finder_selected_list_members.sql`
- `20261117221000_icp_selected_people_consumption.sql`
- `20261117221100_icp_selected_people_dispatch.sql`
- `20261117221200_icp_selected_people_claim_payload.sql`

Copies in API, web and the canonical schema repository describe the same four
changes, not separate migrations to run repeatedly. No remote migration or deployment is
authorized by the UI implementation alone. Existing ownership migration application
does not install selected-list membership tables or background consumers.

Offline web regression coverage:

```bash
npm test -- --runInBand __tests__/app/people __tests__/api/finder-proxy.test.ts __tests__/api/saved-list-members.test.ts __tests__/app/services/finder-api-client.test.ts
```

Provider-backed acceptance must be verified separately in an explicitly selected
environment; offline tests do not demonstrate live enrichment or production rollout.

Appending to a historical completed search list preserves its cursor, but may
resume the next search page after selected entries are processed if provider
exhaustion was never recorded. Selected-only lists never run provider search.
The picker shows only RLS-accessible lists; write authorization is rechecked on
submission. Saved lists use the same result table, toolbar and pagination as
search, with Processing, Outcome and Lead columns for their persisted members.
For filter-based lists this shows explicitly appended people, not a reconstructed
history of search pages. Opening a filter-based list with no saved members runs
its original filters automatically and may consume search credits. If the list
already has members, **Run saved search** remains optional. Opening a list never
starts enrichment. The breadcrumb identifies the open list; its parent returns to the search filters on desktop and mobile. Generated leads link to their detail pages
only when the member's persisted lead is accessible under RLS. Existing leads are
not matched by name or automatically interpreted as completed processing. Missing
profiles retain the exact provider ID; completion can include `no_match` or
`needs_review`, not only generated leads.
Removing members is not part of these buttons.

Pregenerated selected-person lists share the responsive result frame with search
results, preserving workspace/sidebar offsets, the desktop filter toggle and the
mobile return to the search filters. Session initialization and same-user token
refreshes do not cancel loading, retry or pagination. Sign-out or an actual actor
change retires in-flight reads and clears displayed members, including when the
original actor signs back in before a stale response arrives. Result transitions
clear row selections and pending confirmation dialogs. List saves and enrichment
recheck the result/session scope after auth resolution and before sending. Already
accepted requests are not cancelled; a retired batch sends no additional people.

`GET /api/finder/lists/[id]/members?site_id=...&page=...` verifies authenticated site
access (including unrestricted location access), then the visible parent and its
25-member page using the caller's RLS. It does not read global `persons` records
or use service credentials. Display fields come from the same-site, RLS-visible
lead linked to the member. Its optional Finder snapshot must match the exact
provider identity; role and company details are matched by organization identity.
The response excludes raw documents and contact fields. Members without an
authorized linked lead retain their provider ID, even if a global profile exists.
Reading saved membership requires no migration, worker change or provider expenditure.
The displayed processed count comes from completed membership, not historical
aggregate search counters. This UX consolidation does not repair worker incidents
or reconcile existing inconsistent data.