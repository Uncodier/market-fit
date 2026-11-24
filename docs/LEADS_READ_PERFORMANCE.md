# Leads list and count performance

## Evidence

During the November 23, 2026 degradation, Supabase logged two recurring failing
`leads` reads: the site-scoped list ordered by `created_at` with the company name
embed, and the separate browser `HEAD` exact count for the same site. PostgreSQL
logged `57014` in the nested `current_user_site_role` or `effective_site_plan`
checks. The site and site/date indexes already exist. These reads continued to
time out after the immediate Auth recovery; they are not offered as the cause
of the earlier Auth outage.

## Changes

- `20261123183000_bound_leads_rls_membership.sql` rewrites only `leads_unified`.
  Lead-independent site and membership sets can be hashed per statement instead
  of evaluating parent policies per lead. The site read still uses its own
  archival and license policies. Owner/co-owner rules, active membership,
  creator-or-assignee visibility, NULL assignment flags, service access, and
  implicit checks on inserted/updated rows keep their existing meaning. The
  restrictive location/anonymous policies are untouched. No new indexes, RBAC
  cache, privileged client, or `SECURITY DEFINER` function are added.
- The Leads list and its search keep one user-scoped PostgREST request for rows
  and the exact total in the fast path. If that request reaches the five-second
  deadline, returns `57014`, or returns a gateway `504` not identified as pool
  exhaustion, the same action tries once more without the exact count. It uses
  the same session, site, segment, search filters and range and a separate
  five-second deadline. SDK retries and automatic SWR error retries are disabled
  for this path. Authorization and other errors do not start a second query.
- The table labels a missing total as unavailable, not zero or an exact count
  inferred from the loaded page. If the list also fails, a **Retry** action
  revalidates just the list without a document reload. Confirmed access errors
  continue to retire private rows. The old browser `HEAD` call does not return;
  Kanban status counts and list-only consumers still use their existing reads.

## Local verification

```sh
REQUIRE_REAL_POSTGRES=1 REPORT_LEADS_PLANS=1 npm test -- --runInBand \
  __tests__/leads/read-rls-postgres.test.ts __tests__/leads/segment-read-actions.test.ts \
  __tests__/leads/read-with-optional-count.test.ts __tests__/leads/page-read-recovery.test.tsx \
  __tests__/leads/page-data-hooks.test.tsx __tests__/leads/search-loading.test.tsx
```

The socket-only PostgreSQL 17 test uses synthetic data (29,825 leads, 6,096 in the
measured site) and `SET ROLE authenticated` as a licensed collaborator. In one
`EXPLAIN (ANALYZE, BUFFERS)` run, the 1,000-row list went from 2,002 parent scan
loops and 226 ms to 4 loops and 6 ms. The exact count went from 12,194 loops and
1,353 ms to 4 loops and 5 ms. The regression asserts the work reduction, not a
wall-clock threshold. These are isolated measurements, not production latency.
The suite also compares allowed rows, exact totals, and write checks before and
after the migration for representative allowed and denied roles.

## Rollout

The migration is a local candidate, mirrored in the canonical schema repository.
It refuses policy drift and limits its acquisition of the required DDL lock to
two seconds. Plan a low-traffic rollout and apply the migration before releasing
the combined list/count read. Check authenticated list/count plans and access for
an owner and an assigned-only member. In production, compare `leads` request
latency/`57014` rates and confirm the standalone browser total request disappears.
Use a forward corrective migration if policy rollback is needed; do not edit or
replay an applied migration.