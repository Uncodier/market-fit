# Connectors and skill-aware tool discovery

**Status:** Approved design; local implementation underway. **Reviewed:** 2026-11-19.
See [implementation and rollout](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/CONNECTORS_IMPLEMENTATION.md) for shipped-code boundaries and explicit REST execution adjustment.
This design does not authorize remote migrations, deployment or paid provider calls.

## 1. Decision summary

Introduce **Connectors** at `/connectors`, next to Skills in Automation. Use the
existing workspace shell, TopBar, StickyHeader and component library. The supplied
Composio screenshot is a catalogue/navigation reference, not a commitment to copy
its shell, account-sharing model, counts, Instant billing or custom MCP features.

Create one API-owned **connector capability registry** shared by the UI, skill
discovery and the existing `tools` router. It relates provider toolkits and tools
to business domains and relevant skills. It does not grant access.

Use `connectors` as the site-owned resource for each connected account, with
workspace sharing and exceptions for members on new connections. Agents need
explicit grants for each account, regardless of provider or member sharing mode. See the [access model](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/CONNECTORS_ACCESS_MODEL.md).

The intended discovery path is:

```text
Task intent -> skill_lookup search/get -> relevant procedures + domain hints
            -> tools search/list -> authorized native AND connector capabilities
            -> tools describe -> exact account/version/schema
            -> tools call -> fresh policy check -> provider -> execution receipt
```

No new universal tool replaces `tools`. No per-connector skill explosion. No
eager loading of every provider tool schema. `use_composio_tools` becomes a
compatibility facade over the same resolver, not an alternative access path.

Keep three concepts separate:

1. **Available:** provider catalogue metadata; not proof of authentication.
2. **Connected:** an authorized external account persisted for this site.
3. **Executable:** connected and enabled, with permitted actor, host, operation,
   account, OAuth scopes, current schema and any required approval.

## 2. Verified current state

| Boundary | Existing behavior | Consequence |
| --- | --- | --- |
| Web configuration | [ComposioSection](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/settings/ComposioSection.tsx) stores/checks/removes a BYOK key. | No connector catalogue, OAuth onboarding or saved-account management UI. |
| Provider catalogue | [ComposioService](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/lib/services/composio-service.ts) uses REST v3.1 toolkits and auth configs. Both legacy list routes return toolkits. | Reuse normalization, not the misleading assumption that these are connected accounts. |
| Assistant | [assistant-tools](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/app/api/robots/instance/assistant/assistant-tools.ts) adds `use_composio_tools` when the site key exists. | Key presence is currently the injection condition, not connection readiness. |
| Discovery | [tool categories](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/app/api/agents/tools/router/tool-categories.ts) omit Composio; the generic wrapper falls into `other`. | Domain searches do not have concrete external capabilities to rank. |
| Tool router | [router](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/app/api/agents/tools/router/assistantProtocol.ts) has a static name index; category filters only `list`; `search` returns up to ten schemas. | Needs a bounded lazy resolver, not just new prompt text. |
| Skills | [SkillsService](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/lib/services/skills-service.ts) and [keyword search](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/lib/services/skill-keyword-search.ts) index metadata, not skill bodies. | Adding a Tools paragraph alone cannot fix discovery. |
| Authorization | [screen map](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/app/api/agents/tools/router/tool-screen-map.json) makes Composio admin-only under Integrations; unmapped names are denied. | Dynamic tools require an explicit trusted policy resolver; never allow a name prefix globally. |
| Zavu precedent | [invitation finalization](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/lib/services/zavu/invitation-finalization.ts) converges provider state and durable connection state. | Reuse the server-owned finalization principle, not its channel JSON or billing rules. |

### Existing debt that blocks broadening access

- Legacy Composio catalogue route handlers do not independently authorize the
  supplied site before secret lookup. Harden or delegate all aliases; do not leave
  an older route as a bypass around the new endpoints.
- The secret reader selects only site/provider. New access must select the exact
  site-level `composio` / `integrations` secret, distinguish missing configuration
  from outages, and use an explicit credential revision.
