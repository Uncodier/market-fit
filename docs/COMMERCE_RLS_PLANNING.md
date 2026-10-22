# Commerce RLS planning and POS polling repair

## Scope

The forward migration
`supabase/migrations/20261021233000_bound_commerce_rls_planning.sql`
bounds expansion of the seven existing `location_acl_enforcement` policies on
deals, subscriptions, quotations, sales, sale orders, shipments and order items.
It does not disable RLS, remove a policy, grant access to application tables,
change compute or restart the database. Remote application and deployment
require explicit approval. Initial preparation was local only; see the verified
rollout section in [Resource amplification guards](RESOURCE_AMPLIFICATION_GUARDS.md)
for the later read-only confirmation of installed helpers and application rollout.

## Authorization boundary

- The original restrictive `ALL` policy, authenticated role and symmetric
  `USING`/`WITH CHECK` contract remain intact.
- Original expressions are copied from PostgreSQL, not reconstructed from a
  possibly stale migration. Only the reviewed UUID dependencies and global
  restriction gate are accepted. Unexpected schema, policy or helper state fails
  the whole transaction.
- Private PL/pgSQL helpers are **security invokers**, non-strict and non-leakproof.
  Parent reads still run with the caller's RLS and privileges. Existing definer
  role/licensing functions remain unchanged; no new definer is introduced.
- The global restriction predicate remains an outer statement-level subquery,
  not a cached value in an actor-settable configuration variable. A false gate
  returns the original unrestricted result without planning parent checks.
- Membership, license, buyer ownership, assignment, action, anonymous-denial and
  write-integrity policies/triggers are not replaced. Helper results alone are
  **not authorization** and must never be used as an RPC or Server Action grant.
- Expressions are deparsed with `search_path = pg_catalog` and their parent
  references remain schema-qualified. Caller-created temporary tables cannot
  substitute for a missing application table.
- Owner-context views with non-bypass owners require separate review and cause
  installation to fail. The optimization is not a universal transformation for
  arbitrary policies, views or database roles.

The private backup table records original expressions, policy identity, role,
command, permissiveness, dependencies and helper integrity. It has RLS enabled
and no application-role table grants. This is audit/forward-recovery metadata,
not a callable rollback endpoint.

## Schema evolution and rollout

PL/pgSQL parent references are planned inside the function rather than expanded
inside the outer policy. Parent-object rename/drop/recreation or policy changes
therefore require reviewing these helpers and rerunning the security tests.
Original dependency OIDs and qualified identities are retained. Replay rejects
renamed/replaced parent identities and revoked parent-column/function privileges.
This gate is not a substitute for PostgreSQL dependencies on every textual
statement: a later DDL operation is not intercepted automatically. Do not drop or
rename referenced objects as routine cleanup; review and update the helpers in
the same forward migration as an intentional schema change.

Installation requires the authenticated role's existing parent-column SELECT
and function EXECUTE privileges. Permission errors become lazy at runtime;
changing those grants later must be tested, including empty-result queries.
The migration deliberately refuses unreviewed parent privilege states.

Seven short exclusive table locks serialize policy inspection and replacement.
Acquisition is bounded to five seconds; the transaction is bounded to thirty
seconds. There is no data backfill. Apply the complete file through the approved
database-owner workflow, never individual helper/policy statements. Failure
rolls back the transaction. See `docs/DATABASE_MIGRATIONS.md`.

After an approved rollout, verify allowed and denied identities, both reads and
writes, then monitor query latency, memory, swap and Realtime recovery. A
successful migration alone does not prove that an infrastructure restart has
been resolved. No compute upgrade or automatic restart is part of this repair.

## POS synchronization

The POS now shares one pending orders pull per site until the underlying request
and local application have actually settled. Permission changes invalidate stale
results but do not release that slot prematurely. Failures retain the last local
snapshot and impose 30/60/120/240/300-second retry cooldowns. Force and visibility
events cannot bypass a failure cooldown; success and authorization changes reset
retry state.

Orders, catalog and outbox application lanes are independently guarded. A slow
orders promise does not hold the other lanes in the application, although Next.js
may serialize Server Actions itself.

The server-side orders/sales/seller query fan-out shares an eight-second abort
signal. All siblings settle before the cache computation finishes. This cancels
the actual SDK fetches, not just a client-side wait. Existing authorization and
cache lookups precede this deadline. The isolated demo client keeps its existing
non-network query contract.

This is not a distributed single-flight guarantee across browsers or server
instances. The shared Redis cache retains its existing fail-open recomputation
behavior when configured as optional; changing that shared behavior is outside
this repair.

## Local validation

Use the regression suites under `__tests__/pos` and `__tests__/security` and the
installed PostgreSQL 17 socket-only test harness. No test requires a production
database URL or credentials. Measure planning separately from execution; a
smaller plan is not sufficient if restricted-user execution regresses.

```bash
npm test -- --runInBand __tests__/security/commerce-planning-postgres.test.ts __tests__/security/commerce-planning-writes.test.ts __tests__/security/commerce-rls-planning.test.ts __tests__/security/location-review-postgres.test.ts __tests__/pos/orders-polling.test.ts __tests__/pos/open-orders-timeout.test.ts __tests__/pos/sync-engine.test.ts __tests__/pos/sync-policy.test.ts __tests__/pos/pos-order-read.test.ts
```

The PostgreSQL suites verify before/after read and mutation results, nullable
arguments, license and permission revocation, caller-visible parent policies,
column grants, schema/helper drift refusal, replay and native planning memory.
The SDK timeout tests use an injected offline fetch on a reserved test host.

The native security fixture also measures restricted and unrestricted execution.
In one 20-row run, restricted execution increased from approximately 489 ms to
656 ms while planner allocation decreased from 8 MiB to 256 KiB. This is an
explicit trade-off, not a universal query-speed improvement. Unrestricted POS
reads avoid the extra parent planning and showed no such regression in the
local measurements. Recheck restricted workloads before rollout; their access
must never be weakened to recover latency.

The investigation's reduced native PostgreSQL fixture showed approximately
152 MiB of planner allocation for a POS snapshot before the repair and 8 MiB
afterward. Those are laboratory measurements, not production session telemetry.
Validate the target's actual policies and workload before making production
performance claims.