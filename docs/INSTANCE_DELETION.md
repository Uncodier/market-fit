# Instance and requirement deletion

Deleting an agent instance also deletes its exclusively associated requirements
and their requirement history, except retained immutable retirement audit receipts.
The confirmation dialog states this explicitly;
the request must include `delete_requirements: true`. Archival remains a separate,
non-destructive operation and does not stop execution.

## Request boundary

The browser posts to the same-origin `/api/robots/instance/delete` route. The web
server verifies the user session, reads the instance under RLS, derives its site,
and requires the project's owner/admin role and delete capability. Being the
instance's creator alone is not sufficient for deleting project requirements.

The web server forwards only the verified user's bearer token and the validated
request to the configured orchestration API. Client-supplied user/site IDs,
alternate targets, and API credentials are not forwarded. The API independently
authenticates and authorizes deletion. No service-role credential is exposed to
the browser.

## Database contract

The orchestration API uses `get_robot_instance_deletion_scope` to inspect the
authorized scope before provider shutdown, then
`delete_robot_instance_with_requirements` to remove the requirement graph and
instance in one database transaction. It must not fall back to separately
committed log/plan cleanup or direct parent deletion.

The API repository owns the instance-deletion migrations and database regression tests.
Apply the instance-deletion migrations to **Makinari**, not the separate Apps
database, before deploying the API and web changes. Missing migration/configuration
fails closed. Remote migration application requires explicit operator approval.

Unknown dependencies, ambiguous/shared ownership, changed scope, or active work
can prevent deletion. They must not be resolved by silently deleting other
instances, widening permissions, or disabling integrity guards. Products,
campaigns, deployed applications and their separate tenant databases are not
deleted by this operation.

Provider shutdown is external to the database transaction. A stopped provider
cannot be rolled back if the database deletion subsequently fails. Conversely,
a lost HTTP response may follow a successful commit. The UI only reports success
after receiving a matching deletion receipt and does not automatically retry;
refresh the instance list before retrying an unconfirmed operation.

## Failure diagnosis

The proxy recognizes a small allowlist of upstream error code/status pairs and
returns fixed English messages with the recognized `error.code`. It never forwards
upstream messages, SQL details, or credentials. Unknown, malformed, oversized,
status-mismatched, or lost responses remain unconfirmed; HTTP 500 from the API
still maps to HTTP 502 at the web boundary.

Server logs record only the upstream HTTP status and recognized code. API logs
record the failing stage and validated SQLSTATE/PostgREST code, not raw errors.
Use those logs to distinguish preflight, provider, transaction, and receipt
failures. Better diagnostics do not repair the underlying failure or authorize
retries, direct deletion, deployment, or database changes.

A locally initiated, read-only preflight against Makinari reproduced SQLSTATE
`57014` (statement timeout). The API's forward migration
`20261005220000_bound_empty_instance_deletion_preflight.sql` avoids expanding
unrelated log tags when the authorized requirement set is empty. It was verified
in isolated PostgreSQL without remote application in that earlier change; the
2026-10-19 inspection below subsequently confirmed it installed. This is a database-side correction;
deploying the proxy diagnostics alone does not install it.

The 2026-10-19 read-only production check confirmed that the empty-scope
correction was installed, but a nonempty requirement scope still timed out in
the shared-history block. Its tag lookup planned a sequential scan across
approximately 563,000 logs. The API repository's new forward corrections
`20261019230000` through `20261019230004` add four partial expression indexes
and replace only that lookup with indexed `UNION ALL` branches. They preserve
all ownership/execution guards and require valid compatible indexes before
installation. They are not applied remotely by this code change.

The four concurrent index files must each run outside a transaction as a
standalone statement; the final function correction runs transactionally.
It refreshes log statistics with `ANALYZE` before installing the lookup, so the
new expression indexes can be selected immediately rather than awaiting autovacuum.
See the API repository's `docs/INSTANCE_REQUIREMENT_DELETION.md` for prerequisite,
invalid-build recovery and verification details. Explicit Makinari target
approval is required. A web deployment alone cannot correct this database plan.

