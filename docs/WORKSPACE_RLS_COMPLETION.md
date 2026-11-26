# Workspace membership performance completion

## Applied November 26, 2026

At **20:08:58 UTC**, shared Makinari received these two forward migrations in one
transaction, with exact-source history and certificate/hostname-verified TLS:

- `20261126201000_bound_remaining_screen_membership.sql`: Content, Requirements,
  Segments, Deals and deal-owner membership reads.
- `20261126201001_bound_robot_membership_sets.sql`: Robots parent membership and
  ownership SELECT sets, following the earlier duplicate-check removal.

Canonical and web copies match. No helper is replaced, no service-role shortcut
or stored permission cache is added, and no business data or roles change. Existing
restrictive policies remain authoritative. Content retains its historical direct
author/user branches; Segments keeps its service wrapper; Deals retains the
location-aware ownership helper and deal owners retain visible-parent authorization.
Robots preserves NULL restriction flags, co-owner/license rules, operation guards
and the explicit historical WITH CHECK.

## Evidence

Thirteen new remaining-screen and twenty new Robots real PostgreSQL tests passed.
Coverage includes exact visible IDs, anonymous/missing identity, member/owner roles,
write admission, revocation, drift refusal and scaled authorization work. Robots
tests install the actual late-renewal seat functions, including grant/reversal.
Targeted ESLint passed. Synthetic guards do not replay every procurement policy.

Remaining-screen site/member scan counts at 1,000 candidate rows went from
`[2018,2018,2018,2018,2032]` to `[6,6,6,6,9]`; at 4,000 rows the latter counts
remained constant. Robots' synthetic 1,000-instance count went from 1,004 ownership
helper calls to zero and 1,004 capability calls to one. The unchanged asset summary
RPC also did less work, but its asset-specific authorization still has per-row costs.

Production rollback rehearsals and an independent post-commit connection compared
fourteen owner/restricted result digests, including complete asset-summary payload
digests. All matched. Single restricted-actor SQL measurements were:

| Read | Before | After |
| --- | ---: | ---: |
| Content | 859 ms | 68 ms |
| Requirements | 444 ms | 29 ms |
| Segments | 183 ms | 34 ms |
| Deals | 152 ms | 50 ms |
| Deal owners | 219 ms | 98 ms |
| Robots | 814 ms | 40 ms |
| Asset summaries | 1,342 ms | 482 ms |

These are point measurements, not browser latency or an SLA. Owner set-building
can cost more than the previous cheap owner branch: several small owner lists
increased by tens of milliseconds in this run. Large owner workspaces and asset
summary authorization need continuing observation; universal speedup is not claimed.

## Chat parent lookup follow-up

`20261126201002_bound_message_parent_lookup.sql` was applied separately at
**20:15:30 UTC**. It replaces actor-wide conversation/lead materialization with
correlated primary-key parent checks, retaining caller RLS and `OFFSET 0` to
prevent the optimizer from restoring an actor-wide hashed parent set. Both
conversation and message policy fingerprints are checked before replacement.
Direct identity branches, implicit write checks and historical cross-site lead
semantics are preserved. No helper or grant is added.

The initial message-only candidate timed out in rollback rehearsals. A diagnostic
plan placed most execution time in the inherited conversation policy's actor-wide
lead scan. The final candidate also bounds that lead lookup. Two completed final
rehearsals preserved all four owner/restricted list and thread payload digests.
Restricted list timings varied from 3.55 seconds to 95 ms, so no cache-cause or
uniform latency claim is made. The unchanged owner result returned in 253 ms in
the second run. The initial candidate was never committed. Independent post-commit
verification preserved all four payload digests and measured the restricted inbox
at 110.652 ms and the owner inbox at 275.492 ms.

Eight new real PostgreSQL tests include conversation-only lead lookup bounds,
complete inbox lateral joins, direct-message threads, 21-thread batches and broad
reads across 24 sites/12,000 unrelated conversations. Targeted parent work dropped
from over 12,000 rows to 3 rows for a three-message thread and 21 for the inbox.
Full unfiltered message scans may be slower because they perform one indexed
parent probe per message; this is a deliberate targeted-screen tradeoff, not a
universal reporting-query optimization. Tests preserve identity, parent visibility,
write/revocation semantics and fail-closed policy drift.

## Compatibility and operational limits

Anonymous Deals INSERT remains denied with SQLSTATE `42501`; initialization of
the unchanged ownership helper can change the technical error from row-policy
denial to `permission denied for function is_deal_owner`. The differential test
asserts only this exact known message difference; no new execute grant is added.

The schema locks have two-second acquisition limits. Fingerprints reject unexpected
policy/helper/parent-policy state. Serialize privileged schema deployments; table
locks do not fence all function DDL. No unrelated migration, application deployment,
production build or Git publication was performed. Applied migrations are immutable;
future corrections must be forward-only. Browser acceptance remains outstanding.