- The UI says Vault, but [the route](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/api/secrets/route.ts)
  stores encrypted `site_secrets` values. It also has a plaintext retrieval operation
  and a fallback encryption key. Do not describe this as verified Supabase Vault
  custody. Make the Composio key write-only, fail closed without configured
  encryption, and protect the old generic route for this provider as well.
- Execution uses `composio-core` **0.4.8**, not the current session SDK. Installed
  source configures shared HTTP client headers, implicitly selects an account and
  can fetch URLs/read local files through `*_file_uri_path` parameters. This is
  source-derived risk, not a claim that an exploit or live failure was reproduced.
  Do not expand this adapter or reuse its implicit file handling.

## 3. Product and UI architecture

### Routes and navigation

- `/connectors`: `tab=all|connected`, `q`, `category`, `sort`, optional `skill`;
  validated URL state supports refresh, back/forward and shareable filters.
- `/connectors/[slug]`: select an authorized account; Overview, Connection, Access
  (agents/members), Tools & permissions, Related skills and Activity sections.
- Keep `/integrations` for provider credentials, channels, webhooks and models.
  Add a Connectors link to its Composio section; keep only one credential editor.
- Add URL-tab support to Integrations before advertising a deep link to the
  Composio section: it currently does not consume `?tab=`.
- Register the base route in [routes](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/config/routes.ts)
  with workspace layout/providers, and the `connectors` navigation key in
  [navigation areas](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/config/navigation-areas.ts).
  Include title/help/localization, breadcrumbs, module visuals, launcher, shortcuts,
  mobile navigation and Team blocked-screen selection.
- Navigation controls are not API authorization. `requireSiteAccess` also does
  not itself enforce `blocked_screens`; the connector access boundary must do both.

### Component composition

| Surface | Reuse / proposed feature component |
| --- | --- |
| Global shell | Existing [TopBar](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/navigation/TopBar.tsx); never render a second one. |
| Page actions | [TopBarPrimaryActions](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/navigation/topbar-primary-actions.tsx) for page-owned Connect/Reconnect handlers. The slot exists on registered workspace routes. |
| Catalogue toolbar | [StickyHeader](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/sticky-header.tsx), existing pill Tabs, SearchInput and Select. Respect its gutters, mobile behavior and `--topbar-height`. |
| Catalogue | `ConnectorCard` composed from existing Card, Badge, Button and icons; responsive 1/2/3-column grid. |
| Filters | In-content desktop category rail and mobile Select/Sheet. QuickNav is scroll navigation, not a filter; do not repurpose it. |
| Detail | SectionCard, existing dialogs/confirmation, account rows and Related skills links. |
| Feedback | Existing skeleton/empty components; distinct no results, unavailable, unauthorized and setup-required states. |

Use English source copy and existing localization infrastructure. No new UI
library or direct `lucide-react` imports. Follow the [card rules](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/cards/README.md).

**All** displays catalogue definitions. **Connected** displays distinct toolkits
with retained connections, including clearly marked reconnect/disabled states;
show account counts separately. A successful OAuth connection is not automatically
enabled for every agent. Each card distinguishes `Connected` from `Agent access`.

Search, tab, domain and skill filters intersect. Counts come from the same scoped
snapshot, not the screenshot. Never label a partial count as a global total.
Popular is provider-backed ranking or explicitly labelled curation, not a domain.
Instant may be identified as a capability/cost attribute but is not enabled in v1.
Do not display functional Shared or Add Custom MCP controls in v1.

UI states include no site/key, initial load, cancelled/expired authorization,
pending verification, connected, disabled, reconnect required, provider unavailable,
disconnect pending and unknown outcome. Do not optimistically mark connection or
revocation successful. Abort/retire old requests and auth state on identity/site
changes; invalidate caches after finalization, key rotation and disconnect.

## 4. Ownership and boundaries

```text
Workspace browser
  -> same-origin web BFF: authenticate actor, validate site/screen/action
  -> external API: independently verify actor and authorization
      -> Connector catalogue + domain/skill registry
      -> Connection lifecycle + policy resolver
      -> REST v3.1 Composio adapter (server-held site key)
      -> existing Supabase with RLS + narrowly authorized server writes

Assistant/workflow host -> same policy/resolver -> same Composio adapter
```

