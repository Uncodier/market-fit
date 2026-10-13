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
unrelated log tags when the authorized requirement set is empty. It is verified
in isolated PostgreSQL, not applied remotely. This is a database-side correction;
deploying the proxy diagnostics alone does not install it.

## Individual requirement deletion and retirement audit

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