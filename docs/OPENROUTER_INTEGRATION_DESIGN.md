# OpenRouter integration: discovery, routing, and customer-funded usage

Status: target integration design; optional connection/configuration, automatic selection, media adapters and durable routing implemented locally. Deployment and real-provider acceptance remain gated. See [implementation checkpoint](OPENROUTER_BYOK_IMPLEMENTATION.md).
Review date: 2026-11-11.
Scope: Makinari web application and its separate orchestration API repository.

Historical rollback decision: restore Azure-only global images; no live OpenRouter image probe
succeeded. Customer connections, the card, manual policy and trusted runtime support now have local implementation; full execution coverage and activation remain pending. OpenRouter images are a required integration deliverable, but require a
successful real generation on the actual connection before task enablement.
Catalog presence or an AI recommendation is insufficient. See the
[experiment and acceptance gate](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/docs/OPENROUTER_IMAGES.md).

## 1. Executive summary

Add an OpenRouter card to Integrations. A site manager connects a customer-owned
OpenRouter account using OAuth PKCE or an API key. The backend discovers the
account-filtered model catalog, recommends routes with AI, validates compatibility,
and publishes a versioned capability policy. Users can override models manually.

The card includes **Refresh capabilities**, capability status, selected models,
selection reasons, and the last successful update. Refresh must preserve manual
choices and running executions.

Every request actually dispatched with this customer connection requires **zero
Makinari inference credits**: no platform balance gate, reservation, deduction,
or inference markup. This is not an exemption for unrelated paid tools or resources.

New models using supported protocols can be discovered without a release.
New protocols, tool semantics, or capabilities still require engineering work.

### Agreed dual-path scope

Preserve current global execution, providers, credentials, and billing without a
selected customer integration. This is not a global OpenRouter migration.
With an active integration, support model selection and execution through it,
including direct-provider images, speech, and transcription. Compatible adapters
are required deliverables; document upstream blockers without silent global fallback.

## 2. Agreed requirements and proposed defaults

### Requested behavior

- OpenRouter appears in the Integrations card list and navigation.
- Model discovery and routing decisions belong to the backend, not the browser.
- AI recommends models from the discovered catalog, including per-vendor choices.
- Only compatible, implemented capabilities are routable through this connection.
- The integration reports available capabilities and reasons for unavailable ones.
- A refresh button reruns discovery and updates recommendations when necessary.
- Users can manually select models instead of accepting automatic recommendations.
- Customer-funded OpenRouter operations do not require Makinari credits.
- Preserve existing global routes and billing for executions without the integration.
- Deliver customer-connection adapters for all inventoried AI functions supported
  by OpenRouter, including direct-provider media; expose compatible model selection.

### Recommended defaults, subject to review

- One shared connection per site; owner/admin manages it.
- Connecting explicitly authorizes site agents, members with execution permission,
  scheduled work, and delegated subagents to spend through that connection.
- Automatic selection prioritizes task quality, then reliability, within configured
  cost and provider constraints. It does not equate price or recency with quality.
- Cross-vendor fallback is opt-in; fallback to Makinari funding is not in v1.
- Manual selections are strict pins unless the manager selects explicit fallbacks.
- Paid setup inference and verification require disclosed consent and a budget.
- Catalog refresh is automatic on stale use and available manually; no scheduler
  or recurring paid task is created as part of this design document.

## 3. Existing implementation and gaps

Evidence refers to local source, not production configuration or deployment state.

