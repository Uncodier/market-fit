# Multiple channels and multiple agents

Date: 2026-11-11  
Status: Requirements and proposed design; not an implementation or rollout claim.

## 1. Goal and agreed scope

Support multiple channel connections and agents within a site, with one shared
assignment model and a common contact workflow.

Confirmed requirements:

- Enable creation of additional agents beyond the default agent set, with their
  own identities and configuration, eligible for channel assignment.
- Assign each channel connection to a specific agent from Settings > Agent Channels.
- Add a Channels tab to each agent so assignments can also be edited there.
- Provide a general workflow for contacting agents.
- Fall back to the site's active Customer Support agent when no agent is assigned,
  preserving existing unassigned-channel behavior.

The contact workflow is user-type agnostic and supports external customers and
internal workspace users. Trusted context and sessions distinguish participants,
their identity and permissions. Agnostic execution does not merge sessions,
histories, authorization or internal/external delivery boundaries.

Additional confirmed decisions: blank agent creation, dynamic MCP tool discovery
with all tools initially disabled, explicit owner-backed preauthorization,
supervisor takeover, all channels for all agents, and embedded connection setup
inside the agent detail. Web has one assigned agent at a time per site, defaulting
to Customer Support. An explicitly assigned missing/inactive agent never triggers
an automatic substitute: retain/create the conversation without an agent reply.

## 2. Terms and cardinality

- **Channel type:** a transport such as WhatsApp, email, SMS, Telegram, web or Voice.
- **Connection:** a specific account, inbox, number or web endpoint within a site.
- **Assigned agent:** the explicit agent responsible for a connection.
- **Effective agent:** the agent selected for a particular conversation or turn,
  including a fallback when applicable.

Initial cardinality:

- A site can have multiple agents and multiple connections of the same type.
- Additional agents can share a supported role or template without replacing
  another agent. A role or display name is not an agent's unique identity.
- An agent can serve multiple connections, including multiple channel types.
- A connection has zero or one explicitly assigned agent.
- Web has only one serving agent at a time per site, initially Customer Support;
  it can be reassigned to another agent, not expanded into concurrent web responders.
- Multiple simultaneous responders, round-robin pools and intent-based selection
  among several agents on one connection are outside the initial scope.

Example:

| Connection | Explicit assignment | Effective default |
| --- | --- | --- |
| WhatsApp — Sales number | Sales agent | Sales agent |
| WhatsApp — Support number | Support specialist | Support specialist |
| Email — Procurement inbox | Procurement agent | Procurement agent |
| Telegram — General | None | Site Customer Support |

Assignment is by connection identity, never just by channel type or array order.
The same provider sender can expose different capabilities; those connections
must not accidentally share assignments unless the product explicitly requires it.

## 3. Current implementation evidence

Inspected local code provides reusable foundations, not complete support:

- [Channel form schema](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/settings/channel-form-schema.ts)
  defines site connections without a typed agent assignment. Legacy email,
  AgentMail, WhatsApp and website configuration also exists outside that array.
- [Site channel utilities](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/lib/site-channels.ts)
  expose availability and connection routing metadata. Type-only selection cannot
  safely distinguish multiple active connections without a trusted connection ID.
- [Agent detail](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/agents/[id]/page.tsx)
  has no Channels tab at the time of this review.
- [Agent persistence](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/agents/save-agent.ts)
  has a new-agent path, but it looks up an existing agent by role, user and site
  and updates it when found. Additional-agent creation must not reuse this
  role-based update behavior; multiple matching agents can also invalidate its
  single-row lookup assumption. Review list/detail consumers and database
  constraints for similar one-agent-per-role assumptions before implementation.
- [Internal agent message proxy](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/api/agents/chat/message/route.ts)
  resolves the agent from the persisted conversation and rejects external-channel
  conversations. It must not become an unrestricted external delivery endpoint.
- [Channel-message trigger UI](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/workflows/workflow-channel-message-fields.tsx)
  supplies guidance before Customer Support responds. It currently limits
  connection filtering for ambiguous multi-account channels, with a verified
  inbound Voice exception. It is not a general agent router.
