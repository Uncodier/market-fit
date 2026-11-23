# Provider-direct execution in private Robots Ask

**Connecting an account does not let Robots run its provider tools.** Provider-direct execution needs both independent verification of the external account’s boundary and a workspace manager’s opt-in for that exact connection. New and existing connections start without this opt-in. An old catalogue-read grant, **All compatible tools**, a saved tool ID, an OAuth callback or a successful earlier call cannot supply it.

## Enable or revoke one account

1. In **Connectors**, open the toolkit and select the intended **Connected account** in the header. **Verify provider status** checks the account connection, not its eligibility for direct execution.
2. In **Tools & permissions**, review who can use the connection and **save** the intended tool scope. A permitted interactive assistant and a nonempty tool scope are required to make calls, not to store an opt-in:
   - **All compatible tools** includes future eligible actions in this account’s provider catalogue. It can include writes. It is not limited to tools in the historical reviewed inventory.
   - **Only selected tools** restricts discovery and calls to exact saved tool IDs. An empty selection admits none. Choosing a tool in either mode does not run it or prove its schema is supported.
3. Open **Provider-direct execution → Review provider-direct access**. **Operator verification** must be current and the connection must be active. **Manager opt-in: Inactive** means there is no effective enrollment; verification alone is not consent. Members see the private-use boundary but cannot inspect manager status, attest the account or change enrollment.
4. Choose **Enable provider-direct execution** and confirm the account and its saved scope. This saves consent, not a provider call. An **Active** opt-in still requires a permitted human, agent, host and action for each call. The scope remains live: broadening it later (for example, switching from selected to all) broadens the tools eligible on an enrolled account. Revoke first if that is not intended.
5. To stop new calls, choose **Revoke provider-direct access**. If verification has lapsed, **Clear saved provider-direct consent** removes any old opt-in even though execution is already inactive. When Composio metadata is unavailable, use **Manage local account access** on `/connectors` or the toolkit’s detail page. Its revocation uses only the Makinari API and database. It does not disconnect the account, modify the selected tools or change the legacy read policy.

If the account changed, refresh and review it again. A failed or interrupted save is not confirmation of either state. The client does not retry a mutation automatically. Disabling the legacy **Allow instance catalogue reads** setting is **not** revocation of direct access.

## What opting in permits

The private, interactive **Ask** session uses the authenticated member’s own instance and an authorized same-site agent. Member and agent grants, allowed host, site, location, assigned-record and relevant screen restrictions still apply. Selecting an account in Robots narrows the search; it grants nothing. Search pages are candidates. Describe checks the exact account and provider contract; dispatch checks the version, schema and current authority again. **All** is not a promise that every listed tool, auth scheme or input can run.

Allowed calls send arguments to the external provider and can read, create, send, change or delete actual business data. They can incur provider or Composio fees. Private delivery does not make an external write private at its destination or reverse its effects. A reviewed-action approval request does not authorize this path. It does not enable public chat, Customer Support, shared reports, voice, plans or background execution.

Robots receives a **private receipt**, not the provider payload or a row summary. Open it while signed in as the requester, or go to **Connectors → Private reports**. The link alone grants nothing. The report is bounded and may omit fields or be truncated. The latest 20 private reports per owner are available for at most one hour, subject to current authorization. Revoking or replacing the enrollment prevents reopening its direct receipts; re-enabling does not revive them. Do not paste their contents into a shared conversation. If dispatch or delivery is unconfirmed, reconcile in the original system before considering another action: a missing receipt does not mean nothing happened.

## Operator prerequisites (not workspace settings)

An independent deployment operator must verify the **downstream credential**, not just a Composio project or a `PRIVATE` account label. There is no attestation, evidence upload, secret-entry or per-tool version-registration control in this policy UI.

- Verify the canonical external issuer and exact customer-owned business resource dedicated to this site. The downstream provider must enforce that boundary for **every** operation and argument, including after refresh or in-place reauthorization. A site ID, label, URL, account owner’s statement or selected tool list is not evidence. If the boundary cannot be proved, leave the account ineligible.
- Through the approved operator process, register the external resource and applicable Makinari business screens in `connector_result_private.direct_resources`. Use an empty screen list only when no native screen corresponds to the resource. The same issuer/resource cannot be assigned to another site. Multiple isolated accounts can belong to the same site resource.
- The private `direct_attestations` record binds site, connector, toolkit, exact Composio project, provider user binding, account, auth config, credential revision and resource identity to independent evidence and expiry. Record an evidence reference, not secrets. The asserted conditions are `customer_owned_dedicated`, `provider_enforced_single_site`, `business_data_only_no_control_plane` and `reauth_cannot_expand_boundary`. A new proof requires fresh manager opt-in; no seed or automatic adoption is provided.
- Never delegate installation credentials, a shared platform resource, or a credential capable of control-plane administration, cross-site access, credential discovery, arbitrary query/code execution or proxying. For a database resource the canonical external project must be distinct from the verified local installation. A Supabase project reference or broad Management PAT cannot supply this proof; there is no general SQL console. The platform Composio key can be **transport only** with the exact current project binding, not delegated authority over Makinari resources.

Existing OAuth and toolkit-specific onboarding remain separate setup paths. Catalogue coverage is not universal account provisioning.

## Management interface and rollout

`GET /api/connectors/connections/[id]/provider-direct?site_id=<uuid>` and `PATCH /api/connectors/connections/[id]/provider-direct` both require manager access. PATCH accepts exactly `{site_id, expected_revision, expected_direct_revision, enabled}` and no query parameters. Both return only `{connector_id, revision, direct_revision, attested, enabled}`. `enabled` means effective enrollment for the current verification, not permission for a particular actor or call. A successful update matches the account and requested boolean, preserves the ordinary `revision`, and advances `direct_revision` by one. A stale token or missing attestation on enable returns `409`; disable needs neither proof nor the provider catalogue. Direct-only changes invalidate old direct authorizations, not legacy reports.

The [direct policy](../supabase/migrations/20261123010000_connector_provider_direct.sql) and [private receipt](../supabase/migrations/20261123020000_connector_direct_receipts.sql) migrations were applied together to shared Makinari on November 23, 2026, at **05:52:48 UTC**. Do not replay them there. Independent verification found two preserved accounts and **zero direct enrollments**. The matching API, worker and web were not deployed. Before enrolling a production account, verify eligible and restricted operations, genuine provider denials, revocation, duplicate submission and private receipt delivery on **two separately approved disposable accounts**. No live provider result was established by the schema rollout.

Offline web regressions:

```bash
npm test -- --runInBand __tests__/api/connectors-proxy.test.ts __tests__/app/connectors/provider-direct-settings.test.tsx __tests__/app/connectors/local-account-recovery.test.tsx __tests__/app/connectors/connect-account.test.tsx
```