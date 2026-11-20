# Connectors implementation and rollout

## Customer Support discovery (local; not deployed)

A bound text conversation registers `support_connectors`, not a function for
every catalogue entry. Use `search` with the user's intent; use `list` for a
connector overview or `list` with a returned `connector_id` to browse its tools.
Each page contains at most five summaries. `next_cursor` continues the same
search within the turn. A page can be empty while later accounts still have
matches. If `stale_cursor` is returned, restart without the cursor. Only
`describe` fetches the selected tool's schema for
the model; `call` needs the exact reference, version, hash and arguments. The
normal completion loop is bounded to eight turns and a time budget. Catalogue
membership alone never enables execution.

Internal workspace conversations require an authenticated member, private
thread and assigned active agent. With effective member and agent permissions,
the server can dispatch a compatible reviewed read directly. **Allow requests for
access** permits eligible callers lacking use to request a private decision instead.
The channel tool allowlist applies in both cases. For example, listing Supabase
tables remains an instance operation; disabling approval does not add it to chat.
At approval time the server rechecks the Support role, and for member requests
also the original owner and private thread, before dispatch and result release.
A pending receipt is not a successful read. An old, unbound or recovered command
does not inherit the owner's identity.

External conversations do not inherit workspace permissions, even with approval
off. For Gmail, a manager can explicitly publish the **subject lines** from a
dedicated custom Gmail label (e.g. `Label_12345`) to verified customers only,
or to all visitors including anonymous visitors. This is a limited publication,
not an inbox search. The workspace's allowed tools must include
`GMAIL_FETCH_EMAILS`; the model cannot supply a mailbox, label, search query or
page token. Only titles from messages bearing the configured label may be
returned, never senders, message bodies or attachments. An unrecognized output
shape is denied. Treat every subject on that label, including future subjects,
as published to the selected audience. Disable publication or remove the label
to stop future reads; previously delivered messages cannot be recalled.

Other private operations are not exposed by this publication. The existing
`request_connector_review` path remains available for its explicitly supported
requests, without revealing accounts, access or private results. Provider shapes,
real authenticated channel delivery and production configuration require staging
acceptance before rollout.

After the preceding connector migrations, roll out
`20261120050000_connector_support_publication.sql` before the matching API and
web client. Existing and newly connected accounts have no publication by
default. An older policy editor that does not send publication settings clears
them on save. On staging, verify both approval settings and the actual provider
metadata shape using a dedicated test label; do not use production mail for QA.

## Discovering Supabase tables from an instance (local)

Use `tools` search with a phrase such as **lista todas las tablas**. Instance
search can rank already-authorized connector candidates semantically, with a
lexical fallback when embeddings are unavailable. `SUPABASE_LIST_TABLES` is a
reviewed metadata operation; it is not a SQL console or the native Apps database
inspector. For directly authorized instance calls, the connector returns the
successful provider JSON envelope (including discovery metadata and diagnostics)
after credential redaction, within existing transport and tool-context limits.
The agent interprets the tool data; it need not match a local table-list format.
Discovery can be partial. This does not expand channel publication or approval receipts.

The assistant cannot supply a project, query, schema or URL. The server supplies
the verified account's project and checks the exact provider account before
dispatch. `all` or an exact selected ID, the assistant host, member/agent
permissions, business screens and any required private human approval still
apply. Do not disable approval to make search work. A channel conversation
cannot request this infrastructure action.

Rollout requires `20261120040000_connector_supabase_project_binding.sql` plus
matching code. New verified PAT accounts capture the project reference during
setup. Do not infer it for older accounts from a display label or the Robots URL.
For an existing active PAT account, a manager can use **Verify and bind this
project** in its connection card. This checks the entered reference via a pinned
project-metadata read using the existing provider account. Only a confirmed
match is saved, for that connector, once. No new token or account is required.
Open `/robots?connector=<local-connector-uuid>`, choose the instance, and submit
the request in **Ask**. The link narrows the turn to that one visible account;
it does not switch tenants, select a different account or run the tool itself.
An unbound account cannot advertise or execute the project-specific tool. The
PAT needs Database Read for enumeration; Project Settings Read verifies project
access at setup but does not grant database access. Deployments using human
approval also require the private action-approval schema. Local checks do not
establish that a production PAT has sufficient permissions or that a particular
provider schema/output version works live.

