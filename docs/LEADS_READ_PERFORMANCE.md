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

The sparse assigned-only regression uses synthetic data with 3,056 site leads and
59 visible rows. It compares the exact visible IDs before and after the policy
change, preserves owner visibility, and bounds parent-policy scans for the list,
count and combined request. Six focused Jest suites passed (34 tests), including
real socket-only PostgreSQL, on November 26, 2026.

## Rollout — applied November 26, 2026

Only `20261123183000_bound_leads_rls_membership.sql` was applied to shared Makinari
at **19:25:30 UTC**, after explicit repair approval. Canonical and web copies
match; the exact-source history entry committed atomically with the policy.
TLS certificate and hostname verification remained enabled. The migration refuses
policy drift and limits acquisition of its DDL lock to two seconds.

Production verification used `SET LOCAL ROLE authenticated` and transaction-local
actor claims, not a service-role row read. The restricted member's exact visible
IDs and the owner's IDs matched the expected sets before commit. An independent
connection confirmed one exact-source history entry and no unrelated visible leads.
The restricted-member list with its company join took 90.432 ms and the count
24.180 ms in single production SQL measurements; these are not browser latency
or a performance SLA. The location and anonymous policies remain unchanged.

No lead, assignment, membership, license, index or application deployment changed.
Browser confirmation from the affected session and longer-term timeout monitoring
remain separate checks. Use a forward corrective migration if rollback is needed;
do not edit or replay this applied migration.