# Connected accounts in private Robots Ask

**For a new eligible OAuth account, connecting is the manager’s decision to allow Ask access.** Before **Continue to authorization**, the dialog explains that authorized members and agents can use the account selected at the provider, subject to saved permissions. Allowed tools can send, change or delete real data and incur provider or Composio fees. Dismiss the dialog instead of continuing if that is not intended.

Generic Ask access turns on without a second manager click **only after** independent verification that the provider limits the credential to the customer’s business data for this workspace. Completing OAuth confirms the connection, not that Ask is available. Existing accounts, attempts started before the new notice, replays and proof renewals do not acquire the new default. The hosted **Supabase API token** setup does not enable generic execution. It can use a separately authorized bounded metrics read on the shared installation, as described below.

## Check or stop access for one account

In **Connectors**, select the intended **Connected account** in the toolkit header. Owners and administrators see **Robots Ask access** for that account. **Refresh status** reads the local policy; **Verify provider status** is a separate connection check. Other members cannot inspect the manager status or change it.

| Status | Meaning and control |
| --- | --- |
| **Waiting for verification** | First setup is pending, not active. **Cancel automatic setup** keeps the account off even if proof arrives later. |
| **Available to authorized members** | Current verification and enrollment, with a saved policy allowing the assistant and a tool scope. In a private interactive instance, the signed-in member is the principal; the pinned prompt agent is not a second grantee. **Turn off Ask access** stops new direct calls without disconnecting the account. |
| **On · tools unavailable** | Enrollment is on, but the account or saved host/tool settings block calls. Broadening the policy later can make tools available. If the server omits the tool mode, the UI says **tool scope unknown** instead. |
| **Off** | Current verification but no effective enrollment. To use an eligible existing or previously disabled account, choose **Turn on Ask access** and confirm the account and its **saved**, not draft, tool scope. This is not a prerequisite for a new pending account. |
| **Off · not verified** | No current proof. A manager cannot self-verify from this screen. **Clear any saved Ask access** removes any remaining consent; the button is not evidence of a saved grant. An unknown resource is not labeled as shared. |
| **Scoped reads only** | The server positively identified Makinari’s shared Supabase project. Generic provider actions are unavailable. An internal Makinari metrics report may be available on this account under a separate policy; this status is not a data grant. |

If Composio is unavailable, **Manage local account access** on `/connectors` or the toolkit detail page lets a manager cancel setup, turn access off or clear stale consent. It needs the Makinari API and database, not the provider catalogue. It never enables access or switches away from an explicitly requested account. An interrupted save is not confirmation of either outcome. Refresh before acting again; no mutation is automatically retried.

## What the saved permissions allow

Makinari decides **who can request which tools**. The provider enforces **which data the selected credential can read or change**. A read-only token or API key stays read-only under **All compatible tools**, even if the catalogue lists write actions. A credential with write permission still cannot be used through Ask for a tool excluded by Makinari. A provider denial ends that call; it is not retried with another account.

Eligible new accounts use the workspace’s member and agent sharing rules, including for principals added later. **Only selected tools** restricts discovery and calls to exact saved IDs; an empty selection allows none. **All compatible tools** includes future eligible provider actions. **Legacy catalogue reads**, where reported, is a separate read-only feature, not a credential permission. Neither it nor browsing a provider catalogue grants Ask access.

For example, two CRM connections can list the same action, but only one credential may be able to update the record. Select the intended account in the Ask picker. If multiple accounts fit, Ask should clarify which one you mean before acting. It uses the toolkit and the final eight characters of the local connection ID shown in the picker, **not** the account name, email address, provider account ID or credential. The full local ID identifies the choice if suffixes coincide. Selecting or naming an account is not consent to change it or use another one.

The private, interactive **Ask** session uses the authenticated member’s own instance. The active same-site agent is pinned to that turn for provenance; it cannot lend or withhold connector use. Autonomous Agents retain their own grants; a background run does not inherit the interactive session. Host, workspace, license, location, assigned-record and relevant screen restrictions still apply. Selecting an account narrows the search; it grants nothing. Describe checks the exact account and provider contract; dispatch checks the version, schema and current authority again.

An allowed call is still subject to the provider’s permissions and fees. Private delivery does not hide or reverse a write at its destination. **Allow requests for access** is for members or agents without local permission to use a supported action. It is not a connection setup step, a per-write approval, or a way around the provider’s denial. For a generic Ask tool without a review flow, denial does not create a request. This path does not enable public chat, Customer Support, shared reports, voice, plans or background execution.

Robots receives a **private receipt**, not the provider payload or a row summary. Open it while signed in as the requester, or go to **Connectors → Private reports**. The link alone grants nothing. The report is bounded and may omit fields or be truncated. The latest 20 private reports per owner are available for at most one hour, subject to current authorization. Revoking or replacing the enrollment prevents reopening its direct receipts; re-enabling does not revive them. Do not paste their contents into a shared conversation. If dispatch or delivery is unconfirmed, reconcile in the original system before considering another action: a missing receipt does not mean nothing happened.

## Operator prerequisites (not workspace settings)

An independent deployment operator must verify the **downstream credential**, not just a Composio project or a `PRIVATE` account label. There is no attestation, evidence upload, secret-entry or per-tool version-registration control in this policy UI.

