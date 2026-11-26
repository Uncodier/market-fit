# Robots read policy candidate A — applied

Applied to shared Makinari at **2026-11-26 19:50:51 UTC**, atomically with the
Chat/Tasks membership optimization. Exact canonical/web source history was
verified independently. A rolled-back production rehearsal preserved the exact
restricted actor instance IDs; an independent post-commit read confirmed the same
set. This remains a narrow duplicate-check removal, not the broader ownership
optimization. Browser acceptance and sustained performance remain unverified.

## Exact scope

`20261126195001_bound_robot_read_permissions.sql` changes only the `USING`
expressions of the restrictive, authenticated SELECT policies named
`instance_ownership_select` on `public.remote_instances` and `public.instance_logs`.

- Instances retain `instance_row_access(site_id,user_id,created_by)`. That exact
  deployed helper already requires `user_can(site_id,'select') IS TRUE`; the
  duplicate outer capability call is removed.
- Logs retain the invoker-scoped `EXISTS` read of a visible same-site instance.
  The parent's restrictive ownership helper already requires that site's read
  capability. The duplicate log capability call is removed, not the parent read.
- Parent ownership, attribution, licensing, location/procurement policies, grants,
  triggers, writes and all other child-table policies are unchanged. No functions,
  indexes, data, roles or settings are replaced. No authorization cache is added.

This migration excludes broader ownership optimization. The subsequent
`20261126201001_bound_robot_membership_sets.sql` was applied at **20:08:58 UTC**;
see [Workspace RLS completion](WORKSPACE_RLS_COMPLETION.md) for its separate
authorization checks, tests and unchanged asset-summary RPC verification.

## Read-only deployed catalog evidence

On **2026-11-26 at 19:46:26 UTC**, catalog queries against linked Makinari
(`rnjgeloamtszdjplmqxy`) ran inside `BEGIN READ ONLY` with a ten-second statement
timeout, `search_path=public,pg_temp`, and `transaction_read_only=on`, then rolled
back. Transport used the approved session-pooler helper with TLS certificate and
hostname verification. The main agent independently confirmed the same function
and policy fingerprints through Supabase MCP. No business rows were queried or
remote migration executed by this candidate's validation.

Exact `md5(pg_get_functiondef(...))` values:

| Function | Fingerprint |
| --- | --- |
| `instance_row_access(uuid,uuid,uuid)` | `469ebb69538fec7b383716b16bdf7f30` |
| `user_can(uuid,text)` | `1787c52b61c973bcc26917af2a1a4137` |

Both are owned by `postgres` and SECURITY DEFINER. The former has an empty search
path and EXECUTE for postgres/authenticated/service_role; the latter has
`search_path=public,row_security=off` and EXECUTE for postgres/anon/authenticated/
service_role. The migration checks the complete exact definitions, owner and ACL,
not a substring that merely mentions `user_can`.

Exact `md5(pg_get_expr(polqual,polrelid))` under the pinned search path:

| SELECT policy table | Fingerprint |
| --- | --- |
| `remote_instances` | `be82d41441bf05123e4f35aa4de49004` |
| `instance_logs` | `0800e622235ecc7f86cb09c354068553` |

Both tables are ordinary tables with RLS enabled, FORCE RLS disabled. Both target
policies are restrictive SELECT, authenticated only, with no explicit WITH CHECK.
Existing location, anonymous and procurement guards and permissive access policies
were observed; none is changed. Role OIDs are resolved on the target, not hardcoded.

## Fail-closed installation and rollout gates

The transaction acquires both table policy-DDL locks before catalog checks and
aborts for missing or changed prerequisites. `lock_timeout=2s` bounds each lock
wait; `statement_timeout=10s` bounds each statement. No table scan or rewrite is
performed. ACCESS EXCLUSIVE locks briefly block reads and writes, so schedule
installation with attention to active transactions. These are not a ten-second
whole-transaction deadline.

Serialize schema deployment: these table locks do **not** fence a concurrent
privileged `CREATE OR REPLACE FUNCTION`. A concurrent helper deployment is outside
the migration's locking guarantee. Exact definition fingerprints intentionally fail
closed on formatting/deparser or ACL changes too; do not loosen them without a
fresh target review. A replay rejects the already-changed policy baseline.

The canonical copy matches the applied web migration. Explicit target approval,
fingerprint checks, canonical mirroring and exact-source history preceded commit.
Continue checking real sessions, logs/direct instance URLs and production query
telemetry. Reversion requires a reviewed forward migration restoring just the two
previous predicates, not editing applied history.

## Local differential PostgreSQL evidence

```bash
REQUIRE_REAL_POSTGRES=1 REPORT_ROBOTS_CALLS=1 npm test -- --runInBand __tests__/robots/read-rls-postgres.test.ts
npx eslint __tests__/robots/read-rls-postgres.test.ts __tests__/robots/read-rls-postgres-fixture.ts
```

Result: **21 new tests passed**. A combined run with
`__tests__/robots/instance-ownership-rls.test.ts` passed **75 tests in two suites**
with no skips (30.495 seconds). Targeted ESLint and `git diff --check` passed.
An initial combined run exceeded the shell tool's 30-second execution limit;
its disposable cluster was cleaned up and the complete background rerun exited 0.

The suite uses the existing socket-only PostgreSQL harness; no configured database
URL is consumed. The new fixture reuses the existing real capability/licensing
function chain read-only, installs the historical ownership migration, and matches
the deployed helper ACL. Existing shared fixture files are not modified.

Differential tests compare before/after exact IDs and filtered totals for owners,
co-owners, admins, unrestricted/assigned/null-flag members, inactive/pending/disabled/
unlicensed/lapsed/archived actors, outsiders, missing identity, anon and service role.
They include fresh revocation, same-site hidden parents, cross-site/missing/null
parents, independently hidden parents, attribution, allowed/denied writes, unchanged
non-target catalog objects, fail-closed fingerprint drift, replay and a real
contended-lock timeout with atomic retry.

Real PostgreSQL function execution counters, without modifying the pinned helpers,
showed this synthetic site count returning two rows throughout:

| Query | `user_can` before → after | `instance_row_access` before → after |
| --- | --- | --- |
| Instances count | 6 → 4 | 4 → 4 |
| Logs count | 14 → 4 | 4 → 4 |

These are execution-count evidence, not production latency, a full Supabase schema
replay, or browser acceptance. Deliberately permissive synthetic base policies make
the restrictive ownership guards independently observable. Other restrictive
parent hiding is represented synthetically; the fixture does not replay every
deployed procurement policy. Real licensing/capability functions are used, but
the entire evolving dependency graph is not fingerprinted by this narrow migration.

No business DML, Git publication, dependency update, production build, application
deployment or unrelated working-tree edit was performed for this correction.