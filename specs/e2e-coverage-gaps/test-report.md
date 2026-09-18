# Test Report: Application Coverage Gaps

**Test spec**: [test-spec.md](./test-spec.md)
**Branch / commit**: current working tree; commit not recorded
**Last updated**: 2026-09-16
**Tester**: Cursor agent

## Summary

- Overall session status: `FAIL`
- Refreshed the prior E2E-only inventory into an application-wide coverage contract spanning 135 pages, 134 route handlers, server actions, database policies, scheduled jobs, and the existing Jest/Shiplight suites.
- The inventory started with 261 authored Jest files and 55 Shiplight YAML scenarios; this session added three Jest contract files and rewrote two stale route contracts.
- Five navigation YAML scenarios were repaired so all 36 Playwright assertions are awaited; all five scenarios plus auth setup passed.
- Highest-impact gaps are private API authorization, cross-tenant/RLS enforcement, payout and Stripe transaction integrity, authentication/buyer ownership, and runtime coverage for record diagrams and embeddings.
- New contract tests confirmed ten product-security failures: anonymous secret/token access is not rejected before service-role access, ordinary authenticated users can reach payout resolution, arbitrary-site revenue requests reach a service client, and six asset-proxy allowlist bypasses are accepted.
- The isolated full Jest run remains red with 29 failed suites and 95 failed tests; non-admin/second-tenant browser fixtures also do not exist.

## Commands Run

| Command | Result | Notes |
| --- | --- | --- |
| `npm view shiplightai version` | `PASS` | Installed and latest versions are both `0.1.104` |
| `npx jest --listTests --runInBand --json` with a discovery audit | `PASS` | 264 authored `__tests__/**/*.test.*` files collected; no generated YAML specs, orphan diagnostics, or support modules collected |
| `npx jest __tests__/app/services/secure-tokens-service.test.ts --runInBand` | `PASS` | 7 tests passed after repairing imports, mocks, and current request expectations |
| `npx jest __tests__/app/utils/email-formatter.test.ts __tests__/app/utils/url-cleaning.test.ts __tests__/app/services/secure-tokens-service.test.ts --runInBand` | `PASS` | 3 suites and 46 tests passed |
| `npx jest __tests__/api/privileged-secrets-auth.test.ts __tests__/api/payout-routes-auth.test.ts __tests__/api/assets-proxy-security.test.ts __tests__/app/api/revenue/revenue.test.ts --runInBand` | `FAIL` | 4 suites ran: 5 tests passed and 10 security expectations failed against current app behavior |
| `npx shiplight transpile --strict tests/sales-navigation.test.yaml` | `PASS` | Zero warnings |
| `npx shiplight transpile --strict tests/operations-navigation.test.yaml` | `PASS` | Zero warnings |
| `npx shiplight transpile --strict tests/settings-navigation.test.yaml` | `PASS` | Zero warnings |
| `npx shiplight transpile --strict tests/finance-navigation.test.yaml` | `PASS` | Zero warnings |
| `npx shiplight transpile --strict tests/marketing-navigation.test.yaml` | `PASS` | Zero warnings |
| Focused Playwright command inside the restricted sandbox | `BLOCKED` | Chromium exited with `SIGSEGV` before auth setup; no product assertion ran |
| `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac26-arm64 TEST_BASE_URL=http://localhost:3000 npx playwright test tests/sales-navigation.yaml.spec.ts tests/operations-navigation.yaml.spec.ts tests/settings-navigation.yaml.spec.ts tests/finance-navigation.yaml.spec.ts tests/marketing-navigation.yaml.spec.ts --project=admin --workers=1` | `PASS` | Auth setup plus five scenarios passed in 6.1 minutes; 36 repaired assertions executed |
| `npm test -- --runInBand` | `FAIL` | 235 suites passed and 29 failed; 1,620 tests passed and 95 failed |

## Tests Added Or Updated

| Type | Files | Tests |
| --- | ---: | ---: |
| Unit | 4 | 77 |
| Contract | 5 | 16 |
| Integration | 0 | 0 |
| E2E | 5 | 5 |
| Agent | 0 | 0 |
| Script / static | 1 | 1 |
| **Total** | **15** | **99** |

### File List