| Boundary | Source | Finding |
| --- | --- | --- |
| Integration UI | [page](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/integrations/page.tsx) | Existing card/navigation pattern; no OpenRouter card |
| Generic credentials | [secrets route](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/api/secrets/route.ts) | Site-scoped secrets exist, but generic retrieval and fallback encryption configuration must not be inherited |
| OpenRouter client | [client](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/lib/services/ai/openrouter.ts) | Accepts explicit server-resolved key; otherwise uses global environment key; no shared singleton |
| Model resolution | Same client module | Global chat default and legacy-name normalization, not per-connection capability discovery |
| Assistant admission | [route](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/app/api/robots/instance/assistant/route.ts) | Checks Makinari credits before starting work |
| Generation settlement | [usage billing](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/lib/services/billing/openrouter-usage-billing.ts) | Calls platform billing RPC for accepted generations |
| Pricing | [pricing](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/lib/services/billing/agent-pricing.ts) | Current platform-funded OpenRouter charge uses a 1.25 multiplier |
| Requirement holds | [requirement billing](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/app/api/robots/instance/assistant/requirement-billing.ts) | Reserves, dispatches, and settles model credit holds |
| Main execution | [executor](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/lib/custom-automation/ai-agent-executor.ts) | Key injection exists; billing and helper calls need payer propagation |
| Legacy execution | [connector](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/lib/agentbase/services/PortkeyConnector.ts) | Uses OpenRouter despite its legacy name; separate settlement path |
| Embeddings | [service](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/lib/services/embeddings-service.ts) | Uses OpenRouter without a site-specific credential argument today |
| Media boundaries | [source-contract tests](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/lib/services/ai/__tests__/openrouter-only-routing.test.ts) | Images, speech, and transcription use Azure directly; experimental OpenRouter image path withdrawn |

Do not remove only the initial credit check: later reservations and settlement
would still reject or charge customer-funded work. Do not patch only the main
executor: summaries, planners, legacy agents, and media paths can retain global keys.

## 4. Product and billing terminology

- **Gateway:** OpenRouter.
- **Model vendor:** model family author, such as OpenAI or Anthropic.
- **Inference provider:** the endpoint operator serving a model through OpenRouter.
- **Customer connection:** an OpenRouter credential authorized for this site.
- **Provider BYOK:** provider keys configured inside the customer's OpenRouter account.
- **Payer:** customer connection or Makinari; determined by trusted dispatch context.

Customer OpenRouter credits and provider BYOK are both customer-funded modes.
The application does not need to collect the customer's OpenAI/Anthropic keys.

Subscription-included API grants are distinct from native Claude Code or Codex
subscription quotas. Provider grants may cover eligible API usage, subject to
their own terms. Do not promise that OpenRouter can discover the remaining grant
balance, distinguish grants from purchased funds, or guarantee grant eligibility.
No Claude/ChatGPT session-token collection is part of this integration.

## 5. Card and manual model-selection UX

### Main card

- Connection status, masked credential identity, and site-sharing disclosure.
- **Connect OpenRouter**, **Use API key**, **Replace key**, and **Disconnect**.
- **Refresh capabilities** with an updating state and last-successful timestamp.
- Summary counts: ready, unverified, unavailable, and unsupported capabilities.
- **Manage models** opens capability-level settings using existing UI components.
- Billing notice: "AI usage is billed to your OpenRouter account. Other paid
  services may require Makinari credits."

### Per-capability controls

Each row shows capability, routing mode, selected model, vendor, fallback policy,
compatibility evidence, last verification, and selection/unavailability reason.

Routing modes:

1. **Automatic:** use the backend's validated recommendation.
2. **Manual:** select an exact catalog model and optional ordered fallbacks.
3. **Disabled:** do not route this capability through this connection.

Disabled blocks the customer route without enabling global fallback; model selection must affect dispatch.

Manual model search filters by the account catalog and the capability contract.
Show context, supported modalities/tools, and catalog pricing where available.
Pricing is informational, not proof of net BYOK cost or subscription credits.
Models with missing evidence may be shown as unverified, not as confirmed ready.
An optional unavailable-model view explains why an existing choice cannot run.
Do not accept arbitrary provider URLs or silently normalize a manual pin to a
different model. Explicit aliases must be labeled as movable, not exact pins.