The web does not call Composio or receive its API key/tokens. Forward the verified
actor's bearer to the API for reads and writes; never replace it with a generic
service key that erases actor authorization. A machine host requires a separately
validated execution principal/delegation, not a user ID from tool arguments.

Implement the new adapter using existing `fetch`, TypeScript and Zod, not another
SDK dependency. Keep headers request-local; use fixed provider origins, bounded
responses/timeouts, sanitized errors and no arbitrary URL pass-through. Use
version-pinned REST execution with explicit toolkit/action/account binding, as
recorded in the implementation adjustment. Automatic auth, Instant, proxy, remote
shell/workbench and multi-execution are not exposed. Catalogue/skill loading never
creates sessions or executes provider tools.

Provider account checks complement, but never replace, our authorization.
Pin schema/toolkit versions supported by the chosen endpoint; if a version or exact
account cannot be enforced, that operation stays unavailable until resolved.

### Proposed HTTP contract and module ownership

The browser uses these same-origin BFF routes; the API owns matching domain
handlers. Every route validates input, actor, current site access and screen policy.
Callback completion adds the bound-attempt checks described below.

| Route | Contract |
| --- | --- |
| `GET /api/connectors/catalog` | Bounded catalogue, domain/skill filters, cursor and truthful totals/freshness. |
| `GET /api/connectors/catalog/[slug]` | Toolkit details, supported auth and reviewed related skills; no raw credentials. |
| `GET /api/connectors/connections` | Safe local accounts and readiness, separately from catalogue definitions. |
| `POST /api/connectors/auth-attempts` | Manager-authorized start; server selects provider namespace and callback origin. |
| `GET /api/connectors/auth-attempts/[id]` | Owner/manager status read; does not silently finalize or execute a provider tool. |
| `POST /api/connectors/auth-attempts/[id]/complete` | Bound callback proof, provider verification and atomic finalization. |
| `POST /api/connectors/connections/[id]/sync` | Manager-authorized single-account reconciliation with expected revision; no project-wide adoption. |
| `POST /api/connectors/connections/[id]/disconnect` | Disable locally and reconcile remote revocation with durable outcome. |
| `PATCH /api/connectors/connections/[id]/policy` | Manager-reviewed host/action/account policy with expected revision. |
| `GET/PATCH /api/connectors/connections/[id]/access` | Scoped effective access / manager-only atomic grant changes with expected revision; see the access model. |

GET responses are private/no-store at the HTTP boundary; internal catalogue caches
are explicitly scoped. Mutations require origin/CSRF protection, strict size/field
validation and idempotency or revision checks. Callback landing authenticates first,
then hands proof to completion; it is not a public generic execution endpoint.

- Proposed web feature modules live under
  `/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/connectors/`;
  proposed BFFs under `/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/api/connectors/`.
- Proposed API registry, adapter, access, lifecycle and schema-resolution modules
  live under `/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/lib/connectors/`;
  HTTP handlers under `/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/app/api/connectors/`.
- Extend the existing router and skill lookup through small adapters. Do not copy
  a second category map to the web. Keep modules under 500 lines; split any touched
  oversized source by responsibility while preserving its contract.

## 5. Proposed persistence

Use `connectors`, a dedicated site-owned PostgreSQL resource, not a generic Records
collection or one row per catalogue app. Gmail is a toolkit; a site's sales Gmail
account is a connector. This replaces the previously proposed connection table,
not a second parallel store. Detailed constraints/grants live in the [access model](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/CONNECTORS_ACCESS_MODEL.md).
Names remain proposed: inspect schema and author forward-only migrations in the
canonical [database repository](/Users/prado/Desktop/Proyectos/Uncodie/Code/makinari-db-scheme/README.md),
with consumer copies/types and isolated SQL/RLS validation before rollout.