- Verify the canonical external issuer and exact customer-owned business resource dedicated to this site. The downstream provider must enforce that boundary for **every** operation and argument, including after refresh or in-place reauthorization. A site ID, label, URL, account owner’s statement or selected tool list is not evidence. If the boundary cannot be proved, leave the account ineligible.
- Through the approved operator process, register the external resource and applicable Makinari business screens in `connector_result_private.direct_resources`. Use an empty screen list only when no native screen corresponds to the resource. The same issuer/resource cannot be assigned to another site. Multiple isolated accounts can belong to the same site resource.
- The private `direct_attestations` record binds site, connector, toolkit, exact Composio project, provider user binding, account, auth config, credential revision and resource identity to independent evidence and expiry. Record an evidence reference, not secrets. The asserted conditions are `customer_owned_dedicated`, `provider_enforced_single_site`, `business_data_only_no_control_plane` and `reauth_cannot_expand_boundary`. Only first proof can consume a matching, unspent onboarding decision by a still-authorized manager. A replacement proof requires a fresh decision; no historical account is seeded or adopted.
- Never delegate installation credentials, a shared platform resource, or a credential capable of control-plane administration, cross-site access, credential discovery, arbitrary query/code execution or proxying. For a database resource the canonical external project must be distinct from the verified local installation. A Supabase project reference or broad Management PAT cannot supply this proof; there is no general SQL console. The platform Composio key can be **transport only** with the exact current project binding, not delegated authority over Makinari resources.

Existing OAuth and toolkit-specific onboarding remain separate setup paths. Catalogue coverage is not universal account provisioning.

### Shared-project analytics in Instance Ask

The new Ask contract separates provider actions from internal metrics. If you ask for a provider action, its reference is `connector:<id>:<SLUG>` and the connector discovery origin defaults to `provider`. If you ask specifically for an **internal Makinari metrics report**, Ask searches the intended account with `tool_origin: "makinari_report"`. The report reference is `report:<id>:MAKINARI_METRICS`. It is neither a provider action named `SUPABASE_RUN_READ_ONLY_QUERY` nor the native `report` tool.

Ask should clarify whether you mean provider data or Makinari metrics when the source is ambiguous. It must not answer a failed provider request with internal figures or switch accounts. The report describes eligible sources and scopes for the selected account. It does not expose arbitrary SQL or project administration. **All tools** is not all-workspaces data access: platform aggregates need a separate entitlement. If that scope is unavailable, Ask must not silently give workspace totals. The requester opens the private result; the model cannot summarize rows it never received.

The earlier member-authority and scoped-read migrations were applied to shared Makinari
on November 23, 2026 at **07:05:54 UTC**. The schema rollout preserved both
connections and their policies; it did not issue a platform entitlement, execute
a query or upgrade old turns. The new report descriptor requires the separate
[report-source migration](../supabase/migrations/20261123080000_connector_instance_report_sources.sql),
applied to shared Makinari at **07:44:43 UTC** and independently verified at **07:44:52 UTC** the same day.
That schema change granted no additional access. Deploy compatible API, worker and web versions
and verify a fresh Ask turn. Ordinary provider actions do not use the report RPC.

## Management interface and rollout

The notice-bearing OAuth dialog starts **only** `POST /api/connectors/auth-attempts/ask` with the existing site, toolkit and auth-config identifiers. There is no browser grant, proof, or policy field. The older `/api/connectors/auth-attempts` start, managed OAuth setup and `/api/connectors/supabase-token` do not record this decision. If the new start fails, do not silently fall back. The [Ask-on-connect migration](../supabase/migrations/20261123030000_connector_ask_on_connect.sql) was applied in the same 07:05 UTC transaction. It is prospective: neither existing account was enrolled. The schema rollout did not deploy the compatible API, worker or web.

`GET /api/connectors/connections/[id]/provider-direct?site_id=<uuid>` and `PATCH /api/connectors/connections/[id]/provider-direct` remain manager-only. PATCH accepts exactly `{site_id, expected_revision, expected_direct_revision, enabled}` and no query parameters. Responses project `{connector_id, revision, direct_revision, attested, enabled}` plus `setup_pending` on the new API and optional `unsupported_reason: "shared_makinari_project"` when reliably identified. Older responses without `setup_pending` do not confirm pending setup. No proof, project reference or provider data is returned. `enabled` is effective enrollment for the current verification, **not** authorization for a particular call. A successful change matches the account and requested boolean, preserves `revision`, advances `direct_revision` by exactly one and leaves no pending setup. A stale revision or missing proof on enable returns `409`; disable requires neither proof nor the catalogue. Direct-only changes invalidate old direct authorizations, not legacy reports.

The [direct policy](../supabase/migrations/20261123010000_connector_provider_direct.sql) and [private receipt](../supabase/migrations/20261123020000_connector_direct_receipts.sql) migrations were applied together to shared Makinari on November 23, 2026, at **05:52:48 UTC**. Do not replay them there. Independent verification found two preserved accounts and **zero direct enrollments**. The matching API, worker and web were not deployed. Before enrolling a production account, verify eligible and restricted operations, genuine provider denials, revocation, duplicate submission and private receipt delivery on **two separately approved disposable accounts**. No live provider result was established by the schema rollout.

Offline web regressions:

```bash
npm test -- --config jest.connector-onboarding.config.cjs --runInBand
```