- `__tests__/api/privileged-secrets-auth.test.ts` (2 contract tests)
- `__tests__/api/payout-routes-auth.test.ts` (4 contract tests)
- `__tests__/api/assets-proxy-security.test.ts` (7 contract tests)
- `__tests__/app/api/revenue/revenue.test.ts` (2 rewritten contract tests)
- `__tests__/api/workflows/webhook.test.ts` (1 rewritten static contract)
- `__tests__/app/services/secure-tokens-service.test.ts` (7 repaired unit tests)
- `__tests__/app/utils/email-formatter.test.ts`, `text-cleaning.test.ts`, `url-cleaning.test.ts` (70 existing tests made discoverable through corrected imports)
- Five navigation YAML files (5 scenarios; 36 assertions corrected)
- `jest.config.js` (Jest-only discovery boundary)
- Coverage artifacts updated: `specs/e2e-coverage-gaps/test-spec.md`, `specs/e2e-coverage-gaps/test-report.md`.

## Coverage Matrix

| Behavior | Priority | Test type | Coverage | Session result | Notes / gap |
| --- | --- | --- | --- | --- | --- |
| Previously uncovered admin routes render | UNKNOWN | e2e | COVERED | PASS | Safe route and mode coverage |
| Invalid manual check-in remains recoverable | UNKNOWN | e2e | COVERED | PASS | Invalid-code path remains usable |
| Context sections render and switch | UNKNOWN | e2e | COVERED | PASS | All current tabs covered |
| Security sections render and switch | UNKNOWN | e2e | PARTIAL | PASS | Does not mutate credentials or access |
| Skills can be read and expanded | UNKNOWN | e2e | COVERED | PASS | Clipboard write intentionally not required |
| All reporting routes render | UNKNOWN | e2e | COVERED | PASS | Six report tabs covered |
| Buyer workspace routes render | UNKNOWN | e2e | PARTIAL | PASS | Entitlement-specific detail routes need fixtures |
| Accounting and payment read controls work | UNKNOWN | e2e | PARTIAL | PASS | No financial mutation performed |
| Public marketplace, storefront and empty checkout render | UNKNOWN | e2e | PARTIAL | PASS | Paid checkout and booking are covered separately or quarantined |
| Blocked platform administration route rejects access | UNKNOWN | e2e | COVERED | PASS | `/admin/payouts` returns 404 through middleware |
| Sales Home and Activities settings render | UNKNOWN | e2e | COVERED | PASS | Closes the remaining two formal-navigation route gaps |
| Role-based access matrix | UNKNOWN | e2e | BLOCKED | BLOCKED | Missing non-admin auth projects/storage states |
| Cross-tenant access denial | UNKNOWN | integration, e2e | BLOCKED | BLOCKED | Missing controlled second-tenant fixture |
| Jest discovery and module integrity | UNKNOWN | static, unit | PARTIAL | FAIL | Discovery is isolated and stale imports were repaired; unrelated existing behavior/configuration failures remain |
| Private API and server-action authorization | UNKNOWN | contract, integration | PARTIAL | FAIL | Seven high-risk handlers gained direct contracts; most private boundaries remain untested and current auth expectations fail |
| Live RLS role matrix | UNKNOWN | integration | BLOCKED | BLOCKED | Requires a freshly migrated disposable database, all four site roles, buyer/anonymous identities, and a second tenant |
| Payout authorization and atomicity | UNKNOWN | contract, integration | PARTIAL | FAIL | Negative request checks pass; ordinary-user resolution denial fails; transaction/concurrency proof is absent |
| Stripe and commerce state consistency | UNKNOWN | contract, integration, agent | PARTIAL | NOT RUN | Helper tests exist, but the route/webhook and cross-layer persisted state are not proven |
| Authentication, invitations, and buyer ownership | UNKNOWN | contract, e2e | PARTIAL | NOT RUN | Redirect/helper coverage exists; endpoint lifecycle and real buyer ownership do not |
| Public document token lifecycle | UNKNOWN | contract, e2e | PARTIAL | NOT RUN | Helper tests exist; valid/expired/revoked browser and boundary matrix is missing |
| Record diagram persistence and embedding lifecycle | UNKNOWN | unit, contract, integration, e2e | PARTIAL | NOT RUN | Unit/mock/static SQL coverage exists; live migrations, RLS, persistence, concurrency, and cron paths do not |
| Declared P0 CRUD completeness | P0 | e2e | PARTIAL | NOT RUN | Existing P0 scenarios omit several update/delete/cleanup paths |
| Secret/token and asset-proxy safety | UNKNOWN | unit, contract, integration | PARTIAL | FAIL | Two auth contracts and six proxy bypass contracts fail against current behavior |
| CI and browser-quality gates | UNKNOWN | static, e2e, manual | NOT COVERED | NOT RUN | No CI workflow; one desktop Chromium-sized project; no accessibility gate |

