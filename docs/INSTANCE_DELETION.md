# Instance and requirement deletion

Deleting an agent instance also deletes its exclusively associated requirements
and their requirement history. The confirmation dialog states this explicitly;
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

The API repository owns the forward migrations and database regression tests.
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

## Local regression checks

```sh
npm test -- --runInBand __tests__/api/robot-instance-delete-proxy.test.ts __tests__/robots/delete-robot-instance.test.ts __tests__/app/components/robots/DeleteRobotModal.test.tsx
```

These tests exercise the web boundary without deleting real instances. API and
SQL tests in the orchestration repository cover the actual deletion contract.