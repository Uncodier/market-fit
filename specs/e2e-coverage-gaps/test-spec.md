# Test Spec: Application Coverage Gaps

**Scope**: Application-wide test gaps across browser journeys, HTTP boundaries, server actions, database invariants, and scheduled jobs
**Source material**: `specs/context.md`, `specs/tests/*.md`, `app/**`, `supabase/migrations/**`, `__tests__/**`, `tests/**/*.test.yaml`, user request
**Testing posture**: baked-in Shiplight default
**Test report**: [test-report.md](./test-report.md)

## Testing What

### Product Behaviors

- Previously uncovered authenticated screens render for the admin test account.
- Check-in rejects an invalid manual ticket code and remains usable.
- Context and Security sections can be navigated without losing their selected state.
- Code Agent skill content can be expanded and read.
- Every reporting dashboard route renders.
- Buyer workspace routes render for the authenticated test account.
- Accounting and payment read-only controls render and respond without mutating financial data.
- Public marketplace, storefront, privacy, and empty-checkout routes render.
- Direct access to blocked platform administration routes is rejected.
- Sales Home and the hidden Activities settings tab render their primary controls.
- Authentication covers password login, OAuth callback, MFA, reset, invitation acceptance, logout, and safe post-auth redirects.
- Owner, admin, collaborator, and marketing users see and can perform only their allowed site-scoped actions.
- A buyer can access only their own orders, quotes, subscriptions, reservations, downloads, tickets, and courses.
- Paid checkout produces one consistent payment, order, inventory, entitlement, and fulfillment outcome.
- Public quote, sales-order, invoice, and vendor-bill tokens handle valid, invalid, expired, revoked, and cross-document access.
- Record diagrams persist node, edge, attachment, revision, and embedding state across reloads and concurrent edits.

### Implementation / System Invariants

- Navigation remains scoped to the selected test site where required.
- Tests do not connect hardware, send real payments, reveal secrets, or connect external providers.
- Read-only checks do not alter financial, authorization, or third-party state.
- Every private route handler and server action authenticates before using service-role access and verifies ownership of every supplied site or resource identifier.
- Database RLS enforces owner, admin, collaborator, marketing, anonymous, buyer, and second-tenant boundaries against a freshly migrated database.
- Payout balance changes and payout state transitions are atomic, replay-safe, and concurrency-safe.
- Stripe webhook processing and commerce fulfillment are idempotent and recover correctly from partial failures.
- Record embedding jobs enforce authorization, bounded work, claim exclusivity, retries, stale-claim recovery, and terminal failure semantics.
- Jest collects Jest tests only; generated Playwright specs remain isolated to Playwright.

### Risk-Based Behaviors

- Role-based authorization and cross-tenant denial require additional role fixtures.
- External OAuth, Stripe, email delivery, camera access, and hardware pairing are excluded from routine deterministic E2E.
- Secret and token endpoints deny anonymous and cross-tenant access, never rely on fallback production keys, and never disclose values through logs or errors.
- Asset proxy routes accept only exact trusted HTTPS hosts and reject redirects, lookalike hosts, private-network targets, oversized bodies, and unauthorized objects.
- Privileged payout resolution cannot be performed by an arbitrary authenticated tenant user.
- Anonymous conversation/message policies cannot expose or mutate another visitor's data.

### Operational / Release Behaviors

- The Jest suite has a deterministic discovery boundary and no stale imports.
- Required tests run in CI with reproducible fixtures and cleanup.
- Browser coverage includes at least one responsive viewport and a keyboard/accessibility pass for core journeys.
- Agent verification reports include auditable UI and backend evidence rather than draft-only cases.

## Evidence Strategy

