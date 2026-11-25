# Scheduled task connectors: private catalog reads

**Database migrations applied to shared Makinari and independently verified on November 25, 2026 at 21:36:48 UTC.** The web/API/worker changes were not deployed in that operation; live-provider acceptance is still pending. The workflow
uses the same discovery, review, publication, execution and private result
contracts for eligible native connected accounts. There is no per-tool handler,
fixed provider, fixed tool release or model-generated choice at dispatch. A
catalog entry is a candidate, not permission. In particular, **read-only** is a
positive provider metadata and schema requirement, not a guess based on its name.
Private native OAuth2 and compatible hosted API-key accounts are supported; shared/MCP accounts, downstream endpoint overrides, project-bound database connectors,
writes, unauthenticated tools, unreviewable schema/arguments, unrestricted SQL,
proxy/control-plane actions and unsupported account boundaries are not enabled.

## Configure and operate

On a database with `20261125223000_connector_creation_direct_host.sql`, every newly
verified connection starts with both `assistant` and `direct` in its host policy.
Existing accounts and repeated callbacks keep their saved hosts. Managers can
change **Allow use in scheduled tasks** under **Tools & permissions** without
changing Ask. The setting neither grants account use nor publishes a task.

1. Create a workflow with one enabled cron trigger and one directly connected
   task. Choose a supported hourly or daily schedule **and save its timezone**.
   Leave sandbox, browser and tool actions off. Do not add channels, other
   steps or destinations. The published operation and inputs are fixed per version; task text cannot substitute another operation.
2. Under **Task → Connector**, select the exact visible account. Selection is
   a draft reference, never a permission grant. An unsupported account cannot
   be published just because it appears in the picker.
3. An eligible manager with current instance access, explicit account-use
   permission, and the required business access opens **Choose catalog action**, selects a read, and uses **Check action** to obtain its accepted schema. Enter the exact JSON arguments and use **Review schedule**. Check the account, recurrence, timezone, operation, release, arguments and private destination. Use
   **Authorize and publish** to approve that version as the accountable principal.
   A changed definition does not silently replace the approved one. Work stops
   on a mismatch until reviewed again. Publication lasts at most 30 days.
4. The authenticated scheduler reserves a private job **before** enqueueing it;
   it never starts an assistant, browser or billed VM. The database admits a
   due UTC minute only once (120-second admission window). Queue latency after
   reservation does not exhaust that window: a reserved job can start for up to
   24 hours, but cannot outlive its publication or current authority. The worker checks
   membership, grant, policy, authenticated parent visibility, account identity,
   resource proof and version binding again before dispatch. A manual Run, Test,
   or resume does not get the delegation. After publication the instance remains
   on the private path even if the selection is removed or the grant is revoked.
   Use a separate ordinary workflow for unrelated steps.
5. The approving manager can **View private result** after execution, subject
   to current access and the one-hour read window. The result is a bounded, redacted field/value report, not the raw provider envelope; missing or withheld fields do not mean the resource was empty. Only the newest private preview is retained per publication; revoking or replacing the publication clears it. No result is injected into shared workflow history. Use **Revoke scheduled access** to
   stop future admissions; it cannot undo a call already dispatched. No
   automatic replay of an uncertain occurrence. Disabling or revoking this
   publication does not change Ask or Customer Support permissions.

## Deployment and verification

- Do not replay these six migrations on shared Makinari (`rnjgeloamtszdjplmqxy`). For a new target, apply `20261125210000_workflow_task_connector_reference.sql`, then
  `20261125211000_workflow_connector_authority.sql`, then
  `20261125212000_workflow_connector_rpc.sql`, the prospective `direct` default
  `20261125223000_connector_creation_direct_host.sql`,
  `20261125230000_workflow_connector_queue_reservations.sql`, and
  `20261125231000_workflow_connector_descriptor_guard.sql` in timestamp order
  on the approved database target.
  Install **before** deploying the new API/worker: ordinary workflow execution
  also checks the routing RPC and deliberately fails closed if it is missing.
  There is no grant backfill, public execution RPC, or provider credential in
  a task definition. Existing connector identity/attestation migrations and
  instance ownership RLS must be present.
- Deploy matching web, orchestration API and queued worker; drain old worker
  versions **before changing the job payload**. Old occurrence-only jobs cannot
  be converted into reserved handles; reconcile them rather than replaying an
  uncertain effect. Leave `WORKFLOW_CONNECTOR_READS_ENABLED` off. The scheduler must
  authenticate with a configured `CRON_SECRET`. The feature flag is server-only
  and checked again immediately before the provider call.
- Verify an eligible private native API account, its `direct` host and tool
  policy, current explicit member use grant, completed connection, independent
  downstream resource attestation, and project/credential binding. The remote
  API resolves each exact descriptor and concrete release. Publication pins
  the release, fingerprint and validated arguments; dispatch re-describes
  that exact version and checks the account, live authorization and fingerprint.
  No fallback to latest, another credential or another action. A schema change
  or unknown behavior requires a new review or remains unsupported.
- The browser receives only the projected input schema, never a provider output
  contract or a schema containing the current credential or private binding
  identifiers. This privacy check is shared with the direct Ask transport.
- Before producing a private report the worker verifies the response against
  the pinned, supported output schema. Closed records, value types and array
  limits are enforced. When only a reviewed page limit is available, there is
  no implied record schema; every returned array must fit that limit. Invalid
  responses are unconfirmed, not successful empty reports, and do not trigger
  a second provider call.
- Trigger discovery uses keyset pagination. Reservations are collected from a
  durable outbox in bounded batches. An unacknowledged enqueue can be offered
  again after a two-minute lease; duplicate deliveries still share one database
  dispatch claim. Queue acceptance is not provider completion. A reserved read
  that was already dispatched is never issued again on an ambiguous response.
- Confirm the actual metadata and return shape on at least two independently
  approved disposable accounts from different toolkits. The offline fixtures
  demonstrate a common path, not certification of every live catalog tool.
- On a disposable target, exercise a successful scheduled read, duplicate
  tick, revocation while queued, stale review, removal of member use, and
  absence of provider payload in public logs. Disable the worker flag to stop
  new dispatches and revoke affected publications if reconciliation is needed.