Saving is validated server-side against the latest relevant catalog, connection,
and configuration revision. An outdated revision returns a conflict for review.
**Reset to automatic** removes only the chosen capability override.
Refresh may update the recommendation beside a pin, but cannot overwrite the pin.
If a pinned model disappears, preserve it as unavailable until the user changes
it or an explicitly configured compatible fallback is used.

### Refresh behavior

- One active refresh per site/connection, deduplicated across tabs and workers.
- Keep current configuration usable while discovering a candidate update.
- Report models changed, capabilities added/removed, and unchanged manual choices.
- Publish only a validated snapshot, using an atomic revision check.
- If preferences change, credentials rotate, or disconnect occurs during refresh,
  reject the stale result instead of restoring old settings or authorization.
- Failure preserves the last valid snapshot; show its age and refresh error.
- Distinguish complete catalog removal from a timeout or partial catalog response.
- No paid verification of every catalog model on each click.

## 6. Backend discovery and AI-assisted selection

### Discovery inputs

Use authenticated `GET https://openrouter.ai/api/v1/key` for key metadata and
`GET https://openrouter.ai/api/v1/models/user?output_modalities=all` for models
filtered by account provider preferences, privacy settings, and guardrails.
The default user catalog is text-output only, so request modalities explicitly.

Normalize bounded fields: canonical IDs, modalities, supported parameters,
context/output limits, prices, lifecycle information, and available benchmark
evidence. Check endpoint-specific constraints when required by a capability.
Catalog membership alone does not prove upstream BYOK permissions, funding,
availability, or support for every parameter at every serving endpoint.

### Stable capability contracts

Maintain requirements by task type rather than lists of release-specific names:

| Capability | Hard requirements and boundaries |
| --- | --- |
| Text conversation | Implemented text transport, required context and output |
| Tool-using agent | Supported tool-call format and runtime tool permissions |
| Structured extraction | Compatible output schema and validation path |
| Code/reasoning | Compatible agent interface; quality assessed separately from tool support |
| Vision | Required image input and text/tool output supported together |
| Summaries/compaction | Text support and adequate context; inherits payer |
| Embeddings | Existing embedding space, dimensions, and index contract preserved |
| Video | Implemented job lifecycle, polling, and artifact handling |
| Images | Required customer-connection adapter plus successful real generation before enablement; preserve Azure for global execution |
| Speech/transcription | Required customer-connection adapters, compatible model/voice/language contracts, and artifact handling; preserve global execution |

Application task availability is the intersection of required capabilities,
implemented adapters, authorized tools, connection policy, and resource rights.
An unsupported optional tool need not disable a whole agent; an essential missing
capability blocks the affected task before execution. Non-LLM tools keep their
own authorization and funding checks.

### Selection pipeline

1. Authenticate the actor and resolve site, connection, and allowed policy.
2. Fetch and normalize catalog data with bounded size/time and private caching.
3. Apply deterministic hard compatibility, cost, and provider filters.
4. Choose a bootstrap inference model deterministically from eligible text models.
5. Ask it to rank a bounded shortlist per capability/vendor and choose primary
   and fallback IDs, with evidence-based reasons and uncertainty.
6. Validate structured output: only supplied IDs, bounded fields, known capabilities,
   permitted vendors/endpoints, compatible fallbacks, and unchanged payer.
7. Merge automatic recommendations with manual overrides and disabled settings.
8. Optionally run budgeted synthetic verification, then atomically publish.

The selection model receives no keys, customer prompts, or business records.
Catalog descriptions are untrusted data, never executable instructions. The
selector has no business tools, arbitrary network access, or permission to change
billing, adapters, endpoints, or access controls. Validate its explanation against
the supplied evidence; do not market the output as an objective best-model guarantee.

Cache by catalog fingerprint, capability-contract version, preferences, connection
revision, and selector version. Reuse results if these inputs did not change.
Bound tokens, attempts, time, and customer spend. If no bootstrap model is usable,
keep the valid policy or expose manual setup; do not use the platform key.