| Record | Minimum responsibility |
| --- | --- |
| `site_connector_providers` | Site/provider, exact secret reference, trusted provider-project identity, stable provider user ID, credential revision and configuration status. No raw key in the projection. |
| `connectors` | Site-owned account ID, provider/toolkit/account/auth-config references, safe display identity, provider state, local enabled/revocation intent, granted scopes, creator, revision and verification timestamps. |
| `connector_members` / `connector_agents` | Same-site member view/use and agent-use overrides (explicit grants on legacy accounts), grantor and expiry/revocation; relational rows, not JSON ID arrays. |
| `connector_policies` / `connector_delegations` | Reviewed operation/resource/host restrictions and approvals; separately scoped, expiring and revocable background execution authority. |
| `site_connector_auth_attempts` | Site, initiating actor/session, toolkit, provider correlation, credential revision, hashed nonce, expiry, claim state and resulting connector ID. Sensitive fields stay server-only. |
| `site_connector_skill_bindings` | Manager-reviewed links to site custom skills; site/toolkit/domain/skill identity and revision. Relevance only, never execution rights. |

Catalogue metadata is an adapter/cache concern, not thousands of connector rows.
Private/custom toolkits remain isolated by project and credential revision. Prevent
duplicate provider account adoption across sites in the verified provider project.
Keep multiple accounts separate; choose an explicitly authorized account/default,
never an implicit first/latest/SDK-selected primary. Selecting an account cannot grant access.

RLS, same-site foreign keys, unique grants and atomic revision checks protect the
resource. Managers administer it; members see only granted account summaries and
their effective access. OAuth state, grants and delegations are not browser-writable.
Preserve site-license, screen and location restrictions; never project raw secrets.

Reuse host operation receipts for external execution/recovery, adding provider,
toolkit, action, schema version, local account ID and safe provider request ID.
If that store cannot cover non-instance hosts, design its extension first rather
than inventing a second execution/billing ledger. Never persist raw tokens, OAuth
return URLs, sensitive tool arguments or provider payloads in audit logs.

## 6. OAuth and synchronization

1. Manager selects a supported auth method. Backend authorizes site/screen and
   records an expiring attempt before opening a provider flow.
2. Resolve the site's stored provider user ID server-side. Preserve verified
   legacy `user_id = siteId` namespaces; never adopt a global `default` identity.
   OAuth initiation also binds the authenticated human actor/session separately.
3. Create a trusted Connect Link with a fixed allowlisted return destination.
   Prefer redirect; popup support follows existing synchronous-window/continue-link
   conventions and must work when the popup is blocked or closed.
4. Use Composio's callback identity verifier/`complete_auth` where supported and
   configured. Reauthenticate the returning actor, match the exact attempt and
   provider request, and verify project, toolkit, account and provider identity.
   An opaque `session_uri` is not an outbound fetch URL. Never guess its project
   from a query parameter or pick the browser's latest pending attempt.
5. Atomically persist a verified `ACTIVE` account and completed attempt. Callback
   duplicates return the existing result; replay cannot bind a different account.
   Connection setup does not itself widen host/agent execution policy.
6. Refresh the UI from the server. Bounded polling/reconciliation handles pending
   state and missed redirects; callbacks/events never supply authoritative status.

P0 must verify exact attempt correlation and callback-verifier support on a BYOK
project, including multiple tabs, another returning user and lost responses after
single-use `complete_auth`. If this cannot be proved, do not ship onboarding with
an insecure `status=success` fallback. A webhook can reconcile previously owned
accounts but cannot replace required human callback identity verification.

Reconcile only accounts owned by the site's verified provider namespace. Existing
dashboard-connected accounts need explicit reviewed adoption, never a project-wide
import. Paginate completely before interpreting absence; 429, timeout or a partial
page cannot mark accounts revoked. Unknown remains unknown, not connected.

Disconnect first blocks local execution, then attempts provider revocation. Keep
`revocation_pending` on uncertainty, retry/reconcile safely, and retain audit
history. Late OAuth callbacks cannot undo local disable/revocation intent. Key
rotation retires sessions/caches and requires revalidation; a different provider
project cannot inherit the previous project's account references.