- [Support agent lookup](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/app/api/agents/customerSupport/message/agent-data.ts)
  finds active `Customer Support` agents within a site and currently prefers the
  newest created agent. A deterministic product default still needs definition.
- [Support message route](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/app/api/agents/customerSupport/message/route.ts)
  already searches for Customer Support when `agentId` is absent. When no active
  support agent exists for a known site, it has a response-skipped path; the
  placeholder string used there is not a real fallback agent.
- [Temporal channel guidance](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/docs/CHANNEL_MESSAGE_TEMPORAL.md)
  describes durable bounded pre-response guidance. Revalidate its current HTTP
  behavior against code before implementation; it does not establish generic
  multi-agent execution or a running production worker.

## 4. Assignment storage and mutation contract

Use one canonical relationship for both screens. Do not persist independently
editable channel lists on agents and agent selections on connections.

Logical contract, with final storage and endpoint names to be designed:

| Field | Requirement |
| --- | --- |
| Site identity | Server-authorized tenant boundary |
| Connection identity | Stable identity, unique within the site |
| Assigned agent identity | Nullable; must belong to the same site |
| Revision | Supports conflict detection on concurrent edits |
| Audit metadata | Actor, timestamp, previous/new assignment |

Requirements:

1. Enforce one explicit assignment per connection atomically.
2. Authenticate and authorize every read and mutation on the server; proposed
   assignment editors are effective site owners/admins, consistent with activation.
3. Reject foreign-site agents/connections and unsupported or malformed inputs.
4. Save assignment alone, without overwriting provider metadata, activation,
   credentials, licenses or unrelated unsaved Settings fields.
5. Return canonical server state and refresh both views, including other tabs.
   UI cache state is never execution authorization.
6. Handle concurrent reassignment with a conflict response and a fresh read,
   rather than silently overwriting another administrator's change.
7. Model legacy top-level channels with stable identities or a forward-only
   migration. Do not leave them silently unassignable or duplicate provider accounts.
8. Reuse existing activation/license boundaries. Assigning an agent must not
   activate a provider, purchase capacity or incur provider setup fees implicitly.

### Existing-connection migration

- Migrate existing connections, including legacy channels and web, to an explicit
  assignment to the site's existing canonical Customer Support agent.
- If absent, idempotently provision/upsert the default support agent as part of
  the approved migration/setup operation, not during an inbound message.
- Persist one canonical support identity per site. If multiple support agents
  already exist, explicitly select and record the canonical one during migration;
  keep the others visible and independently assignable. Do not delete or merge them.
- Re-running migration must not duplicate agents or overwrite subsequent explicit
  assignments, agent configuration, inactive states, provider metadata or history.
- Assigning to an inactive support agent does not activate it: incoming messages
  remain conversation-only until an eligible agent is explicitly configured.
- Audit migration choices and reconcile assignments with tenant/connection counts.
  A deleted assigned agent must retain an unavailable-assignment marker or equivalent
  state, rather than becoming indistinguishable from an intentionally unassigned
  connection and accidentally activating fallback.

Storage may extend the existing connection contract or use a normalized relation.
Choose only after reviewing shared database consumers and atomic update options.
Any migration must be timestamped and forward-only, with explicit remote approval.

## 5. User interfaces

### Agents > Create agent

- Expose a visible `Create agent` action independent of default-agent setup.
- Create a new persisted agent with its own stable ID; never overwrite a default
  or custom agent because the selected role, template or name matches.
- Support multiple agents with the same supported role, such as separate Sales
  agents for different brands or regions. Default agents remain available and
  are not the maximum allowed set.
- Configure name, description, supported role/type, instructions/context and
  permitted tools/activities using existing editor patterns. Custom agent
  instances do not imply arbitrary new executable role types or unrestricted tools.