New catalog models with familiar interfaces can enter recommendations automatically.
Unknown protocols and semantics stay unsupported until reviewed adapters exist.
Embedding migrations and explicit pins never follow automatic model releases.

## 7. Capability states and verification

Keep compatibility, connectivity, and funding as separate fields, not one boolean.

| Display state | Meaning | Runtime action |
| --- | --- | --- |
| Ready | Compatible adapter/model and successful relevant verification | Allow subject to current authorization and budgets |
| Compatible, unverified | Catalog satisfies requirements; no successful probe yet | Image tasks stay disabled until an authorized probe returns a valid image; other capabilities follow their verification policy |
| Unavailable | Removed model, denied access, or no compatible candidate | Block affected route with a reason |
| Temporarily unavailable | Transient outage or rate limit | Preserve compatibility; bounded retry only when safe |
| Funding required | Provider reports exhausted balance/budget | Link to the customer's OpenRouter settings, not Makinari top-up |
| Unsupported adapter | Makinari has no compatible execution path | Do not enable based on catalog or AI claims |
| Disabled by manager | Explicit capability opt-out | Never re-enable during refresh |

Verification uses synthetic bounded inputs and inert tool definitions. Never send
messages, create VMs, modify business data, or execute model-proposed tools during
setup. Check stream terminal events and tool/schema response shape, not HTTP 200
alone. Scope evidence to the model, endpoint constraints, adapter, and key revision.
Successful verification is time-limited evidence, not a guarantee of future funds.

For images, verification is mandatory before enabling tasks, including manual
model choices. A complete success and decodable image are required; HTTP success
alone is insufficient. Verify persistence/payer attribution before application
acceptance. Reverify changed connection/model/endpoint/adapter configurations.

Automatic refresh on stale use must not put discovery inference on every request.
Use a bounded freshness policy and a shared refresh lock. Recheck authorization
before dispatch; handle newly revoked credentials even with a cached catalog.
Durable refresh execution should reuse the existing job infrastructure, not an
unawaited promise in a request handler. Exact TTLs and budgets are review decisions.

## 8. Runtime routing contract

Resolve the path server-side: no selected integration uses global behavior; an active selected integration uses its policy below.
Unavailable, disabled, revoked, or failed customer routes never imply global fallback.

Resolve once per execution, then pass a trusted routing reference to all children:
site, connection ID/revision, payer, policy version, capability contract, selected
model, allowed fallbacks, and request identity. Store references, not plaintext
credentials, in job payloads, workflow history, messages, or model context.

Recommended precedence:

1. Authorized agent-specific manual override, if that feature is enabled.
2. Site capability manual override.
3. Automatic recommendation within the selected vendor, or across allowed vendors.
4. Explicitly permitted compatible fallback under the same customer connection.
5. A typed unavailable error; never silent platform funding.

Do not expose free-form model overrides through prompts. Even an authorized manual
choice is validated against tools, modalities, context, cost limits, and permissions.
OpenRouter provider routing chooses serving endpoints; our helper selects the
task's model. Do not confuse model-vendor preference with endpoint-provider policy.

For strict provider BYOK, request restrictions and the customer's OpenRouter
shared-capacity settings must agree. `provider.only` alone does not prove BYOK;
do not infer BYOK routing from a zero cost or a vendor model prefix. If strict
BYOK cannot be verified/enforced with the available API permissions, report it
as unverified and do not promise subscription-credit-only execution.

Running executions pin their policy. Revocation/disconnect stops future dispatches;
already accepted provider work is tracked to its known outcome where possible.
Rotation requires deliberate rebinding to a validated successor credential of the
same payer or pausing; do not automatically use the global environment key.

Fallback applies only to confirmed pre-dispatch/admission failures or explicitly
safe cases. Stream interruption, timeout after dispatch, or unknown tool outcome
does not authorize replay on another model. Preserve existing retry boundaries.

## 9. Customer-funded accounting

### Mandatory invariant