## 7. Category-to-skill architecture

Maintain a reviewed, versioned registry in the API with:

- Stable Makinari `domain_id`, label, search aliases and compatible router categories.
- Provider category aliases and curated toolkit/tool overrides; many-to-many links.
- Relevant bundled skill slugs, optional site skill bindings and coverage status.
- Mapping provenance/version, separate from executable action policy.

Do not overload skill frontmatter `types`: those filter requirement kinds
(`task`, `integration`, `develop`, etc.), not business domains. Preserve the router's
existing broad categories and add a `domain` filter, rather than silently changing
the meaning of `crm`, `infra`, `commerce` or existing native tools.

Tool overrides take precedence over toolkit/category defaults. Gmail can support
communication and sales, but every Gmail tool is not automatically a CRM tool.
New/unknown provider categories appear as unmapped catalogue entries pending
review; never map everything to `other` and execute it anyway. UI Related skills,
skill search hints and tool search consume the same registry projection/version.

### Initial domain mapping

Existing skills below are relevant only within their documented scope. Proposed
skills are explicit backlog items, not existing callable procedures. A provider
category can be browsable before its operational skill and action policy are ready.

| Catalogue domain | Existing relevant skills | Scope/gap to address |
| --- | --- | --- |
| Artificial Intelligence | `ai-media-generation` | Media only; paid Instant/provider operations require separate policy. |
| Sales & CRM | `connector-crm-operations`, `makinari-outbound-campaign` | CRM connector procedure implemented locally for reviewed reads; writes/sync remain gated. Outbound is not a generic CRM procedure. |
| Marketing | `ads-meta-google`, `marketing-seo-gtm`, `website-seo`, `makinari-outbound-campaign` | Link by task: ads vs SEO vs campaign; preserve native campaign/channel controls. |
| Communication | `connector-messaging`, `makinari-rol-content`, `makinari-outbound-campaign` | Connector procedure implemented locally for reviewed Gmail reads; sending/Slack/Teams remain gated. Native skills keep their narrower scope. |
| Productivity & Projects | `makinari-obj-workflow-designer`, `automations-n8n-zapier` | Automation design only; proposed `connector-project-operations` for external issues/tasks. |
| Calendar (cross-cutting) | `makinari-commerce` for native bookings | Proposed `connector-calendar` for Google/Outlook scheduling, timezones and attendees; not a substitute for paid reservations. |
| Content & Files | `makinari-rol-content`, `technical-copywriting`, `file-delivery` | Native text delivery is not Drive sharing; use proposed `connector-files` for external documents/storage. |
| Commerce & Payments | `makinari-commerce` | Preserve checkout/payment/entitlement invariants; external payment actions need explicit reviewed procedures, not generic execution. |
| Customer Support | No dedicated bundled ticket-operations skill | Proposed `connector-support` for ticket ownership, PII, replies and escalation; a Customer Support agent role is not a skill slug. |
| Developer Tools | `makinari-rol-backend`, `makinari-rol-devops`, `qa-jest-testing` | Development-specific; publish/deploy/merge are separate explicit permissions. |
| Data & Analytics | `marketing-seo-gtm`, `ads-meta-google` | Marketing analytics only; proposed `connector-data-analysis` for general BI, exports and sensitive datasets. |
| Databases & Storage | `makinari-obj-apps-supabase`, `file-delivery` | Both have narrow native contracts; proposed `connector-files` covers storage, not arbitrary SQL/platform administration. |
| HR & Recruiting | No dedicated bundled HR operations skill | Proposed `connector-hr`; `makinari-expenses` records salary costs, not HRIS access or payroll execution. |
| Finance & Accounting | `makinari-expenses`, `makinari-purchases` | Native expense/AP records only; proposed `connector-accounting` for external reconciliation. No implicit fund movement. |
| IT & Security | `makinari-rol-devops`, `makinari-rol-backend` | Infrastructure development only; proposed `connector-security-operations` for reviewed IAM/incident procedures. |
| Procurement (cross-cutting) | `makinari-procurement` | External supplier data cannot bypass approval-controlled procurement transitions. |