- Distinguish creating an additional agent from provisioning a missing default.
  Preserve idempotent default provisioning while making intentional additional
  creation independent; retries/double submissions must not create duplicates.
- After successful creation, open the persisted agent detail and expose its
  Channels tab. Include it in the site agent list and eligible assignment
  selectors without relying on the fixed default-template list.
- Allow independent editing and activation/deactivation. Preserve history and
  apply the approved assignment/fallback policy when an agent becomes unavailable.
- Enforce creation and configuration permissions on the server and through RLS,
  validating site ownership and allowed capabilities. Owner-backed execution
  requires the explicit delegation described below, not template-based escalation.
- Honor existing applicable license/capacity rules and surface explicit errors.
  Do not invent an unlimited allowance, new paid tier or implicit purchase.
- Creating an additional Customer Support agent must not silently replace the
  site's fallback choice or repoint existing Voice/provider configurations.

Blank/custom initialization is required; a template is not mandatory. The outcome
is an independent agent, not a renamed default. Optional template UX, creation
roles, initial agent activation state and capacity policy remain to be specified;
initial tool state is confirmed as disabled for every tool.

### Dynamic MCP catalog and owner-backed preauthorization

- Discover the full applicable MCP tool catalog dynamically, following the
  Assistant integration pattern rather than maintaining a hardcoded tool list.
  This is a target behavior; the exact existing Assistant contract must be audited.
- Show tool descriptions and input schemas from the canonical catalog. New tools
  and catalog changes become visible without manually updating each agent editor.
- All tools are disabled for a newly created agent. Users explicitly enable the
  tools they want; catalog visibility is not execution permission.
- Persist enablement by stable tool identity. Newly discovered tools stay disabled;
  removed tools become unavailable. Changed capabilities must not silently expand
  a prior grant; define version/schema compatibility and reapproval rules.
- Provide explicit user-to-owner preauthorization so enabled tools can execute
  within approved owner-backed site permissions instead of failing solely because
  the conversational user has a narrower role. An owner must authorize delegation;
  a user cannot grant themselves owner rights.
- Keep conversational identity, initiating actor and authorizing owner separate.
  Never mutate a user's role, accept an owner ID from message text as authority,
  expose owner credentials or replace scoped authorization with blanket service-role access.
- Scope delegation to site, agent, enabled tools and permitted resources/actions;
  record granting owner, scope, grant version and lifecycle. Make it revocable and
  revalidate current owner access, site eligibility and grant validity at execution.
- Effective access is the intersection of agent-enabled tools, owner-approved
  delegation, current site/resource policy and channel/session constraints.
  Customer context must not unlock internal-only data or unrestricted owner actions.
- Honor operation-specific approvals for sensitive/destructive actions. A broad
  catalog or standing grant does not override required confirmations.
- Audit actor, owner, agent, session/conversation and tool outcome without secrets.
  Revoked, missing or stale grants deny tool execution with an actionable state.

### Settings > Agent Channels

- Show an Assigned agent selector per connection, with agents from the current site.
- Distinguish configured assignment from connection activation and readiness.
- For no explicit assignment, show `Customer Support (default)`; if the fallback
  is unavailable, show that condition rather than implying service is ready.
- Support assignment, reassignment and clearing an assignment.
- Confirm reassignment from another agent and explain its conversation impact.
- Show pending, success, conflict and failure states without false saved feedback.

### Agent detail > Channels

- List the agent's explicitly assigned connections and their account/number,
  type, status and readiness.
- Allow assignment of an existing eligible connection, reassignment and unassignment.
- Embed new connection setup in the Channels tab at `/agents/[id]`, not only a
  link to Settings. Reuse provider-specific components, backend contracts and
  fee/authorization confirmations instead of implementing a second onboarding path.
- Associate successful setup with the persisted agent through the shared assignment
  contract. Incomplete setup must not claim readiness or silently change routing.
- Customer Support should distinguish explicitly assigned connections from those
  it serves by default. An implicit fallback must not appear as explicit ownership.
- Require a persisted agent before assignment; unsaved agent templates cannot own
  connections.