| What | Priority | Viable How | Selected How | Why | Residual Risk |
| --- | --- | --- | --- | --- | --- |
| Authenticated screen availability | UNKNOWN | e2e, smoke | Shiplight E2E | Browser routing and rendering must be exercised | Does not prove deep business behavior |
| Invalid manual check-in | UNKNOWN | contract, e2e | Shiplight E2E | Requires rendered validation feedback | Valid ticket lifecycle needs a dedicated fixture |
| Context, Security, Skills navigation | UNKNOWN | e2e | Shiplight E2E | State and content are browser-rendered | Mutating security actions intentionally excluded |
| Reports, Buyer, purchasing surfaces | UNKNOWN | e2e, smoke | Shiplight E2E | Detects broken routes and runtime crashes | Backend state transitions remain partial |
| Public commerce routes render | UNKNOWN | e2e, smoke | Shiplight E2E | Public route middleware and rendering must be exercised | Paid checkout remains quarantined |
| Platform administration boundary | UNKNOWN | contract, e2e | Shiplight E2E | Confirms the blocked route cannot render for a site admin | Does not replace a super-admin authorization implementation |
| Remaining formal navigation routes | UNKNOWN | e2e, smoke | Shiplight E2E | Closes the Sales Home and Activities route gaps | Does not mutate activity configuration |
| Role and tenant isolation | UNKNOWN | contract, integration, e2e | Contract + integration + Shiplight E2E (blocked) | Only admin browser state is configured | Requires controlled non-admin accounts and a second tenant |
| Test discovery and stale-import integrity | UNKNOWN | static, unit | Jest configuration + focused Jest tests | A trustworthy suite is a prerequisite for every later result | Full-suite status remains unknown until repaired |
| Private API and server-action authorization | UNKNOWN | contract, integration | Parameterized contract tests | HTTP/action boundaries must reject anonymous and foreign-site input before service-role access | Broad surface requires incremental route groups |
| Live RLS role matrix | UNKNOWN | integration | Disposable Supabase integration tests | Static SQL checks cannot prove runtime policy behavior | Requires local Supabase fixtures for all roles and a second tenant |
| Payout authorization and atomicity | UNKNOWN | contract, integration | Route contracts + database concurrency tests | Money movement requires privilege, transition, rollback, and replay proof | No transactional RPC currently spans deduction and request creation |
| Stripe and commerce state consistency | UNKNOWN | contract, integration, agent | Signed-handler contracts + database integration + release agent case | UI success alone cannot prove payment, order, inventory, entitlement, and fulfillment agreement | Requires Stripe test fixtures and cleanup |
| Authentication, invitations, and buyer ownership | UNKNOWN | contract, e2e | Route contracts + role-specific E2E | Browser and ownership boundaries require real identities | Only admin storage state exists |
| Public document token lifecycle | UNKNOWN | contract, e2e | Token contracts + browser rendering | Must prove revocation/expiry and data minimization | Stable token fixtures do not exist |
| Record diagram persistence and embedding lifecycle | UNKNOWN | unit, contract, integration, e2e | Existing unit tests + fresh-DB integration + focused E2E | Current tests are mocked or inspect migration text only | Runtime RLS, concurrency, persistence, and cron behavior remain unproven |
| Declared P0 CRUD completeness | P0 | e2e, contract | Existing Shiplight E2E plus missing lifecycle steps | The source specs explicitly declare P0 | Several journeys omit update, delete, or deterministic cleanup |
| Secret/token and asset-proxy safety | UNKNOWN | unit, contract, integration | Boundary tests with adversarial inputs | These routes process privileged credentials or remote URLs | Live provider access is not required for boundary proof |
| CI and browser-quality gates | UNKNOWN | static, e2e, manual | CI scripts + responsive/accessibility checks | Local historical passes do not provide a current release gate | No CI workflow or alternate browser/viewport project exists |

Out of scope:

- Production writes.
- Real card payments, OAuth connections, printer pairing/test printing, camera permission automation, and secret reveal.

## Test Cases

### E2E-GAPS-T01 Uncovered Admin Navigation

- Preconditions: authenticated admin and selected canary project.
- Automated check: `tests/uncovered-admin-navigation.test.yaml`
- Pass criteria: each formal route renders without an error page and key screens expose their primary UI.

### E2E-GAPS-T02 Manual Check-in Validation