Validate bundled links against the actual SkillsService catalogue, not frontend
workflow skill enums. Site custom bindings must resolve within that site, exclude
disabled/deleted skills, and cannot shadow system skills or change execution policy.

### Skill discovery changes

- Enrich the authorized, requirement-type-filtered skill metadata with reviewed
  registry aliases for keyword/vector ranking. Do not embed account PII or secrets.
  Expand short domain aliases such as `HR` before keyword tokenization; the current
  tokenizer drops that term. Unknown domains must not produce fabricated skill hits.
- `skill_lookup search/list` adds compact domain/related-connector summaries only
  after connector-specific access checks; loading Skills alone does not grant these.
- `get` keeps the original procedure and returns a separate bounded capability
  appendix with relevant tool references and host availability. No schema dump,
  remote session creation, mutation or fabricated tool availability.
- Required-skill snapshots retain procedure/version semantics. Their connector
  appendix is resolved against current host policy, not frozen as an access grant.
- Narrow existing skills get explicit connector sections only for compatible
  tasks; do not redirect a native-only procedure into unrelated provider actions.

## 8. Lazy tools integration and execution contract

Extend the existing router with a provider resolver; retain static native routing.
Proposed internal interfaces are `search(context, filters)`, `describe(context,
toolRef, accountRef)` and `execute(context, descriptor, arguments, operationId)`.
Context is host-owned: actor, site, host mode, agent/run and verified delegation.

1. Resolve permitted connected toolkits/domains before provider discovery. Native
   Makinari tools retain preference for native entities; an explicit external target
   ranks that connector, never silently substitutes a different backend.
2. Search merges bounded native results and provider candidates. Initial budgets:
   up to three selected toolkits, five provider candidates and ten final results;
   expose truncation/pagination. Apply category/domain/skill filters to search too.
3. `list` remains compact. Domain-specific listing exposes bounded approved tool
   metadata; a root inventory can return toolkit summaries with `kind=connector`
   and a next-search hint. Do not pretend toolkit summaries are executable tools.
4. Return concrete namespaced references such as `composio:gmail:<tool-slug>` with
   provider/domain/skill metadata, availability and `requires_describe`. Provider
   slugs are resolved from the real catalogue, never generated from natural language.
5. `describe` loads one pinned, bounded schema and accounts authorized for the actor.
   Keep the router's JSON-string `args` contract for Gemini compatibility. A result
   without a complete validated schema cannot claim it is ready to call directly.
6. `call` independently resolves and revalidates the reference/version/account;
   previous search output is not authorization and an in-memory cache is not the
   cross-turn source of truth. Account bindings survive restarts through durable
   references, but permissions and provider status are checked again.
7. Preserve host decoration, cancellation, effect/approval checks and recovery
   tracking for lazy tools; resolving after those wrappers must not bypass them.
   Unknown actions/effects are denied or require review, never assumed read-only.
8. Execute exactly one approved operation against the chosen account. Validate
   arguments without weakening provider schemas; if the current validation stack
   cannot safely represent a schema, mark it unsupported rather than adding a
   permissive validator. Never accept model-supplied tenant IDs/credential overrides.

Use stable descriptor IDs/version hashes when schemas are too large for a response.
Cache catalogue/schema metadata by provider project, credential revision, toolkit,
schema and mapping version. Authorization is fresh, never a positive cached grant.
Provider failures preserve native results with an explicit partial/unavailable
marker; they never trigger unrestricted Composio discovery or default credentials.

Structured errors distinguish auth required, access denied, host disabled, schema
changed, upstream unavailable and outcome unknown. Preserve fatal host errors.
Only a proven pre-dispatch failure can say `executed=false`; timeout after dispatch
cannot. Do not replay ambiguous external writes or change arguments to evade a
duplicate-effect guard. Record receipts and require evidence-based reconciliation.

## 9. Host and authorization policy