The actual server-selected credential determines payer before dispatch. A browser
flag, model output, `usage.is_byok`, or reported zero cost cannot grant exemption.
All site ownership checks happen before privileged credential access.

| Operation | Makinari credit behavior |
| --- | --- |
| Model call with customer OpenRouter credential | No credit gate, hold, deduction, or 1.25 markup |
| Setup selection/probe using customer connection | Same exemption; disclosed external spend budget |
| Customer-funded auxiliary calls and subagents | Same exemption; explicit inherited routing |
| Platform-funded inference | Existing credit accounting unchanged |
| Platform-paid VM, tools, Azure media, or channels | Existing independent accounting retained |

Audit all three stages: initial admission, before-dispatch holds, and final
settlement. Do not disable CreditService globally. Replace LLM-only checks with
payer-aware checks while retaining non-monetary session/ownership/admission guards.

External usage receipts should include execution/event identity, site, connection
revision, payer, policy, requested/actual model, actual provider when returned,
tokens, gateway cost, separate upstream cost evidence, and Makinari charge = 0.
Unknown provider cost stays null, not zero. Do not sum gateway/upstream costs
without understanding overlap or estimate an invoice from catalog prices.

Write idempotent external-usage receipts independently of platform charge RPCs.
Persist dispatch identity before the call. If a receipt write fails, preserve the
outcome for reconciliation; pause further work if durable ownership cannot be
established. Never rerun accepted inference or bill Makinari to repair telemetry.
Retain existing reconciliation rules for platform-funded work.

Scope event uniqueness by connection/site and host-generated event identity;
provider generation IDs are evidence, not client-authorized ownership.
Do not retrospectively reclassify historical platform-funded charges.

Inventory must include chat, AIAgentExecutor, legacy AgentBase/connector, workflow
nodes, requirement holds, cron admission, channel agents, summaries, naming,
visual critics, embeddings, direct AI routes, video submission/polling, nested
tool inference, and account-credit notifications. System-owned probes and shared
index maintenance must remain explicitly system-funded unless valid site ownership
and customer authorization are established; never borrow a random customer's key.

Mixed-cost tasks may start with zero Makinari credits for their customer-funded
LLM steps. Before a platform-paid side effect, check/reserve only that resource's
cost and explain the blocked component. Do not claim that every agent action is free.

## 10. Persistence and API proposal

These are logical entities and proposed contracts, not existing tables or routes.
Confirm the actual shared/API database ownership before preparing migrations.

| Entity | Important fields/invariants |
| --- | --- |
| Connection | Site, creator, status, encrypted credential reference, credential revision, consent, verification time; one active per site in v1 |
| Catalog snapshot | Connection revision, fingerprint, retrieval status/time, bounded normalized models; private per account |
| Routing policy | Revision, capability-contract version, preferences, per-capability mode, pins/fallbacks, automatic recommendations |
| Refresh run | Actor, expected revisions, status, stages, bounded budget, sanitized error, candidate/published policy; one active run per connection |
| Usage receipt | Immutable payer/dispatch context, idempotent event, model/provider evidence, nullable external cost, zero platform charge |

Use append-only policy history with an atomic active pointer or equivalent revision
checks. Manual writes and refresh publication cannot clobber each other. Activation
of a new connection requires a validated policy or explicitly limited unverified
state. Disconnect increments the revision and invalidates queued publication.

Suggested same-origin UI API surface under `/api/integrations/openrouter`:

- `GET`: sanitized connection, capability summary, preferences, current revisions.
- `POST /connect`: store and validate a manually supplied key.
- `POST /oauth/start` and `GET /oauth/callback`: session-bound PKCE flow.
- `POST /refresh`: authorize/deduplicate durable discovery; return run ID.
- `GET /refresh/{id}`: site-scoped progress and diff; bounded polling.
- `GET /models`: filtered selectable catalog; never a plaintext credential response.
- `PATCH /policy`: validate automatic/manual/disabled settings with expected revision.
- `POST /verify`: opt-in budgeted synthetic capability verification.
- `POST /disconnect`: revoke local authorization and invalidate future work.