- Preconditions: authenticated admin and selected canary project.
- Automated check: `tests/check-in-validation.test.yaml`
- Pass criteria: an invalid code produces visible feedback and manual entry remains available.

### E2E-GAPS-T03 Context and Security Sections

- Automated checks: `tests/context-tabs.test.yaml`, `tests/security-tabs.test.yaml`
- Pass criteria: every tab can be selected and its active state is rendered.

### E2E-GAPS-T04 Skills and Reports

- Automated checks: `tests/skills-read.test.yaml`, `tests/dashboard-reports.test.yaml`
- Pass criteria: skill instructions expand and all report routes render.

### E2E-GAPS-T05 Buyer and Finance Read Flows

- Automated checks: `tests/buyer-navigation.test.yaml`, `tests/finance-read-flows.test.yaml`
- Pass criteria: Buyer routes render; accounting/payment controls can be inspected without writes.

### E2E-GAPS-T06 Public Commerce Navigation

- Automated check: `tests/public-commerce-navigation.test.yaml`
- Pass criteria: marketplace, seeded item, storefront, privacy, and empty-checkout routes render.

### E2E-GAPS-T07 Platform Administration Boundary

- Automated check: `tests/admin-route-boundary.test.yaml`
- Pass criteria: `/admin/payouts` returns 404 and does not render payout management.

### E2E-GAPS-T08 Remaining Formal Navigation

- Automated check: `tests/formal-navigation-gaps.test.yaml`
- Pass criteria: Sales Home quick actions and AI Activities controls render.

### E2E-GAPS-T09 Test Harness Integrity

- Testing what: Jest discovery excludes generated Playwright specs and all intended Jest modules resolve.
- Source refs: `jest.config.js`, `tests/**/*.yaml.spec.ts`, stale imports reported in `test-report.md`.
- Automated checks:
  - `npx jest --listTests --runInBand`
  - focused Jest execution for repaired import paths.
- Pass criteria: no generated YAML spec or orphan diagnostic is collected by Jest; no suite fails during module resolution.

### E2E-GAPS-T10 API Authorization And Tenant Isolation

- Testing what: private route handlers and server actions reject anonymous, wrong-role, and wrong-tenant callers before privileged access.
- Source refs: `app/api/**/route.ts`, `app/**/actions.ts`, `lib/auth/**`, `lib/permissions/**`.
- Planned evidence: parameterized Jest contract tests grouped by boundary type.
- Pass criteria: each protected boundary returns the documented denial and performs no service-role mutation for unauthorized inputs.

### E2E-GAPS-T11 Live RLS Matrix

- Testing what: owner, admin, collaborator, marketing, anonymous, buyer, and second-tenant identities receive exactly their allowed CRUD access.
- Source refs: `supabase/migrations/**`, especially records and team-access policies.
- Planned evidence: integration tests against a freshly migrated disposable Supabase database.
- Pass criteria: allowed operations succeed; forbidden operations return no rows or fail; cross-tenant relationships cannot be created.

### E2E-GAPS-T12 Payout Authorization And Atomicity

- Testing what: payout request and resolution authorization, state transitions, concurrent balance deductions, rollback, rejection refund, and replay.
- Source refs: `app/api/payouts/request/route.ts`, `app/api/payouts/resolve/route.ts`, payout migrations.
- Planned evidence: route contracts plus database integration tests.
- Pass criteria: only intended principals act; balance and payout state never diverge; repeated/concurrent requests cannot duplicate or overdraw.

### E2E-GAPS-T13 Stripe And Commerce Lifecycle

- Testing what: signed webhook handling and checkout-to-fulfillment state across payment, order, inventory, entitlement, reservation, shipment, refund, and retry.
- Source refs: `app/api/stripe/**`, `app/api/commerce/checkout/route.ts`, `app/commerce/**`.
- Planned evidence: route contracts, database integration tests, deterministic checkout E2E, and one cross-layer agent release case.
- Pass criteria: invalid signatures/ownership fail; successful and retried events converge to one consistent final state.