## Individual requirement deletion and retirement audit

### Paused-plan step reconciliation before deletion

Pausing remains resumable and is not proof that a persisted active step has
stopped. The deletion RPC still rejects active step statuses, including a step
left `in_progress` inside a `paused` plan. Never bypass that check or mark work
completed merely to delete its parent.

`20261020000000_cancel_quiescent_instance_plan.sql` adds an explicit manager-only
`cancel_quiescent_instance_plan(plan_id, instance_id)` operation. It locks the
authorized requirement/instance/plan scope, requires a `paused` or `stopped`
instance without provider/sandbox, active workflow/node/action, scheduling,
cron, latest active status, diagnostic or harness lease signals, then cancels
only unfinished steps and the selected plan in one transaction. Persisted
expired lease fields are not inferred to be safe. Sibling plan sandbox evidence
also blocks reconciliation. Completed/failed/skipped history and step payloads
remain unchanged. No requirement, instance or provider is stopped by this RPC.

Manager-cancelled plans retain their cancellation marker and immutable step
evidence; late writers cannot resume them or overwrite the preserved array.
An already backend-cancelled quiescent plan can be explicitly adopted into that
protected state. Old backend cancellation writers retain their existing contract
until a manager explicitly adopts their plan. No existing rows are backfilled.

The browser's **Cancel plan** button targets the displayed plan and posts to
`/api/robots/plan/cancel`. The route independently authenticates the real user,
derives the site from the RLS-visible plan, checks owner/admin and update
capability, invokes the scoped RPC and requires a matching receipt. There are
no direct status-only fallback writes or automatic retries. Running execution
must first be stopped and reconciled through its owning lifecycle; this new
operation deliberately rejects it rather than claiming to stop remote work.

Rollout requires explicit approval to apply the complete migration in **Makinari**,
then deployment of the **market-fit web** change (including its API route).
Applying the migration alone does not update the existing Cancel plan button.
No API orchestration deployment is required for this web-owned operation.
After both are installed, refresh the Robots page, explicitly cancel the paused
plan, verify its receipt, refresh the instance list, then attempt deletion once.
Other independent deletion blockers may remain. Do not automatically delete an
instance or rewrite its production step during rollout/verification.

Focused local checks:

```sh
npm test -- --runInBand __tests__/api/robot-plan-cancel.test.ts __tests__/components/simple-messages-view/plan-cancellation.test.tsx __tests__/requirements/plan-cancellation-postgres.test.ts
```

The PostgreSQL suite uses only a fresh socket-only cluster and tests atomic
updates, denied/cross-site actors, active/expired persisted signals, malformed
steps, rollback, idempotency, immutable evidence and concurrent instance admission.
It does not establish that a historical production worker has actually stopped.

#### Applied-migration follow-up (2026-10-19)

Read-only production logs at 22:57 UTC showed deletion preflight `PT409` in 62 ms;
the cancellation RPC was installed but had not been called in that attempt window.
The old paused plan still had unfinished steps. Installing this migration does
not cancel historical work, and choosing **Delete** does not invoke cancellation.
An unauthenticated read-only production GET to the new plan-summary endpoint
returned HTTP 405 before rollout: that deployment did not yet expose the new
GET handler. Schema installation does not publish web route/UI changes.

The forward correction is
`20261020001000_serialize_quiescent_plan_cancellation.sql`. Apply the complete file
in Makinari after explicit approval. It preserves the installed function/ACLs and
adds ordered row locks for all existing sibling plans before reading sandbox
evidence. An unchanged binding previously allowed sibling metadata/steps writes
to commit between the check and cancellation. New plan inserts and binding
changes remain fenced by the prerequisite real-parent binding trigger. Locks
remain bounded, and only the selected plan is mutated. Do not edit or replay the
already-applied original migration to disguise this correction.