Shared UX requirements:

- Both screens use the same mutation contract and permission rules.
- Unassigning does not disconnect a provider or delete conversation history.
- Long account and agent labels truncate with an ellipsis; the containing pill
  stays within available width with its rounded edge visible. Preserve the full
  accessible label and expose the full name on hover/focus where appropriate.
- Include loading, empty, read-only and unavailable states and keyboard access.

## 6. Common contact workflow

```text
Receive event
  -> Authenticate provider/session and deduplicate stable event identity
  -> Resolve trusted site + channel + exact connection
  -> Validate channel readiness, licenses and automation eligibility
  -> Recover conversation and apply ownership/transfer policy
  -> Resolve effective agent, using Customer Support when unassigned
  -> If explicitly assigned agent is missing/inactive: save conversation/message only
  -> Respect human-intervention snooze
  -> Run permitted guidance and the effective agent
  -> Recheck delivery eligibility and snooze before sending
  -> Reply through the original connection
  -> Record agent, routing reason, execution and delivery outcome
```

Execution requirements:

- Support all current channel/provider types for every agent, including Voice,
  legacy integrations and web; this is not a role-specific channel allowlist.
  Provider capabilities and verified readiness still constrain actual operations.
- Identify internal users, customers and visitors through trusted context/session
  adapters. Share orchestration without sharing their permissions or histories.
- Centralize agent resolution across channel entrypoints instead of implementing
  a different fallback in each webhook.
- Derive connection identity from verified provider/session data; never trust a
  browser-supplied agent or connection ID as authorization.
- If multiple connections match ambiguously, do not pick the first. Preserve a
  verified inbound event for diagnosis without sending through an arbitrary account.
- Execute the effective agent's supported context, instructions and authorized
  tools. Merely passing its ID to the Customer Support implementation is insufficient.
- Keep workflow guidance separate from response ownership: one intended reply
  per inbound turn, not competing replies from triggers and the selected agent.
- Preserve durable execution, bounded waits, usage accounting and idempotency.
- Distinguish accepted, running, completed, failed, suppressed and unconfirmed
  outcomes. Provider acceptance is not necessarily confirmed delivery.
- Do not replay ambiguous model/provider work automatically or start a second
  agent after a timeout that might have already produced side effects.
- Scope history by tenant and conversation; matching the same lead across
  connections is not sufficient reason to merge conversations.
- Voice requires separate verification of provider-side agent configuration,
  trusted call identity, capabilities and synchronization on reassignment.

## 7. Customer Support fallback

Confirmed behavior: no explicit assignment resolves to an active Customer Support
agent belonging to the same site. Existing channels do not require immediate
manual assignment to retain their current support behavior.

| Condition | Required or proposed outcome |
| --- | --- |
| Explicit agent is eligible | Use that agent, subject to conversation policy |
| No explicit assignment | Use active same-site Customer Support — confirmed |
| Assigned agent deleted or inactive | Create/reuse the conversation and save inbound message only; no automatic reply, tools or Customer Support substitution |
| No eligible Customer Support | Create/reuse the conversation and save inbound message only; expose unavailable automation, do not fabricate a reply |
| Channel disabled, license blocked, or automation snoozed | Suppress automation; fallback must not bypass the restriction |
| Agent lookup/authorization outage | Fail closed with a diagnosable retryable state; do not reinterpret an outage as no assignment |
| Execution timeout or uncertain send | Reconcile original execution; do not launch fallback automatically |
| Invalid cross-site assignment | Reject configuration or block routing as an integrity error; never execute the foreign agent |

Runtime fallback is an effective routing decision, not an assignment mutation.
It applies only when explicitly unassigned, not when an existing assignment is
broken or inactive. Record the routing/suppression reason for support/debugging.
Never activate or create a support agent silently on receipt of a message; the
idempotent migration/setup provisioning in section 4 is a separate operation.

