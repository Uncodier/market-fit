# Chat and Tasks membership read performance

## Applied scope

`20261126195000_bound_chat_task_membership.sql` was applied to shared Makinari
at **2026-11-26 19:50:51 UTC** with the narrow Robots read-policy correction.
Only the existing membership policies on tasks, conversations and messages change.
Canonical/web source copies and single exact-source history entries were verified.
Application deployment is not required for this policy-only change.

Actor-independent site/lead/conversation sets replace correlated per-row membership
lookups. All parent reads retain caller RLS, licensing and archival checks. The
original direct user/visitor/agent branches, NULL identity behavior and implicit
write checks are preserved. A visible conversation alone does not grant access to
its messages. Location, internal-review, procurement and anonymous restrictions
are not removed or rewritten. No indexes, privileged reader or permission cache
were introduced.

## Verification

Five new socket-only PostgreSQL tests compare exact visible IDs across access
classes, NULL identities/restriction flags, visible cross-site leads, revocation,
write checks and policy drift. Synthetic scale checks bound parent scans instead
of asserting wall-clock speed. Existing conversation-query and Control Center
data-hook tests also pass: 14 tests across those three suites. The Robots change
has its own 21 passing PostgreSQL tests. Targeted ESLint passed.

Production rehearsals rolled back. Pre-change full conversation reads exceeded
25 seconds, so no successful full before/after live conversation-ID comparison
is claimed. The restricted actor's task and instance ID digests matched across
the change. Independent post-commit reads verified both restricted and owner
lists. Post-commit Chat list with lead/latest-message joins returned in 151.363 ms
in one authenticated SQL measurement. Rehearsals varied from about 91 ms to
several seconds; no unexplained variation is labeled a cache effect or SLA.

The actor-wide message and conversation-lead sets were subsequently replaced by
bounded parent lookups in `20261126201002` at **20:15:30 UTC**; see
[Workspace RLS completion](WORKSPACE_RLS_COMPLETION.md). These SQL checks are not
browser acceptance. Monitor complete request latency and large owner workspaces. All-table
policy optimization is not claimed: Content, Requirements, Segments and Deals were
not changed by these migrations. Their subsequent correction was applied at
20:08:58 UTC; see [Workspace RLS completion](WORKSPACE_RLS_COMPLETION.md).

## Deployment safety

Both migrations fail closed on audited policy fingerprints, use two-second lock
acquisition limits, and committed with their exact-source history in one transaction
over certificate/hostname-verified TLS. No business DML, role/assignment change,
other pending migration, application deployment or Git publication was performed.
Never replay or edit the applied migration; use a reviewed forward correction.