An authorized interactive member and agent can run this action directly. If an
eligible caller can only request review, the private receipt may omit results over
32 KiB. Do not report omitted results, a pending approval or a provider schema
error as a complete table list.

## Per-account tool access (local; not deployed)

New verified accounts use **All compatible tools** on the assistant host. Existing
policies keep **Only selected tools**, their exact IDs and their existing hosts.
Only in selected mode does an empty selection deny every tool. In all mode the
resolver intersects the toolkit's current reviewed runtime inventory with the
usual account, host, agent, member, screen, scope and approval checks. It never
promotes a catalogue entry to an executable tool. Supabase table discovery also
requires the verified project binding described above.

Apply `20261120030000_connector_tool_access_mode.sql` before deploying the
matching API and web client. Older policy writers that omit the mode save
`selected`, never `all`. Pending approvals pinned to the older policy snapshot
may require a new proposal rather than running under a changed policy.

## Human review in Conversations (local; not deployed)

Open the originating thread in **Conversations**. The internal review card is not
a customer message or an ordinary reply suggestion. Instance requests without a
customer thread now share a real, private `conversations` row per instance/owner/agent,
opened by `/chat?conversationId=<uuid>`. There is no review-only navigation or synthetic list entry. The reviewer sees the
original message excerpt when its source can be verified, alongside the account,
requesting agent, version, arguments and expiry. **Approve and run** executes as
the authenticated, authorized manager. Rejection never calls the provider.

The interactive assistant queues only eligible requests missing use permission
when the account permits requests. The `request_connector_review` adapter can only **propose** a reviewed action
for a server-verified site/conversation/agent. It cannot execute, discover
private accounts on behalf of a customer, claim a proposal or receive its result.
New channels must bind those identities in their own trusted ingress. A public
reply, a task, an escalation, or accepting an outbound message is not approval.

The server stores an immutable proposal with a 24-hour expiry, rejects changed
arguments on replay, and claims it once before dispatch. A new decision includes
only the site and the request ID, not parameters, a model-supplied token or the
actor's identity. Approval rechecks the pinned schema, account/policy snapshot,
scope and identities. An ambiguous outcome is never automatically dispatched
again. Reviewed read results are only shown to the deciding member on success,
bounded to 32 KiB and never posted into the customer thread. Catalogue-only
actions, including unreviewed Supabase tools, remain non-executable.

