# Connector resources and delegated access

**Status:** Approved design; local resource/grant implementation underway. **Reviewed:** 2026-11-19.
Companion to [Connectors architecture](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/CONNECTORS_ARCHITECTURE.md).
This defines the target access contract; see [implementation limits](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/CONNECTORS_IMPLEMENTATION.md).
It does not grant access or authorize provider operations or remote migrations.

## 1. One resource per connected account

Make `connectors` a first-class, site-owned PostgreSQL table, not a generic Records
collection used as the security authority. The catalogue and the installed account
are different entities:

- **Catalogue definition:** Gmail, its supported tools, domains and related skills.
- **Connector:** the site's particular Gmail account, its state and allowed users.

Sales Gmail and executive Gmail are separate connector records even when they use
the same toolkit. A grant to one must never expose or select the other.

`connectors` replaces the earlier proposed `site_connector_connections` table.
Do not introduce both as parallel stores. Existing proposed `/connections` HTTP
paths can project this resource; they do not imply another table. There is no
applied remote connector-table migration claimed by this design.

## 2. Proposed records and relationships

```text
site_connector_providers -> connectors
                             +-- connector_members
                             +-- connector_agents
                             +-- connector_policies
                             +-- connector_delegations (background execution)

Catalogue/tool domains <-> relevant skills (discovery registry, not grants)
```

| Record | Proposed fields / responsibility |
| --- | --- |
| `connectors` | `id`, `site_id`, `provider_id`, `toolkit_slug`, provider account/auth-config references, safe display identity, provider status, local enabled/revocation state, granted OAuth scopes, `created_by`, verification timestamps and `revision`. |
| `connector_members` | `site_id`, `connector_id`, stable authenticated `user_id`, separate `can_view`/`can_use` grants, optional restrictive policy reference, grantor, timestamps, expiry/revocation and revision. |
| `connector_agents` | `site_id`, `connector_id`, `agent_id`, enabled use grant, optional restrictive policy reference, grantor, timestamps, expiry/revocation and revision. |
| `connector_policies` | Connector-owned allowlist of exact provider catalogue IDs, resource restrictions, allowed execution contexts, approval requirements and revision. This limits access; it does not substitute for runtime action review or member/agent permissions. |
| `connector_delegations` | Explicit automation authority: connector, accountable principal, issuing manager, exact agent/workflow or job identity, permitted actions/resources, expiry, revocation and revision. Only needed when background connector execution is enabled. |

Keep provider configuration, encrypted secrets and OAuth attempts separate, as
specified in the architecture. Authentication attempts reference the resulting
connector ID. Do not put OAuth tokens, raw API keys or pending authorization URLs
in frontend-visible connector metadata or grant rows.

Use explicit relationship rows, not `allowed_member_ids` or `allowed_agent_ids`
JSON arrays. Enforce same-site ownership for every edge and policy reference with
database constraints/controlled writes. Unique keys prevent duplicate grants per
connector/member and connector/agent. Provider-account uniqueness is scoped to a
verified provider-project namespace, not merely a credential row or key value.

The exact FK targets require schema inspection before migration. A member grant
targets an authenticated user, not an email or an arbitrary client member ID.
Execution verifies current effective site membership/ownership independently;
owners/co-owners need not have an ordinary `site_members` row. Agent roles/names
are not identities: resolve a real same-site agent ID from trusted host context.

For principals without a stable supported agent identity, return unavailable until
an explicit host/delegation binding exists; never treat a missing agent ID as a
way to bypass agent grants. Direct human use is a distinct host-owned mode.

## 3. Management, visibility and use are different permissions

- **Manage:** effective site owner/admin may configure credentials, connect/revoke
  accounts, assign grants and change policies through audited endpoints.
- **View:** a member with effective view access may see that connector's safe metadata.
  Granting use requires view; a view-only grant never exposes executable schemas.
- **Use:** the member can invoke reviewed operations, subject to the intersection
  below. Granting an agent use does not grant any human caller use.

Management does not automatically execute provider actions. Managers can issue
explicit use grants, including to themselves, but cannot bypass account state,
OAuth scopes, approval requirements or native business restrictions. Configuration
visibility never returns secrets or provider business data.

The public toolkit catalogue can remain browsable by permitted site members. Local
account identities, account counts, grant lists and activity must be filtered by
connector visibility; do not reveal hidden accounts through search or totals.
Non-managers receive only their effective access, not the complete membership ACL.

## 4. Interactive execution: intersection, never union

For an agent acting on a member's request:

```text
effective site access + connector/business screen/resource permissions
  AND effective member connector-use permission
  AND effective agent connector-use permission
  AND connector/member/agent operation-policy intersection
  AND permitted host mode
  AND active provider account + local enabled state + sufficient OAuth scopes
```

An agent with executive-mailbox access cannot lend that authority to an ungranted
member. A member with sales-mailbox access cannot use it through an ungranted
agent. A direct-human operation omits the agent grant only when the trusted host
explicitly declares that mode; model-supplied arguments cannot select it.

`require_approval` is the stored name of **Allow requests for access**. For an
authorized interactive member and agent it does not add a confirmation step.
Where supported, a visible account with a missing use permission can produce a
request-only review instead of a direct call. Hidden accounts, explicit blocks,
revocations, expired access and policy/scope/host denials are not overridable.
Review is one action by an authorized manager, not an ACL change or a provider
result for the requesting agent or customer.