Backend owns discovery, model validation, execution routing, and usage attribution.
Web handlers own their authentication too and forward only verified identities.
Use the existing authenticated API boundary rather than creating duplicate routing
engines. A manager changes shared settings; authorized members may use approved
capabilities without reading credentials. Cron uses durable site authorization,
not a forged user ID. Return sanitized, machine-readable errors and allowlisted DTOs.

## 11. Security and operational controls

- Reuse proven private credential infrastructure only after checking encryption,
  key rotation, and RLS; no default encryption password or generic retrieve path.
- Block generic secret APIs from reading/modifying integration-owned credentials
  if the existing secret store is reused. Metadata access is not secret access.
- Fixed HTTPS OpenRouter endpoints, bounded responses/timeouts, no credential
  redirects, no browser-visible keys, and no secrets in traces or model input.
- Session-bound OAuth state/PKCE, fixed callback origin, one-time exchange, and
  actor/site revalidation at completion. Never bind a callback using site ID alone.
- Local disconnect and provider key revocation are different; clearly state what
  was completed and direct the user to provider controls when needed.
- Per-site refresh concurrency and cost caps; server-generated idempotency keys.
- Separate account catalog caches; no cross-tenant recommendation/access leakage.
- No automatic tool grants, provider permissions, privacy relaxation, or spend-limit
  increases based on AI output. Integration availability is not business permission.
- Observe connection failures, routing choices, external spend evidence, blocked
  paid tools, stale policies, and any accidental platform-key dispatch.

## 12. Implementation phases and rollout

1. **Coverage inventory:** enumerate all client creation, credit gates/holds/charges,
   auxiliary calls, and persistent jobs, including images, speech, transcription,
   and video; track global route, customer adapter, model selection, and blockers.
2. **Foundation:** approved private schema, connection CRUD/OAuth, authorization,
   key validation, revision handling, and sanitized read APIs.
3. **Discovery:** catalog normalization, capability contracts, deterministic filters,
   bounded AI selector, synthetic verification, and versioned refresh publication.
4. **Routing:** one resolver used by all execution paths, manual overrides, pinned
   run context, controlled fallback, disconnect/rotation, and zero global-key leakage;
   complete compatible direct-provider adapters while preserving global behavior.
5. **Accounting:** payer-aware admission, external receipts, requirement execution
   without monetary holds, and unchanged platform-resource billing.
6. **UI:** card, quick navigation, refresh progress/diff, model selection, reasons,
   sharing/spend consent, errors, and accessibility using existing components.
7. **Validation and pilot:** offline tests, approved isolated database checks, then
   opt-in low-budget live tests; enable per site only after coverage is complete.

Forward-only timestamped migrations; no changes to applied migrations. Deploy
compatible schema/backend before enabling frontend flows. Confirm target projects
and obtain explicit approval for remote migrations, deployments, and paid tests.
Preserve unrelated changes in both repositories. Split touched oversized modules
by responsibility without redesigning their public execution contracts.

Rollback stops new customer-funded admission; it must not make queued BYOK jobs
fall back to platform credentials. Preserve receipts/policy history and reconcile
already dispatched work under its original payer.

## 13. Acceptance and validation matrix