One support agent is canonical per site. Multiple existing support agents are
handled by recording that canonical identity and preserving all others as visible,
assignable agents. Runtime selection must not depend on role query order or the
newest creation date, and additional agent creation must not change the default.

## 8. Conversation continuity and reassignment

Confirmed: the agent's supervisor can take over a conversation, including when
the assigned agent cannot respond. This is an explicit authorized action, not an
automatic fallback response.

Recommended initial policy:

- New conversations use the current connection assignment or fallback.
- Existing conversations keep their agent until an explicit transfer.
- Missing/inactive assigned agents leave the conversation open without an agent
  response; they do not automatically hand off to Customer Support.
- Transfers record actor, previous/new agent and time, without rewriting history.
- In-flight turns keep a stable execution identity; a transfer cannot start a
  competing response or erase an active human-intervention pause.

The channel default and the conversation's effective owner must be visibly
distinguished when they differ.

Takeover must verify the supervisor relationship and site access, atomically
record response ownership and suppress stale automated sends after takeover.
Already accepted provider deliveries cannot be undone; expose that state instead
of claiming cancellation. Preserve human pauses and audit the takeover. The exact
supervisor identity model (human, agent, or both), release/resume UX and automatic
effect of channel reassignment on open conversations remain implementation decisions.

## 9. Acceptance criteria and verification

| ID | Scenario and expected result |
| --- | --- |
| AC-01 | Two WhatsApp connections assigned to different agents route and reply independently through the correct accounts |
| AC-02 | One agent can serve several connections without mixing conversation history |
| AC-03 | Settings assignment appears in the agent tab; changes there appear in Settings after canonical refresh |
| AC-04 | Clearing assignment routes a new conversation to same-site Customer Support without disconnecting the channel |
| AC-05 | Existing and legacy connections migrate to the canonical support agent; an idempotent rerun preserves later explicit assignments and inactive states |
| AC-06 | Missing/inactive assigned agent or unavailable canonical support preserves the conversation/message without an automated reply or tool execution |
| AC-07 | Unauthorized and cross-site assignment/read attempts are denied at server/database boundaries |
| AC-08 | Concurrent edits detect conflicts and never overwrite provider metadata or unrelated drafts |
| AC-09 | Disabled/license-suspended channels and human pauses remain respected, including immediately before delivery |
| AC-10 | Duplicate inbound events do not produce duplicate replies, tools or usage charges |
| AC-11 | Uncertain execution/delivery does not start a second fallback response |
| AC-12 | Ambiguous connection identity never selects an arbitrary account |
| AC-13 | Reassignment and transfer follow the approved open-conversation policy and preserve history |
| AC-14 | Long labels and pills remain inside narrow layouts; full names remain accessible |
| AC-15 | Every agent supports every current channel, including verified Voice and legacy integrations; web enforces one serving agent per site with initial Customer Support assignment |
| AC-16 | An authorized user creates an additional agent from the agent list, and it persists with a new ID after reload |
| AC-17 | Creating two agents with the same supported role does not overwrite either agent or a default; both appear independently in lists and selectors |
| AC-18 | A newly created eligible agent can receive a channel assignment from either screen and execute its own configuration through the approved workflow |
| AC-19 | Unauthorized/cross-site creation and capability escalation are denied; capacity failures are explicit and do not leave false success states |
| AC-20 | Retried or double-submitted creation does not duplicate an agent; default provisioning remains idempotent and independent of additional-agent creation |
| AC-21 | Editing or disabling one additional agent does not alter another agent's configuration, history or assignments |
| AC-22 | Creating an additional Customer Support agent does not silently change the existing fallback or Voice configuration |
| AC-23 | Internal users and external customers use common orchestration but cannot impersonate one another or access another session's history or privileges |
| AC-24 | A blank agent can be created with all tools disabled; the dynamic MCP catalog lists new tools without an editor change and leaves them disabled |
| AC-25 | Only explicitly enabled tools with a valid owner-approved scoped delegation execute; revoked grants, unauthorized owner selection and customer-context privilege escalation are denied |
| AC-26 | Tool catalog removal or capability changes do not silently expand access; the UI and runtime reflect unavailable tools or required reapproval |
| AC-27 | An authorized supervisor can take over; stale automated output is suppressed, ownership is audited and already accepted deliveries remain accurately reported |
| AC-28 | New connection setup works inside the persisted agent's Channels tab with the same confirmations, assignment and readiness guarantees as Settings |
| AC-29 | Multiple legacy support agents remain visible; migration records one canonical default and does not merge, delete or select a different default on retry |
| AC-30 | Deleting an assigned agent cannot turn the connection into an unassigned-fallback path; later messages remain conversation-only |