The web repair refreshes plans explicitly after cancellation; failed reads retain
existing visible data and report an unavailable refresh. A late receipt for a
previous instance cannot invalidate the current instance's loading request.

After a deletion `409`, the confirmation dialog now loads an authenticated,
site-scoped read-only plan summary via `GET /api/robots/plan/cancel`. It offers
**Cancel plan** for each non-template plan, including legacy cancelled plans that
need reconciliation/adoption. Each click invokes the same guarded atomic RPC
and requires its matching receipt. Delete/dismissal are disabled during the
cancellation. The dialog stays open, removes only a confirmed cancelled plan,
and never automatically retries deletion. Missing access, configuration or read
failure is not represented as an empty plan list.

Rollout: apply the forward correction, deploy market-fit, reload Robots, attempt
deletion once to inspect the blocker, explicitly cancel only abandoned plans,
then choose Delete again yourself. A provider, harness lease or other independent
blocker still requires its own lifecycle. No production data is backfilled by
either migration. The new two-connection regressions cover sibling writes both
before and after the lock/check; they use only a disposable local cluster.

The Requirements Server Action authenticates the real user, derives the site from
the RLS-visible requirement, and requires owner/admin plus delete capability. It
deletes only the parent, scoped to the verified site, and requires a matching
returned ID before reporting success. Existing database cascades and the deletion
authority trigger remain authoritative. Do not pre-delete segment/campaign links:
separate requests can lose those associations even when the parent delete fails.

The web repository's forward correction is
`supabase/migrations/20261012200000_preserve_retirement_audit_on_requirement_delete.sql`.
It requires the API's `20261005010000_retire_legacy_migration_holds.sql` and the
existing instance-deletion schema in **Makinari**, never Apps. It:

- removes only the retirement receipt's requirement and composite lifecycle FKs;
- retains its historical IDs, snapshots, uniqueness, private ACL/RLS and
  unconditional append-only trigger;
- restores the lifecycle guard's root-delete exception lost by the retirement
  migration, while preserving direct live-lifecycle mutation checks and both
  receipt-matching paths;
- leaves the retirement RPC unchanged: it locks and validates live parents before
  inserting, so receipts cannot be created by browser-facing roles. Replaying the
  RPC after requirement deletion fails with `Retirement requirement missing`;
  the retained receipt is historical evidence, not execution authority.

Do not reuse deleted requirement UUIDs. The receipt's instance FK is intentionally
unchanged and can still block deletion of that instance; this correction does not
authorize deleting its audit. It does not repair associations already removed by
earlier failed requests.

Remote application requires explicit target approval. Verify the prerequisite
functions and FKs, pause related writes, and apply the complete corrective file
through the approved workflow. Its DDL lock wait is bounded to five seconds. No
rows are deleted or rewritten by the migration. A web deployment alone cannot
install this database correction. For rollback, prefer a forward correction;
the old FKs cannot be restored once receipts outlive their parents without first
resolving that historical data, and the audit must not be silently removed.

## Local regression checks

```sh
npm test -- --runInBand __tests__/api/robot-instance-delete-proxy.test.ts __tests__/robots/delete-robot-instance.test.ts __tests__/app/components/robots/DeleteRobotModal.test.tsx
npm test -- --runInBand __tests__/requirements/delete-requirement.test.ts __tests__/requirements/retirement-deletion-migration.test.ts
```

These tests exercise the web boundary without deleting real instances. API and
SQL tests in the orchestration repository cover the actual deletion contract.

The requirement migration suite starts a disposable socket-only PostgreSQL cluster,
loads a checked-in copy of the original retirement migration against a minimal
prerequisite schema, and exercises the real retirement RPC and correction. It
never uses a configured database URL. Binaries default to
`/opt/homebrew/opt/postgresql@17/bin`; override with `REQUIREMENT_TEST_PG_BIN`.
Live cases explicitly skip when binaries are unavailable. This is not a full
production-schema or browser verification.