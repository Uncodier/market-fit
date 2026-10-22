# Residual operational RLS experiment

## Decision: rejected for rollout, not applied

`experiments/bound-operational-rls-planning.sql` is an **experimental forward-only
proposal**, not a deployable migration. It is deliberately outside
`supabase/migrations/`. No applied migration was edited and no remote migration
was applied by this work. Do not copy the proposal into the migration pipeline
without a new review and an explicitly approved target.

The proposal reuses the installed commerce planning barrier for eleven residual
operational tables. It retains each original restrictive, authenticated, symmetric
`ALL` expression from PostgreSQL and bounds it inside a stable, non-strict,
non-leakproof **security invoker**. The exact global restriction gate stays in an
outer statement InitPlan, with a false-only fast path; no actor-settable cache is
introduced. Parent reads retain caller RLS and privileges. Permissive/action
policies, grants, write triggers and the commerce backup remain unchanged.

New `operational_rls_private` backups retain catalog identities/dependencies.
Installation/replay reject unexpected policy shape, UUID dependencies, helper
signatures, parent privilege changes, schema/table ownership or access, helper
drift and non-bypass owner-context views. Only messages, task comments and task
categories may omit the site-role function because their original expressions
have no site column. This is not a blanket transformation of arbitrary policies.
As with the commerce template, later textual parent-reference DDL is not
automatically intercepted: future schema changes require a separate review.

## Isolated validation

```bash
npm test -- --config __tests__/security/jest.operational-offline.config.cjs --runInBand
```

The dedicated config does not load `next/jest`, environment files or application
setup. The reused PostgreSQL 17 harness creates a socket-only synthetic cluster,
never a configured database connection. Identities are generated at runtime.
The fixture installs the actual chronological location-enforcement corrections
and applied commerce barrier **before** the proposal, rather than comparing
against the obsolete pre-commerce state.

Final validation: **26/26 native tests passed** in approximately 65 seconds;
targeted ESLint for the new fixture, suite and config was clean.

Tests compare SELECT/INSERT/UPDATE/DELETE rows and SQLSTATEs before/after for
owner, admin, co-owner, restricted member, viewer, cross-site, inactive, disabled,
suspended, rejected and invalid-license actors, plus anon/service roles and
restriction removal. INSERT probes capture source values as fixture owner so
denied inserts really attempt `WITH CHECK`, not zero-row `INSERT SELECT`.
Hidden and cross-site parents remain denied to the restricted member. Nullable
row arguments and true/false/null global gates compare against the exact stored
original expression. A client-callable false-gate helper result grants no row
access through the actual policy.

**Fixture limitation:** the legacy permissive `old_projection` fixture policy
allows message rows to an inactive, unrestricted actor before and after. The
suite explicitly preserves and asserts that original behavior; it does not
claim inactive-user denial. Actual deployed permissive policies require a
separate review before claiming that the same issue exists in production. A
planning optimization must not silently change that authorization contract.

## Measured results and rollout blocker

All measurements below are local laboratory results, not production telemetry.
The fixture supplies legacy parent-policy shapes, so its modest post-commerce
planner allocations do not reproduce the deployed policy graph. Twenty complete
additional graphs plus baseline rows produced 21 permitted rows per populated
representative read. Timing is measured separately, never asserted as a fragile
wall-clock regression threshold.

One completed run measured these representative joined queries:

| Query | Planner allocated KiB before → after | Plan nodes before → after | Restricted execution ms before → after |
| --- | ---: | ---: | ---: |
| Units with item/shipment parents | 512 → 256 | 18 → 12 | 1201.438 → 1262.543 |
| Reservations with order-item parent | 256 → 128 | 12 → 9 | 737.921 → 749.626 |
| Tasks with conversation/deal parents | 512 → 256 | 21 → 13 | 57.758 → 72.284 |
| Messages with conversation parent | 512 → 256 | 16 → 13 | 36.158 → 47.469 |

This was a **2× allocation reduction**, not a universal ≥4× result, and restricted
execution increased for every representative query in that run. A separate run
also measured regression for units, reservations, tasks and messages. The broad
proposal is therefore **rejected for rollout**, despite equivalent authorization
outcomes and lower planner allocation. It is not a query-speed improvement.

The final expanded run showed timing variability rather than a stable universal
regression or improvement. Its exact measurements were:

| Query | Planner allocated KiB before → after | Planning ms before → after | Restricted execution ms before → after | Unrestricted execution ms before → after |
| --- | ---: | ---: | ---: | ---: |
| Units | 512 → 256 | 0.946 → 1.096 | 1671.419 → 1196.199 | 11.449 → 12.365 |
| Reservations | 256 → 128 | 0.903 → 0.711 | 760.577 → 819.137 | 9.189 → 8.982 |
| Tasks | 512 → 256 | 1.378 → 0.946 | 97.610 → 73.873 | 17.388 → 12.059 |
| Messages | 512 → 256 | 0.896 → 0.621 | 68.204 → 47.527 | 9.908 → 6.084 |
| Deep units | 1024 → 1024 | 4.698 → 2.185 | 1928.068 → 1575.926 | 23.215 → 22.710 |
| Empty units | 512 → 256 | 1.021 → 0.880 | 0.064 → 0.044 | 0.064 → 0.043 |

Deep-unit used memory decreased from 776 to 577 KiB, but allocated memory stayed
at 1024 KiB; nodes decreased from 34 to 28. The empty lookup returned zero rows.
These single-sample timings are not evidence of a reliable speed benefit and do
not erase the earlier restricted-execution regressions or the rollout blocker.

Single-table `SELECT id LIMIT 100` planner allocation in the final run:

| Table | Allocated KiB before → after | Nodes before → after |
| --- | ---: | ---: |
| conversations | 64 → 32 | 4 → 4 |
| tasks | 256 → 32 | 12 → 4 |
| reservations | 128 → 32 | 7 → 4 |
| sale_order_item_units | 256 → 32 | 10 → 4 |
| messages | 256 → 128 | 10 → 7 |
| task_comments | 1024 → 128 | 26 → 7 |
| task_categories | 1024 → 128 | 26 → 7 |
| shipment_location_pings | 128 → 32 | 7 → 4 |
| inventory_levels | 128 → 32 | 5 → 4 |
| transactions | 128 → 32 | 7 → 4 |
| pos_register_receipts | 256 → 64 | 10 → 4 |

The suite also reports planner used/allocated KiB, planning ms, node counts,
restricted/unrestricted execution and actual row counts for a deeper unit graph
and an empty unit lookup. It measures single-table plans for all eleven targets;
simple conversations keep the same node count. Results are printed as JSON for
fresh comparisons. No blanket node-ratio assertion applies to every table.

Before a narrower future proposal, measure the target's real parent policies,
query projections, identity distribution and restricted-user workload. Review
the cost of lazy invoker parent planning independently of outer-plan memory.
Do not weaken authorization or promote a broad wrapper merely because its
outer plan is smaller. Forward recovery would restore catalog-saved originals
through a reviewed new migration, not expose a callable rollback helper.