Use focused Jest tests for routing, permissions, state transitions, UI and retry
behavior. Add database tests for uniqueness, tenant integrity and concurrent edits.
Validate real provider/worker behavior only on an explicitly selected nonproduction
site with disposable data and authorized sends. Offline mocks do not prove
delivery, live RLS, Temporal availability or provider-side Voice configuration.

## 10. Workstreams and rollout

1. Audit all inbound/delivery consumers, Assistant MCP discovery and authorization,
   and specify the remaining implementation details in section 11.
2. Define the shared assignment schema, authorization and atomic mutation contract.
3. Enable independent additional-agent creation, remove role-based identity
   assumptions, and implement Settings selectors, embedded connection setup and
   agent Channels tab with shared state refresh.
4. Implement dynamic tool discovery, disabled-by-default enablement and scoped
   owner delegation; add common routing, conversation-only suppression and
   supervisor takeover across all channel adapters and workers.
5. Validate migration compatibility, legacy channels, concurrency and suppression.
6. Coordinate approved database, API, worker and frontend rollout; monitor routing
   reasons, missing fallback, ambiguous identity and delivery errors.

Do not ship UI assignment as operational before backend consumers honor it.
Preserve existing settings and unrelated working-tree changes. Do not deploy,
apply remote migrations, commit or run production builds without explicit approval.

## 11. Confirmed decisions and remaining implementation details

### Confirmed product decisions

- Contact is user-type agnostic; context and sessions identify and isolate users.
- Existing connections migrate to the existing canonical Customer Support agent,
  provisioned idempotently during approved setup/migration if missing.
- One explicit agent serves each connection; all agents can use all channels.
  Web serves one agent at a time per site, initially Customer Support.
- Missing/inactive assigned agent means conversation/message persistence only,
  with no automatic agent response or substitution. Unassigned connections retain
  the canonical Customer Support fallback when that agent is active.
- Extra legacy support agents stay visible and assignable; there is only one
  recorded canonical default, not an implicit newest-agent selection.
- Additional agents can start blank. The MCP catalog is discovered dynamically,
  all tools initially disabled, with explicit enablement and owner-backed
  preauthorization rather than silent user-role elevation.
- A supervisor can take over the conversation.
- New connection setup is embedded in the agent detail Channels tab as well as Settings.

### Implementation details still to specify

- Define canonical-support selection during migration if several existing agents
  qualify, and the exact idempotent provisioning and unavailable-assignment storage.
- Specify who can create/manage agents and assignments, the initial agent activation
  state and applicable capacity rules. Tool activation is already defined as off.
- Specify the owner-consent flow, delegation scope/lifecycle, tool identity/version
  rules, catalog refresh strategy and operation-specific approval requirements.
- Specify supervisor identity and relationship storage, takeover/release/resume
  controls, and whether channel reassignment changes already-open conversations.
- Audit all provider adapters and define verification for all-channel support,
  including Voice synchronization and web's single-agent invariant. Unsupported
  runtime paths are delivery gaps, not permission to silently narrow the scope.

Related operational guides:

- [Channel activation](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/AGENT_CHANNEL_ACTIVATION.md)
- [Channel phone numbers](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/AGENT_CHANNEL_NUMBERS.md)
- [Automation snooze](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/CONVERSATION_AUTOMATION_SNOOZE.md)
- [Security](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/SECURITY.md)