The account's access mode determines what an **absent** member or agent row means:

- **Explicit (existing accounts):** an absent row denies access. The migration
  preserves enablement, policies and grants; it never opts an existing account in.
- **Workspace (new verified connections):** eligible same-site members and active
  same-site agents inherit access, including when someone joins later. A stored
  override takes precedence: a view-only member cannot execute, and denied,
  revoked or expired access does not fall back to the workspace default. An
  unsuccessful lookup is not an absent row.

Tool permission is separate from workspace membership. New verified connections
use `tool_access_mode = 'all'`. The [creation default](CONNECTORS_INSTANCE_CATALOG.md#rollout)
also enables compatible read-only catalog tools in private Robots sessions. This
is not a wildcard over the provider catalogue. Existing accounts retain their
saved settings. In `selected` mode only saved IDs are eligible; an empty list
means none. Host, scopes, effective access and human approval remain independent gates.

Check the same effective access during account-aware discovery, schema description
and dispatch. The last check occurs immediately before the external effect, with
current grant/policy revisions and live membership eligibility. Search receipts,
cached schemas and old conversation history are not authorization.

Revocation blocks subsequent admission, including queued/retried operations. It
cannot undo an effect already dispatched; record that boundary honestly and use
existing cancellation/recovery behavior instead of claiming remote rollback.

## 5. Background workflows: explicit delegation

A workflow without a live browser session is not an unrestricted agent. Bind it
to a durable `connector_delegations` record created by an authorized manager, with
an accountable execution principal and the exact connector/agent/workflow scope.

The delegation replaces the live interactive request proof, not membership,
connector grants, operation policies or host restrictions. Recheck the accountable
principal's effective access and connector-use grant, agent grant, delegation
scope/expiry and required approvals at admission and before each dispatch.
If the principal leaves the site or a grant is revoked, suspend future work.
Do not silently replace them with the site owner or a generic service account.

Private credentials stay server-side; provider session ownership is not the actor
or delegation proof. Public voice/customer-support callers do not inherit site
manager authority. Channel proposals do not enable delegated execution: a verified
agent can request a private review, but the authorized workspace member makes
the decision and executes under their own identity. No bearer approval token or
provider result travels through the customer channel. Direct channel execution
remains disabled.

## 6. Skills and categories remain discovery metadata

Keep category/toolkit/tool-to-skill relationships in the shared reviewed registry.
The connector's toolkit inherits that relevance metadata; optional site custom
skill bindings are tenant-scoped and never modify execution rights.

Example: CRM intent can discover HubSpot and its related procedure, but concrete
actions and account identity appear only for authorized connector instances. A
Finance label does not authorize payments, and a Support skill does not authorize
reading every inbox. A toolkit summary is never proof of a usable connection.

## 7. Detail UI and API contracts

The catalogue remains grouped by toolkit. Its detail page selects an authorized
connector account explicitly; suggested URL state is `connector=<local-id>`.
Server validation must reject foreign/hidden IDs regardless of the URL selector.

Detail sections: **Overview**, **Connection**, **Access**, **Tools & permissions**,
**Related skills**, **Activity**. The Access section has separate member and agent
lists, effective permission explanations, grant expiry and manager-only editing.
Selecting an account default never grants access to that account.

- `GET /api/connectors/connections/[id]/access`: managers receive editable grants;
  other permitted members receive only their effective permissions.
- `PATCH /api/connectors/connections/[id]/access`: manager-only bounded grant/revoke
  changes with expected revision, same-site validation and atomic audit recording.
  It cannot set provider-owned state or silently replace unrelated grants.
- The existing proposed policy endpoint edits reviewed operation constraints, not
  membership itself. Connector disable/revoke immediately invalidates execution
  admission, regardless of retained grant rows.

Every HTTP boundary independently authenticates and authorizes, including the web
BFF and external API. RLS protects visible tables; browser access cannot directly
change grants, delegations or provider status. Controlled server mutations recheck
manager authority and enforce invariants atomically. Service-role access alone is
never the authority to grant access.

## 8. Delivery and validation

Deliver connector resource/grant constraints and the shared access resolver before
enabling delegated member use. The legacy admin-only Composio guard must be replaced
deliberately for connector references/facades, not globally relaxed. Other tool
screen rules remain unchanged; unresolved legacy execution paths stay gated.

Required regression cases:

- Member and agent both granted succeeds only for permitted account/action/host.
- In explicit mode, a missing member or agent grant denies. In workspace mode,
  either principal's denial blocks use; view-only cannot describe executable tools.
- Two accounts in one toolkit stay isolated; hidden identities/counts do not leak.
- Cross-site member, agent, policy and delegation references fail at API and DB levels.
- Manager can manage but has no implicit provider-use bypass; non-manager cannot grant.
- Disabled/revoked accounts, expired grants, member removal and policy narrowing deny
  the next dispatch, including an already queued workflow or reused provider session.
- Missing agent identity and forged direct-human mode cannot skip the intersection.
- Delegation replay, wrong workflow, expired authority and lost membership suspend work.
- Discovery, describe, execution, compatibility facade and workflow selector agree.
- Categories/skills confer no access; migration never widens legacy access and
  verified creation never enables an unreviewed tool.

Use existing Jest conventions and isolated database/RLS tests with non-privileged
actors. Validate actual provider effects only with an explicit disposable target
and approval. Current local implementation/test evidence is in the rollout guide;
this target contract does not imply background delegation or live OAuth acceptance.