| Scenario | Required result |
| --- | --- |
| Customer key + zero Makinari credits | Supported LLM-only task completes; no platform holds/charges/credit emails |
| No customer connection | Existing global providers, model behavior, and billing unchanged, including media |
| Active integration + manual media model | Images, speech/transcription, and supported video dispatch through the selected customer model/connection; valid artifacts and zero platform inference charge |
| Active integration + unsupported or failed capability | Explicit blocker; no silent global provider, credential, or payer substitution |
| Malicious payer/skip-billing request | Rejected or ignored; server resolves actual payer |
| Cross-site connection or refresh ID | Denied before secret access |
| Member attempts shared policy/key change | Denied; no credential disclosure |
| OAuth replay, wrong state, changed site access | Rejected; no connection activation |
| New compatible model | Eligible without code release; policy validation still applies |
| New unsupported modality/protocol | Reported unsupported; AI cannot enable it |
| AI invents ID or attempts billing/tool change | Rejected; retain safe policy |
| Catalog description contains instructions | Treated as data; no tools or policy privilege escalation |
| Manual pin + refresh | Pin survives; recommendation can update separately |
| Manual selection incompatible or stale | Validation error/conflict; old valid policy retained |
| Manager disables capability | Refresh cannot re-enable it |
| Pinned model removed | Unavailable with explanation; no silent replacement |
| Concurrent refresh/manual save/disconnect | Stale publication rejected; one coherent revision |
| Discovery timeout/partial response | No mass disablement; stale status visible |
| No selector model or setup balance | Manual/last-valid path; no platform-key bootstrap |
| Transient rate limit | Not marked permanently incompatible; no unsafe replay |
| Customer funding exhausted | Provider-specific action; no Makinari top-up demand |
| Nested agent, summary, cron resume | Same authorized customer payer, never environment fallback |
| Disconnect during job | Future dispatch stops; accepted work keeps original attribution |
| Missing cost or receipt write failure | Null/uncertain evidence and reconciliation; no replay or platform charge |
| Paid VM/tool within BYOK workflow | Independent resource admission/charge remains enforced |
| Embedding recommendation changes | Existing index space not silently changed |
| Existing Azure media | Global path remains unchanged; verified customer image selection uses OpenRouter without replacing global Azure behavior |
| Catalog lists image model but live probe fails | Image task remains disabled with reason; no automatic Azure/account fallback |

Use Jest for web UI/API contracts and backend routing, AI, billing, and assistant
regressions. Exercise concurrent publication/receipt invariants on an approved
isolated database; source tests alone do not prove SQL behavior. Validate a real
low-budget provider request and billing evidence only with explicit authorization.
No production build, production data mutation, or deployment is implied by review.

## 14. Decisions to approve before implementation

1. Confirm shared site scope; defer personal connections and multiple accounts?
2. Allow automatic selection across vendors, or require a preferred vendor by default?
3. Confirm quality-first policy and acceptable per-request/setup spend limits.
4. Confirm refresh TTL, maximum attempts, and whether paid probes are opt-in per run
   or covered by a bounded persistent consent setting.
5. Confirm which non-image capabilities may run while unverified; images require successful live verification.
6. Expose agent-specific overrides in v1, or only per-capability integration controls?
7. Offer strict provider-BYOK mode in v1 only if enforceability can be demonstrated?
8. Confirm no platform-funded fallback and no Makinari inference markup for customer keys.
9. Confirm resource/plan entitlements remain independent of the LLM credit exemption.
10. Approve pilot scope and database ownership after checking deployed schema.

## 15. Official references and evidence limits

Reviewed during this design discussion; provider documentation can change.

- [OpenRouter OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth).
- [OpenRouter BYOK and shared-capacity fallback](https://openrouter.ai/docs/guides/overview/auth/byok).
- [Account-filtered model catalog](https://openrouter.ai/docs/api/api-reference/models/list-models-filtered-by-user-provider-preferences-privacy-settings-and-guardrails).
- [Model properties](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties).
- [Current key metadata](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key).
- [Provider routing](https://openrouter.ai/docs/guides/routing/provider-selection).
- [Claude monthly API grants](https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-ultra-and-team-plans).
- [OpenAI API grants](https://developers.openai.com/api/docs/guides/chatgpt-api-credits).

Live image experiments queried catalogs and used the locally configured OpenRouter
key: no image succeeded. MAI logs confirmed BYOK selection with 404/530 attempts,
not credential validity or resource attribution. Sunburst via OpenAI and MAI via
Azure are distinct routes. Grant deduction, remote schema, and customer integration
were not verified. Catalog/AI output is not production-readiness evidence.