| Host | Current path / proposed rollout |
| --- | --- |
| Interactive assistant | First host for account-scoped member and agent permissions; both are checked before dispatch. |
| Ordinary workflow robot steps | Reuse assistant context/turn and can already receive Composio. Adopt the same resolver with fresh run-owner/delegation, dry-run and effect guards. |
| Workflow tool selector | Uses generic definitions and static category membership; not the live tenant inventory. Add an authenticated scoped projection without exposing accounts on the old generic endpoint. |
| Requirement/recovery/publish-bound modes | Respect existing pre-router restrictions. Read-only recovery, pre-response and bound publishing must not gain alternative connector mutation paths. |
| Legacy cron / MCP server | Use the synchronous catalogue; no automatic Composio injection. Add explicit async host integration later, not a silent global change. |
| Customer support / voice | Fixed catalogues include skills but not the generic connector router. Off in v1; later require narrow delegated accounts/actions, caller identity and dedicated tests. |

Setup, grant and policy management remain owner/admin-only; management is not an
implicit provider-use grant. Interactive execution intersects current site access,
effective member and agent permissions, operation/host policy, approval,
account state and OAuth scopes. Only eligible members of workspace-mode accounts inherit access
without a grant row; direct-human mode is host-owned.
Background work needs a scoped, revocable delegation and fresh accountable-principal
and agent checks; no missing user, public caller or service key becomes a manager.

Dynamic references resolve to a reviewed gateway policy plus exact action policy;
unmapped native names still fail closed. Skills, provider categories and claimed
`read_only` tags never grant access. Require connector screen permission and the
applicable business resource/operation restrictions. Do not allow connectors to
bypass native payments, procurement, privacy, location or publish-destination rules.

## 10. Billing, security and operational limits

- BYOK takes precedence; the November 19 repair approval explicitly adds the
  server platform key when BYOK is absent. Never fall back on credential errors,
  share a `default` account, charge users for connections, or change plan entitlements.
- Display provider billing mode and setup/usage warnings. A Composio project API
  key is not an OAuth app credential. Managed apps, own apps and Instant differ.