Follow the [staged rollout](DATABASE_MIGRATIONS.md#private-instance-approval-conversations-not-applied):
protect public reads/delivery first, then apply `20261120060000_connector_review_conversations.sql` and enable the linked API/web flow.
Valid, unexpired instance requests are linked without being run. Notify managers that existing enabled flags
now permit missing-use requests rather than requiring confirmation for users
and agents already allowed to execute. Previously pending work is never auto-run.

## Workspace access for newly connected accounts

After the workspace-access migration, verifying a **new** account initializes
its workspace sharing and tool policy together. Eligible members and active
same-site agents inherit access unless restricted for that account. The initial
assistant policy permits only exact reviewed reads for its toolkit: Gmail email
reads or HubSpot contact reads. Other toolkits, including Supabase, have no
executable default. Provider scopes, account state and business-screen checks
still apply. Sharing an account does not share its credential.

Existing connections keep their explicit-grant model, enablement and policy.
There is no access backfill. Coordinate the rollout: pause new connections and
drain pending authorization attempts before applying
`20261119223011_connector_workspace_access.sql`. Enable connection setup again
only after the matching API and the web sharing disclosure are available.
The migration was applied to Makinari and verified at 2026-11-20 01:26:55 UTC.
The one existing account retained explicit access; its grants and policy were
unchanged. New connections were paused for the migration. The API and web were
not deployed as part of this operation.

## Standard numbered pagination — 2026-11-19

Catalogue and Tools reuse the shared numeric Pagination component, with explicit
First/Last controls and disabled boundary actions. API page input is bounded and
cannot be combined with a legacy cursor. Composio page/limit cursors are encoded
server-side; each jump still rechecks access. Live last-page reads returned 29
toolkits on page 37 and one Gmail tool on page 4, both without a continuation.
Domain filters apply across the provider inventory before pagination, using the
shared domain registry (including curated toolkit overrides). Filtered totals and
page numbers refer to matching toolkits. Connected filters operate only on visible
toolkits. A failed or capped provider scan returns an error, not an empty or
partial catalogue. Search/domain/tab changes reset the page to one.

Read-only verification of the new provider scan returned 1,829 toolkits. Customer
Support had 45 matches including Zendesk; Finance & Accounting had 56, with
QuickBooks and Xero on its first filtered page. This was not a deployed browser
test.

## Detail Summary / Tools — 2026-11-19

**Tools** and **Add tool** use the same paginated, non-deprecated inventory for
the selected toolkit and workspace credential. Managers can save exact catalogue
IDs in an account policy, including actions not yet supported by the runtime.
The API verifies catalogue membership before persisting a nonempty selection.
Saving an ID never calls a tool. Execution still requires independent action
review, schema, host, scope and effective-access checks. In selected mode an
empty allowlist continues to deny execution. Updating the picker requires matching API and web
versions, not a migration or a change to existing saved policies.

Detail navigation now uses Summary / Tools tabs instead of a duplicate back action.
Tools loads a 20-item provider metadata page on demand through the authenticated
`GET /api/connectors/catalog/[slug]/tools` BFF/API route. It exposes only names,
slugs, descriptions and reviewed-inventory labels, not execution authority or input
schemas. Every page rechecks site access and uses the selected server credential.
Live Gmail reads returned 61 total tools, with two distinct 20-item pages. Provider
calls were metadata-only; no tool execution or OAuth effects occurred.

## Full-card navigation and detail parsing — 2026-11-19

Each catalogue card is one keyboard-accessible link, covering logo, description,
badges and counts without nested controls. Google Calendar detail failed because
its category `slug` contains an ampersand, unlike toolkit identifiers. The API now
uses the same bounded category validation for `slug` and `id`. Live read-only
detail/auth-config checks passed; 253 API and 55 web connector tests passed.
The project has no existing Google Calendar OAuth auth configuration; that is a
setup state, not a render failure. No auth config or connection was created.

## Catalogue presentation — 2026-11-19

Connector messages now use the localization provider's double-brace placeholders
for counts, dates and workspace labels. Cards and detail render the provider's
allowlisted public logo, without referrers, with the connector icon as an error
fallback. The shared expandable search control appears before All/Connected;
Enter submits, clear resets query/pagination, and no second submit button exists.
Presentation regressions exercise the real localization provider and Next Image,
not a different interpolation mock. Gmail's public logo returned HTTP 200/SVG.

## Catalogue adapter correction — 2026-11-19

The replacement platform project key authenticated successfully. A separate parser
defect then rejected real category `{id,name}` entries (including ampersands) because
it required `slug`. The API adapter now normalizes both forms without changing any
authorization checks. Live read-only checks parsed 50 toolkits with pagination and
Gmail detail; 249 API connector tests passed. The earlier credential diagnosis below
describes the previous key, not the current one. No OAuth/tool execution or browser
session acceptance was performed for this correction.

## Catalogue credential diagnosis — 2026-11-19

After schema repair, a read-only `GET /toolkits` through the actual API provider
adapter and local `COMPOSIO_API_KEY` returned provider HTTP 401, mapped to
`PROVIDER_AUTH_FAILED`. No credentials or provider payloads were logged. The key
had no surrounding whitespace and no legacy alternative was configured. Replace
the server key with a valid Composio project credential (or configure valid site
BYOK); never silently switch projects on a rejected BYOK. OAuth/tool execution was
not attempted. The UI now distinguishes provider credential rejection, storage,
API connectivity and unsupported provider responses instead of one generic error.
Focused request/catalogue/proxy tests: 33 passed; focused ESLint passed.

## Remote repair application — 2026-11-19

With explicit user approval, migrations `20261119223000`, `20261119223001`
and `20261119223010` were applied to Makinari (`rnjgeloamtszdjplmqxy`). The five
initial connector migrations were already recorded remotely. Before application,
the catalogue query failed with SQLSTATE `42703` because `revocation_dispatched`
was absent. Post-application checks confirmed both new columns, all three enabled
identity triggers, manager serialization and service-only revocation RPC execution.

The CLI ran from a temporary directory populated with the actual remote migration
history and only the three approved additions; no historical migration repair,
unrelated migration, production build or deployment was performed. A final dry run
reported the remote database up to date. Older queued work remains unverified and
must be re-enqueued by its authenticated actor. Live OAuth/provider and authenticated
browser acceptance remain unperformed. Local-only statements below describe the
earlier implementation validation, before this explicitly approved application.

**Status:** Initial local increment implemented and tested, not deployed. **Date:** 2026-11-19.
This is implementation evidence, not a replacement for the approved
[architecture](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/CONNECTORS_ARCHITECTURE.md)
and [access model](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/CONNECTORS_ACCESS_MODEL.md).

## Implemented boundaries

- Web catalogue/detail at `/connectors` and `/connectors/[slug]`, existing shell,
  StickyHeader, TopBar actions, domain filters and All/Connected views.
- Account-scoped member/agent grants, exact-tool policy and local enable/disable
  controls; management is distinct from provider-use authority.
- Same-origin authenticated BFF forwards only the verified actor bearer. API routes
  independently authorize the actor/site; no generic service key impersonation.
- First-class connector/provider/attempt/grant/policy tables, RLS, atomic revision
  checks and minimal administrative audit. Accounts predating workspace sharing
  retain their original explicit permissions and enabled state.
- OAuth attempts use an actor/site/nonce binding, exact pre-created provider account,
  a single-use completion claim and provider identity verification before persistence.
- Domain registry feeds catalogue and skill discovery; concrete reviewed tool
  references use the same decorated tool gateway, not an alternative SDK route.
- Bundled `connector-crm-operations` and `connector-messaging` procedures are the
  primary CRM/communication mappings, ahead of narrower native outbound/content
  skills. The Tools & permissions editor lets managers select exact catalogue IDs.

The operation inventory is deliberately narrow: reviewed Gmail/HubSpot reads and
project-bound Supabase table metadata in the interactive assistant.
Catalogue availability does not promise executable coverage for every displayed
provider action. Unknown schemas, missing scopes or permissions remain blocked.

## Explicit adjustment: version-pinned REST execution

The current public Composio session creation/execution contracts do not expose an
execution version selector. A schema returned by session discovery is not proof
that dispatch uses that version.

The selected backend therefore uses **REST v3.1 direct execution**, explicitly
passing the exact connected account, provider user and tool version. It re-reads
the pinned schema, compares its hash and checks the live provider account/scopes
before dispatch, then rechecks local authorization immediately before the request.
This is the deliberate execution backend, not a runtime fallback to `composio-core`
or to unversioned tools. It never creates automatic sessions, connections, proxy
tools, workbenches or file loaders.

Composio may bill a direct-execution add-on; the policy editor states this. Customer
BYOK takes precedence. Following the November 19 repair approval, an absent BYOK
uses the server's platform key; usage can therefore charge the platform project.
No new Makinari charge or plan entitlement is introduced.
Only read actions in the reviewed operation inventory are initially supported.

## Self-service OAuth and API-key guidance

A manager can create a Composio-managed Google Calendar OAuth configuration from
the connector detail when no enabled OAuth 2.0 configuration exists. The API
requires a verified provider binding and a project-wide Upstash lock, and only
requests the reviewed read-only Calendar events scope when the provider
advertises it for the default managed app. No client credentials or scopes are
accepted from the browser. An existing OAuth configuration takes precedence.
After setup, the manager still explicitly connects and authorizes an account;
setup grants no member or agent access.

When no OAuth configuration is available, a manager can connect managed-cloud
Supabase with a project reference and a personal access token (`sbp_`), not a
project API key. The project reference is used only for a read-only Management
API verification and binding of supported runtime actions; it does not restrict the token itself. Prefer a project-scoped token
with Project Settings Read. Composio stores the token; Makinari does not store it.
The server reuses or creates the Supabase API-key auth configuration (creation
requires the project-wide Upstash lock). It verifies an active, site-bound
Composio account before recording the connection. New accounts inherit workspace
access, and project-bound PAT accounts can use the reviewed table inventory when authorized. This
path requires the platform `COMPOSIO_PROJECT_ID` or a verified workspace project,
but no OAuth callback is needed for the platform token path. Existing OAuth
configurations still use the standard OAuth verification flow.

## Provider setup prerequisites

Saving a Composio project key permits catalogue reads, but does not prove the
project's identity or callback-verifier configuration. Public project-management
endpoints require an organization or user credential, which this feature does not
collect or silently substitute for the customer's project key.

On the **API server**, configure:

- `COMPOSIO_API_KEY`: platform fallback key; legacy `COMPOSIO_PROJECT_API_KEY` is
  accepted only when the primary variable is absent. Never expose either to clients.
- `COMPOSIO_PROJECT_ID`: operator-attested project owning that platform key, needed
  for OAuth/execution binding, not catalogue reads. Configure its exact callback
  verifier in the Composio dashboard; this variable does not perform introspection.
- `CONNECTORS_WEB_ORIGIN`: trusted HTTPS web origin, without path/query/credentials.
- `CONNECTOR_PROVIDER_BINDINGS`: BYOK-only JSON array of deployment-reviewed records with
  `site_id`, `project_id`, `credential_revision` and `oauth_verifier_url`.

`credential_revision` is the SHA-256 digest of the stored encrypted site credential,
not the raw key and not a substitute for project identity. The verifier URL must
equal the configured web origin plus `/connectors/callback`. An operator must
verify that the saved key belongs to that project and that the project's Composio
callback identity verifier is configured to this exact URL before installing the
binding. This is **explicit operator attestation**, not automatic provider inspection.

Platform revisions use `platform:` plus SHA-256 of the key, and remain server-only.
BYOK read/decrypt errors never fall back. Provider user identity remains the site
UUID in both modes, never `default`. Existing provider/project/revision bindings
must match: adding/removing BYOK cannot silently migrate connected accounts.
The catalogue reports only `credential_source: byok|platform`, never key/hash.
The local API already has a global key configured; the project ID and trusted
callback origin were absent at repair time and must be supplied before live OAuth.

No real keys, account IDs or project values belong in this guide. Missing/duplicate
bindings, an unrecognized credential revision or another project fail closed with
a setup/revalidation error. Credential rotation does not silently transfer account
authority or re-enable existing connections. Existing provider records require
an explicitly reviewed revalidation/migration procedure before use after rotation.

Use an enabled OAuth2 auth configuration belonging to the selected toolkit.
Other auth methods, dashboard-wide adoption, shared accounts and custom MCP are
not supported in this local increment.

## OAuth callback behavior

The verifier can return only `session_uri`. When no attempt ID is available, the
callback page lists the current actor's browser-bound pending attempts and asks
for an explicit selection; it never guesses the latest tab or current workspace.
Completion compares the provider's returned account against the account recorded
before redirect. A mismatch is not adopted and cannot acquire local access grants.

The proof is captured in memory and removed from the browser URL. The BFF stores
the per-attempt nonce in an HttpOnly SameSite cookie, never localStorage. Completion
is not automatically retried. A lost response after proof consumption leaves an
unknown outcome for manual reconciliation; no false Connected badge or repeated
external write. Navigation-only current-site redirects exempt the callback; API
authorization still verifies its actual attempt/site/actor.

## Migration and deployment gates

The canonical database repository and both application repositories contain exact
copies of these forward migrations:

1. `20261119220100_connector_resources.sql`
2. `20261119220101_connector_access_boundary.sql`
3. `20261119220102_connector_access_mutations.sql`
4. `20261119220103_connector_auth_finalization.sql`
5. `20261119220104_connector_provider_state.sql`
6. `20261119223000_connector_identity_guards.sql`
7. `20261119223001_connector_manager_serialization.sql`
8. `20261119223010_connector_revocation_dispatch.sql`

No remote migration is authorized or applied by this work. Inspect target schema,
review/apply all migrations in order with explicit approval, then deploy API and
web changes together. Before migration, routes report storage unavailable rather
than pretend the user has an empty catalogue. No production build or deployment
was performed for this local implementation.

Synchronization is explicit per account: `POST /api/connectors/connections/[id]/sync`
with the observed revision. There is no project-wide import or background poll.
State changes lock the connector, recheck manager authority/revision and update
scopes/audit atomically; synchronization never re-enables a disabled account.
Local disable precedes remote revocation even when the credential is unavailable.
Revocation-pending state clears only after verified provider revocation.
An explicit retry is allowed only while `revocation_dispatched=false`: preflight
did not claim an upstream write. A CAS dispatch claim precedes the provider call.
Unknown dispatched outcomes and historical pending records remain reconcile-only;
no automatic replay. Manager authority rows stay locked through mutations.

## Review repairs

- Prompt and connector identity share the same server-selected Growth Robot agent;
  browser `remote_instances.agent_id` is not authority. NULL-agent new chats work.
- Verified caller origin travels through workflow/recovery independently of
  `recoveryScope`; internal, queued, node, plan and step execution remain denied.
  Queue actor is immutable and authenticated at insertion; no owner fallback.
  Legacy queue rows are unverified and must be re-enqueued by the actual actor.
  Browser recovery snapshots cannot be rewritten or moved between scopes.
- Strict secrets-field types reject array/object coercion before query construction.
- UI requires coherent account/access revisions, exposes revoke-only departed
  grants, preserves callback actor, lists only unexpired pending attempts and clears
  completed cookies. Replayed completed callbacks return conflict, not old success.
- Provider-disabled accounts cannot dispatch; known pagination tokens survive
  credential redaction. `tools` search exposes `connector_next_cursor` and accepts
  `connector_cursor` plus optional `connector_id`, so bounded discovery does not
  hide later accounts. Cursors recheck current authorization and inventory.
- BFF co-owner authorization uses the same actor-bound connector access RPC,
  including license/screen/location rules, with no generic-role bypass.

## Deliberate remaining gates

- Background workflow delegations and voice connector execution are not enabled.
  Bound Customer Support text turns use the restricted gateway described above.
  No missing user or agent identity falls back to a site owner.
- Interactive use requires a stable verified agent binding in a supported host;
  unsupported instance identities return an explicit denial/unavailable state.
- Missing use permission is never direct execution authority. See the private
  Conversations review flow above for supported hosts.
- Read-only reviewed actions still require supported schemas, exact scopes and
  business-screen access. Categories and selected skills cannot broaden permissions.
- Live OAuth, provider execution, real account reauthentication, and authenticated
  browser acceptance require an explicitly approved disposable target/configuration.
- No arbitrary writes, payment execution, custom MCP, shared accounts, Instant tools
  or auto-import of every account from a provider project.

## Validation

Repair validation (offline, after the changes above):

| Check | Result |
| --- | --- |
| API connector suites, including real host call flow | 22 suites, 245 tests passed. |
| Web connector UI/BFF/secrets and disposable PostgreSQL | 15 suites, 153 tests passed. |
| Additional assistant route/context/recovery and pending-work regressions | 127 + 13 tests passed. |
| Final API and web `tsc --noEmit --pretty false` | Both passed. |
| Focused web ESLint and both repositories' `git diff --check` | Passed. |
| Eight connector migration copies in canonical/API/web | Byte-identical; no remote application. |

The SQL suite includes authenticated instance-agent/queue/recovery spoof denial,
manager-removal serialization and single-claim revocation dispatch. Browser UI
tests are component tests, not an authenticated live-browser acceptance session.

Focused Jest suites cover web UI/BFF, credential boundaries, API provider transport,
OAuth correlation, access checks, runtime discovery and schema validation. Separate
socket-only PostgreSQL tests exercise actual constraints, RLS, grant races and
finalization, with fixture site/plan data rather than a complete billing bootstrap.
Offline provider fixtures are test evidence only; production routes call real
provider adapters and never substitute mock accounts or tool responses.

Initial-increment validation (before the repairs above) ran with Node 25.9.0:

| Check | Result |
| --- | --- |
| API focused connectors: `npm test -- --config jest.connectors.config.js --runInBand --silent` | 19 suites, 223 tests passed. |
| Web UI/BFF/secrets plus isolated connector SQL suites | 14 suites, 122 tests passed. |
| Web callback/login and existing middleware regressions | 3 suites, 32 tests passed. |
| API existing router/screen, MCP/document routing, skill and context regressions | 9 suites, 179 tests passed. |
| `tsc --noEmit --pretty false`, API and web | Both passed. No Next build or typegen run. |
| Focused web ESLint, touched connector source/tests and credential/callback boundaries | Passed. |
| Migration copies, document links/line budgets, `git diff --check` | Passed. Five migrations are byte-identical across three repositories. |

The broader API run also exercised the old
`src/lib/agentbase/agents/toolEvaluator/executor/__tests__/executeTools.test.ts`:
five tests failed (four invalid `process.env` getter spies and one timeout/open
handle). All five failures reproduced against the unchanged HEAD implementation
using temporary baseline files outside the repositories. They are not counted as
passing or repaired; known native MCP/document paths and the new legacy-default
execution-denial regression passed separately.

No authenticated browser, real OAuth, remote migration, production build, commit,
push or deployment was performed. Unrelated Finder and assistant test edits were
preserved. This increment does not complete the background workflow/delegation
phase of the target plan.