### E2E-GAPS-T14 Authentication, Buyer, And Public Documents

- Testing what: password/OAuth/MFA/reset/invite/logout lifecycle, site switching, buyer ownership, and public token validity/revocation.
- Source refs: `app/auth/**`, `app/api/auth/**`, `app/buyer/**`, `app/{q,so,i,vb}/**`.
- Planned evidence: route contracts and E2E with dedicated role, buyer, and tenant fixtures.
- Pass criteria: redirects are safe, replay/expiry fails, and one identity cannot access another identity's data.

### E2E-GAPS-T15 Record Diagram And Embedding Runtime

- Testing what: diagram CRUD/persistence/conflicts, attachment ownership, live migrations/RLS, embedding queue claims/retries, and retrieval.
- Source refs: `app/records/**`, `app/api/records/embed/route.ts`, API repository `src/app/api/cron/record-embeddings/route.ts`, and `supabase/migrations/20260916020500_record_diagrams.sql` through `20260916020900_expand_record_diagram_node_kinds.sql`.
- Planned evidence: existing Jest tests, new route/worker branches, fresh-database integration, and focused Shiplight E2E.
- Pass criteria: persistence and authorization survive reload/concurrency; queue work is bounded, exclusive, retryable, and observable.

### E2E-GAPS-T16 Declared P0 CRUD Completion

- Testing what: close the update/delete/cleanup omissions documented by the existing P0 specs.
- Source refs: `specs/tests/crud-*.md`, `tests/crud-*.test.yaml`.
- Planned evidence: focused Shiplight E2E updates after walking the current UI.
- Pass criteria: each intended CRUD lifecycle has deterministic cleanup; intentionally unavailable UI actions remain explicitly documented rather than fabricated.

### E2E-GAPS-T17 Secret, Token, And Asset Proxy Boundaries

- Testing what: authentication, tenant ownership, encryption-key requirements, redaction, and exact remote-host validation.
- Source refs: `app/api/secrets/route.ts`, `app/api/secure-tokens/route.ts`, `app/api/assets/proxy/route.ts`, `app/api/assets/proxy-zip/route.ts`.
- Planned evidence: unit URL-validation tests and route contracts with adversarial inputs.
- Pass criteria: anonymous/foreign-site access and unsafe URLs fail without network calls or secret disclosure.

### E2E-GAPS-T18 Browser And Release Gates

- Testing what: correct awaited assertions, semantic page assertions, responsive/keyboard checks, CI execution, and completed agent evidence.
- Source refs: five navigation YAML suites, `playwright.config.ts`, `tests/agent/**`.
- Planned evidence: strict YAML transpilation, focused browser runs, CI workflow, and completed agent report.
- Pass criteria: assertions cannot pass without executing; core journeys run reproducibly with auditable artifacts.

## Fixtures And Environments

### Local Development

- Web URL: `http://localhost:3000`
- Accounts: environment-configured owner/admin plus new collaborator, marketing, and buyer identities.
- Data fixtures: named disposable primary and second-tenant sites, buyer-owned and foreign resources, Stripe test fixtures, and record embedding fixtures.
- Mutation policy: seeded fixtures only.
- Known limitations: only the admin browser role is currently configured; Shiplight browser MCP was unavailable during the 2026-09-16 inventory.

### Production

- Mutation policy: read-only by default.
- External and hardware journeys remain excluded.

## Coverage Notes

- Priorities remain `UNKNOWN` unless a source explicitly declares P0–P3.
- Fifteen existing CRUD specs explicitly declare P0; the broader security, finance, authentication, and operational gaps have no owner-declared P-level.
- Role/tenant coverage remains blocked until dedicated accounts and tenant fixtures exist.
- Historical E2E route coverage does not substitute for route-handler contracts, live RLS tests, or transaction/concurrency tests.
- Current Jest discovery includes generated `*.yaml.spec.ts` files, and focused execution confirmed unresolved imports in multiple authored Jest suites.