## Agent Test Evidence

- `tests/agent/reservations/reserve-across-channels.md` — Status: `NOT RUN`. The case remains a draft, no agent report exists, and `.runtime/evidence.json` contains only an item ID.
- Three downstream reservation YAML files use a different hard-coded item ID, so the current evidence handoff cannot prove the shared-item journey.

## Findings

- [ ] **Critical SEC-01 — unauthenticated privileged secret access**: contracts in `__tests__/api/privileged-secrets-auth.test.ts` fail because both routes reach service-role construction instead of returning 401.
- [ ] **Critical FIN-01 — payout resolution privilege gap**: the ordinary-user contract in `__tests__/api/payout-routes-auth.test.ts` fails because the route reaches elevated access instead of returning 403.
- [ ] **High FIN-02 — non-atomic payout mutation**: payout request deduction, request insertion, and compensation are separate calls. The compensation uses `add_credits`, while the repository payout migration defines `add_balance`; remote-only schema state is unverified.
- [ ] **High NET-01 — permissive asset proxy allowlist**: six adversarial contracts in `__tests__/api/assets-proxy-security.test.ts` fail because lookalike/query-string/insecure URLs are fetched, including by the ZIP proxy that forwards service credentials.
- [ ] **High API-01 — untested runtime error**: `app/api/active-experiments/route.ts` passes `siteId` to `createServiceApiClient` before `siteId` is declared.
- [x] **Resolved TEST-01 — mixed runner discovery**: `jest.config.js` now collects only `__tests__/**/*.test.*`; the audit found zero generated Playwright specs or support modules.
- [ ] **High TEST-02 — existing Jest regressions**: the full isolated run has 29 failed suites and 95 failed tests. Import resolution was repaired, exposing behavior drift in text cleaning, agent components, workflow layout, documents, and other areas.
- [x] **Resolved E2E-01 — non-awaited browser assertions**: all 36 affected assertions now use `await`; strict transpilation and the five-scenario browser run passed. The negative title assertion remains weaker than a semantic page assertion.
- [ ] **High API-02 — documented workflow route missing**: `app/integrations/page.tsx` and workflow docs reference `/api/workflows/webhook`, but no route exists; the rewritten contract fails explicitly on its absence.
- [ ] **High DATA-01 — database behavior is not executed**: record-diagram migration tests inspect SQL text but do not apply the migrations or exercise PostgreSQL constraints, RPCs, grants, or RLS.
- [ ] **Medium AGENT-01 — reservation verification is incomplete**: the only registered agent case has no completed report and its runtime item ID differs from hard-coded downstream YAML IDs.

## Deferred / Residual Risk

- [ ] Role matrix: configure owner, manager, editor, and viewer storage states.
- [ ] Tenant isolation: create a second controlled tenant and foreign resource fixtures.
- [ ] External providers: OAuth, email delivery, payment gateway, camera, and hardware checks remain quarantined.
- [ ] Buyer detail journeys: create deterministic order, quote, subscription, reservation, download, ticket, and course entitlements.
- [ ] Reservation agent chain: share one generated item across POS, Shop, and manual flows; assert outcomes and clean up deterministically.
- [ ] Test isolation: replace first-project selection and name-only cleanup with a named disposable workspace and tenant-scoped teardown.
- [ ] Route contracts: group private handlers by auth/ownership policy and cover anonymous, wrong-role, wrong-tenant, malformed, provider-failure, and success paths.
- [ ] Financial integration: run payout and Stripe tests against disposable database and provider-test fixtures.
- [ ] Record runtime: apply the five diagram migrations to a fresh database and exercise queue/RLS/concurrency behavior.
- [ ] Release gates: add reproducible CI only after the test discovery and fixture issues are repaired.

## Cleanup

- This inventory created no runtime fixtures and performed no application mutations.
- No secrets were printed or added to test files or reports.

## Coverage Summary

- Total testing whats: 24
- COVERED: 7
- PARTIAL: 13
- IMPLICIT: 0
- NOT COVERED: 1
- NOT MEASURED: 0
- MANUAL: 0
- BLOCKED: 3
- DEFERRED: 0
