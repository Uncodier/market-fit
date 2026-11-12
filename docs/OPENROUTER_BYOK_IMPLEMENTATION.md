# Optional customer OpenRouter integration

Implementation checkpoint: 2026-11-12. **Not deployed or activated.**
The engineering continuation implements automatic selection, consented image
verification, voice/transcription/video adapters and durable routing across the
inventoried active execution paths. See the
[current validation guide](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/docs/OPENROUTER_COMPLETION_VALIDATION.md).
Follow the [review repairs](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/docs/OPENROUTER_REVIEW_REPAIRS.md)
for the subsequent authorization, compatibility and recovery fixes and migrations.
The manual-only, hardcoded activation and missing-adapter statements below are
retained as a historical initial checkpoint, not the latest continuation.
The broader acceptance scope remains in
[the integration design](OPENROUTER_INTEGRATION_DESIGN.md).

## What this change provides

- An OpenRouter card and quick-navigation entry in Integrations.
- Owner/admin-only API-key connection with explicit shared-site spend consent.
- Password-only key input, cleared after submission and on site change. No key
  retrieval, browser storage, client logs, or generic secrets API integration.
- Account-filtered model discovery, capability status, manual model selection,
  refresh, rotation and confirmed disconnect.
- Revision-checked configuration and refresh that preserve manual pins. Missing
  models remain unavailable; refresh does not silently replace them.
- A same-origin authenticated web proxy with fixed backend paths, body limits,
  redirects disabled, request deadlines, safe errors and response allowlists.
- Backend encrypted connection storage, immutable versioned policies and
  customer-inference receipts, with a forward-only migration.
- Customer routing and billing support under trusted server-owned execution
  context. Runtime coverage and media acceptance are separate release gates.

The API-key flow implements the key-or-OAuth alternative. OAuth and automatic
AI recommendations are not implemented. Configuration uses manual selections;
connecting and refreshing do not perform paid selection or generation.

## Compatibility and activation

**Saving a connection does not select it for execution.** Activation is blocked
in both the backend and the publication RPC. There is no environment switch
that bypasses the coverage gate. The web UI explains the restriction and disables
the activation control. This checkpoint must not be described as completed,
production-ready BYOK execution.

Without a selected connection, existing global providers, environment keys,
model defaults and billing remain in place. Customer execution, once enabled,
must not silently fall back to global funding. Unavailable/disabled capabilities,
revocation, unsupported adapters and uncertain provider outcomes fail closed.
Independent VM, channel and tool charges are not inference-credit exemptions.

The model list is account-filtered, not evidence of valid upstream provider BYOK
credentials, external funding, subscription grants or working media generation.
Images require a successful authorized live verification on the actual
connection. No paid probe or live media generation was run for this checkpoint.
Embeddings require an explicit compatible index-space/dimensions binding.

## Repository and configuration boundaries

Web code lives in this repository:

- `app/integrations/components/OpenRouterSection.tsx`
- `app/integrations/components/OpenRouterModels.tsx`
- `app/api/integrations/openrouter/`
- `lib/integrations/openrouter-contract.ts`

The separate orchestration backend lives at
`/Users/prado/Desktop/Proyectos/Uncodie/Code/API`. Its operational contract and
runtime limitations are documented in
[the backend guide](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/docs/OPENROUTER_CUSTOMER_CONNECTIONS.md).
The [runtime coverage inventory](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/docs/OPENROUTER_RUNTIME_COVERAGE.md)
tracks entrypoint, queue, HTTP, compaction and receipt-reconciliation gaps; shared
client coverage does not imply that every caller establishes a trusted scope.
The [assistant routing checkpoint](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/docs/OPENROUTER_ASSISTANT_ROUTING.md)
documents admission, durable recovery and requirement-cron propagation.
The [media adapter inventory](/Users/prado/Desktop/Proyectos/Uncodie/Code/API/docs/OPENROUTER_CUSTOMER_MEDIA.md)
distinguishes dormant image/embedding adapters from pending speech,
transcription, video and image persistence/verification work. These missing
adapters are engineering work, not a claim that OpenRouter lacks the protocols.

The web proxy uses the existing server-configured `API_SERVER_URL` (falling back
to `NEXT_PUBLIC_API_SERVER_URL`) and forwards only the verified user's session
bearer. The backend independently authenticates and authorizes every route.

Set `OPENROUTER_CREDENTIAL_ENCRYPTION_KEY` **only on the API server** to a securely
generated base64-encoded 32-byte key. There is no default or legacy fallback.
Do not reuse a browser-visible value. Changing this encryption key without an
explicit re-encryption plan makes existing ciphertext unavailable.
Existing global `OPENROUTER_API_KEY` and Azure configuration must not be changed.

The new migration is
`supabase/migrations/20261112010000_openrouter_customer_connections.sql`.
It has not been applied remotely. Connection storage and management require it;
global execution must not depend on its availability while BYOK is inactive.
Tables deny direct browser access; server-authorized RPCs publish revisions and
receipts. Deploy compatible schema and backend before exposing connection setup.

## Validation and remaining release gates

Run web contracts without loading Next configuration or developer credentials:

```sh
npm test -- --config jest.openrouter.config.cjs --runInBand
```

Additional global UI/setup regression coverage:

```sh
npm test -- --runInBand __tests__/integrations __tests__/api/site-setup-proxy.test.ts __tests__/components/billing __tests__/app/services/site-setup-client.test.ts __tests__/app/services/site-setup-store.test.ts __tests__/app/services/billing-initialization-client.test.ts
```

The backend connection suite applies the migration to a disposable socket-only
local PostgreSQL cluster. It covers actual SQL authorization, concurrent initial
publication, refresh/save/disconnect conflicts and receipt idempotency. It does
not use a configured database URL. This is not remote migration evidence.

Before activation, complete and verify all inventoried execution entry points,
durable resume/child propagation, capability-specific routing, media artifacts,
inference admission/holds/settlement and independent resource charges. Run an
explicitly authorized low-budget live request using the intended customer key,
and reconcile provider evidence with zero Makinari inference charges. Obtain
separate approval for a target deployment and remote migration. Offline passing
tests alone cannot establish provider availability or full production safety.

### Validation checkpoint

- Web billing/setup/integration regression: 30 suites, 701 tests passed.
- Dedicated credential-free web configuration: 2 suites, 17 tests passed.
- API pre-change AI baseline: 89 suites, 1,487 tests passed.
- API post-runtime/media checkpoint: 92 suites, 1,521 tests passed.
- API billing regression: 29 suites, 375 tests passed.
- Assistant regression: 50 suites, 840 tests passed; ESM/compiler regression:
  15 suites, 249 tests passed. The real Workflow compiler confirms server-only
  routing/storage modules do not enter the deterministic workflow bundle.
- Focused media regression: 11 suites, 238 tests passed (overlaps the AI suite).
- Connection/authorization/migration regression: 5 suites, 51 tests passed,
  including disposable PostgreSQL concurrency and effective-license denial.
- API full `tsc --noEmit --incremental false` passed.
- New web modules and tests: targeted ESLint passed. The existing integration
  page has a pre-existing `react-hooks/set-state-in-effect` finding in `loadData`.
- Web `npm run typecheck` passed on the final recheck. An earlier run reported
  unrelated `Element.style` errors in a concurrently edited sticky-header test;
  that external fix was preserved, not changed as part of BYOK. Targeted new-file
  type checking also passed.

See backend guides for subsequent routing, connection and database checks.