- Do not hardcode prices from the screenshot or this discussion. Link current
  [Platform pricing](https://composio.dev/pricing/platform); existing accounts may
  have grandfathered terms. Keep provider charges distinct from host/model credits.
- No paid health checks, message sends or resource mutations during catalogue,
  skill or OAuth verification. Instant and automatic paid-tool enabling are off.
- Untrusted descriptions/results remain data, not instructions. Redact and bound
  model-visible results. Unknown effects, arbitrary SQL, shell/proxy targets and
  local file paths are not generic connector capabilities.
- Explicitly staged, authorized assets are required for file tools. Apply SSRF
  controls to any separately approved remote fetch; do not revive SDK local reads.
- Metrics: provider latency/errors, auth completion/unknown outcomes, mapping gaps,
  discovery relevance, native-vs-connector results, permission denials and revoked
  account attempts. No credentials, full payloads or personal account labels in logs.

## 11. Implementation sequence and release gates

| Phase | Deliverable | Exit gate |
| --- | --- | --- |
| P0 — contracts and safety | Verify v3.1 scoped sessions, exact account/version execution, callback correlation, supported auth methods and BYOK project identity. Inventory legacy aliases/SDK callers and existing provider namespaces. | Contract tests + explicitly authorized disposable provider checks; no insecure fallback. |
| P1 — domain foundation | Registry, category coverage/gaps, relevant skill updates; `connectors`, member/agent grants, policies and hardened secret/access boundaries. | Registry resolves; same-site constraints and SQL/RLS tested; mapping grants no rights. |
| P2 — Connectors UI and lifecycle | Native shell, catalogue/detail, OAuth/supported auth methods, accounts, Access editor, reconnect/revoke and Related skills. | Persistence, per-account visibility, concurrent grants and unknown-outcome UX proven. |
| P3 — discoverable capabilities | Common lazy resolver, enriched skill lookup, scoped sessions and compatibility facade using the same grant/policy intersection. | Domain search finds concrete external tools; member-only or agent-only grants cannot bypass checks. |
| P4 — workflow parity | Scoped selector, ordinary workflow host, durable connector/delegation references and effect/approval/recovery parity. | Revocation/expiry stops subsequent dispatch; stale manifests and restricted modes cannot widen access. |
| P5 — controlled rollout | Enable approved sites/toolkits/actions with metrics and kill switches; document auth setup and adoption requirements. | Explicit migration/deployment/provider approval and live acceptance evidence. |

P2 alone is not completion of the requested feature: skill-aware discovery and
execution parity are required. Roll out discovery and execution flags separately;
rollback disables new dispatch but retains accounts/attempt receipts and recovery.
Never restore the unsafe legacy execution path as a rollback strategy.

### Acceptance matrix

- UI: root/detail shell, TopBar portal, sticky offsets, mobile/keyboard navigation,
  intersecting URL filters, accurate counts, loading/empty/error states and site swaps.
- Auth: missing identity, non-manager mutation, blocked screen, cross-site account,
  revoked membership, restricted location and spoofed actor all denied server-side.
- Grants: member AND agent access required; view-only/manager status is not use;
  hidden accounts/counts stay hidden; expired delegations and revoked grants deny.
- OAuth: success, denial, expiry, popup block, wrong returning user, concurrent tabs,
  duplicate callback, lost completion response and late callback after disconnect.
- Storage: duplicate/concurrent account adoption, credential rotation/project change,
  multiple accounts, partial sync and provider outage cannot create false readiness.
- Discovery: CRM intent returns reviewed external CRM tools; messaging intent finds
  the selected Slack/Gmail account; calendar does not become checkout; finance does
  not become payment execution. Native searches and required-skill semantics survive.
- Mapping: every provider category has a reviewed mapping or explicit gap; existing
  skill slugs resolve; custom/disabled/cross-site skills cannot alter access.
- Runtime: no eager schemas/session creation, bounded search, schema drift failure,
  concurrent site-key isolation, exact account dispatch, malicious file/URL rejection,
  safe fallback and provider failure with useful native results.
- Hosts: actual interactive and workflow paths, restricted publish/recovery/dry-run,
  selector auth, and voice/legacy hosts remaining off until separately supported.
- Recovery/billing: no duplicate external write after timeout; effect state and
  receipts remain honest; no new provider charge from simply browsing or loading skills.

Use Jest for unit/regression and contract tests. Test RLS on disposable PostgreSQL
with non-privileged identities, not SQL text alone. Browser/provider acceptance
requires an explicit isolated target and approved effects/costs; mocks prove neither
OAuth interoperability nor production readiness. No production build is required
for this design change.

## 12. Scope defaults and approval points

Recommended defaults: new Automation screen; configuration remains in Integrations;
BYOK-first with approved server platform fallback; site-owned `connectors`; managers administer; explicit member/agent use;
many-to-many reviewed mappings; native-first routing; missing operational skills
are authored by domain; support/voice, Shared, custom MCP and paid Instant deferred.

Approve or change these defaults before implementation. Schema names, REST method
details and provider callback setup are contract-validation tasks, not settled
facts merely because this document proposes them. Do not promise immediate coverage
of every catalogue action: connection, skill and reviewed policy readiness are
independent release gates.

### External references and evidence limits

- [Composio toolkits](https://docs.composio.dev/reference/api-reference/toolkits)
- [Connected accounts](https://docs.composio.dev/reference/api-reference/connected-accounts/getConnectedAccounts)
- [Callback identity verification](https://docs.composio.dev/reference/api-reference/connected-accounts/postConnectedAccountsCompleteAuth)
- [Scoped sessions](https://docs.composio.dev/docs/configuring-sessions)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

This proposal is based on local source and current public documentation. No customer
connections, production schema, provider account configuration or live execution
were inspected or changed. The API had pre-existing changes in two assistant tests;
their unrelated edits were preserved during implementation.

Documentation validation covers local source/companion links, bundled skill
slugs, Markdown fences, index entries, whitespace and the under-500-line budget.
The initial architecture had UI/runtime source and independent consistency reviews;
the connector-resource/access refinement is documented separately, not live-tested.
See the implementation guide for current test evidence; no live OAuth is claimed.