# Disposable QA execution report — 2026-10-27

## Current state

PARTIAL. The initial fixture battery, real role/RLS checks and latest Buyer read
journey passed. Browser smoke is not green and a usable full YAML regression has not been proved.
No product assertion, provider authorization or cleanup guard was removed to
manufacture success. Current user priorities were not assigned P0–P3.

Target: run-owned Azure QA `qa-1793126113145-a4b7d0d6`, with local Supabase,
Redis and Temporal. Application test origins are loopback inside that VM. Expiry
remains 2026-10-27 22:35:34 UTC; external deletion is scheduled for 22:36 UTC.
An extension question timed out; no expiry or cost extension was performed.

## Phase 1 — initial fixture battery

Implemented `scripts/e2e/provision-qa.cjs` and focused support modules. Initial
apply requires local backend identity, actual bootstrap RLS/local-webhook guard,
explicit environment ID/expiry, privileged setup key and both mutation flags.
The setup key never enters browser test environments or reports.

Actual setup: five Auth users, two sites and 21 deterministic relational fixtures,
plus an assets bucket prerequisite. Public-key sessions independently verified
identity, profiles, memberships, effective capabilities and tenant/private-content
isolation. Credentials/journal are private under `.auth/qa-fixtures/<id>/`.

The first apply stopped at the account key's hyphen prohibition. Exact absent-row
reconciliation allowed only that legacy failed intent, then the second apply
completed. Later explicit QA-only profile/image initialization passed with
ownership fingerprints and conditional user-scoped writes. Real accounts were
not altered. Manual local billing capacity is not Stripe subscription evidence.

## Phase 2 — exact live attempts

### Requested re-execution (21:17–21:22 UTC)

Executed again through the installer on the same exact disposable environment:

| Run suffix | Suite | Product results |
| --- | --- | --- |
| `roles-dd6fffee` | roles | 7 passed; no retries/skips |
| `buyer-28f92c23` | buyer | Full journey passed, separate login passed; no retries/skips |
| `smoke-4d79746a` | smoke | 4 passed / 2 failed; separate login passed |

Content still fails its persisted fixture visibility assertion and dependency
observer. Lead fixture visibility completes but an observed console error fails
the test. No errors/assertions were suppressed. Exact machine summaries were
copied to private local `execution-reports/` before expiration, excluding raw
traces, Auth state and provider payloads. No suite remains active at close-out.

The operator did not answer the extension confirmation, so no cost/deadline
change was made. Full regression still lacks its required 125-minute safe window;
it was not started or falsely marked skipped/passed. Current green product
results still have `healthGreen=false` due unrecorded/dirty source provenance.

All launched through `install.sh qa provision/run/results` in the installer.

| Run suffix | Suite | Actual result | Meaning |
| --- | --- | --- | --- |
| `roles-4c1e1f5a` | roles | 7 passed, no retry/skip | Real DB capabilities, bidirectional site RLS and anonymous API/retired-route checks passed |
| `smoke-e6b6578e` | smoke | 2 passed, 1 product failed, 3 blocked; auth setup failed | Browser auth blocked by development CSP; public product/storefront initially read successfully |
| `smoke-4e74f192` | smoke | 6 failed; setup passed | Image-provider HTTP/console failures, fixture locale locator drift and FX observer failures |
| `smoke-0e9b134b` | smoke | 6 failed; setup passed | Exact workspace selection improved after QA profile setup; observed image/FX/console errors still fail reads |
| `smoke-1f012165` | smoke | 4 product passed, 2 failed; setup passed | Public product, Shop, auth redirect and exact workspace passed; Content fixture not shown with 404/502 console failures, lead read assertion completed but 404 console error failed observer |
| `buyer-bf91d520` | buyer | setup failed; product blocked | Shared local host defaulted to workspace; buyer returnTo missing in auth helper |
| `buyer-7266e68f` | buyer | 1 product failed; setup passed | All six read steps executed but final dependency observer failed |
| `buyer-4760fdac` | buyer | 1 product failed; setup passed | Safe diagnostics recorded FX GET 200 with zero-length invalid-JSON body |
| `buyer-643edc0c` | buyer | 1 product failed; setup passed | FX empty-body observation persists; not a successful buyer journey |
| `buyer-0a2ad498` | buyer | 1 product passed; setup passed, no retries/skips | All six buyer read surfaces and final observer passed after precise explicit-cancellation handling |
| `regression-7210ae06` | regression | 50 failed before steps; setup passed | Shiplight fixture model configuration missing; not fifty demonstrated product regressions |

Full corrected regression retry was refused by the installer because fewer than
7,500 seconds remained before expiry. This refusal did not extend the environment
or claim a successful skip. Private Shiplight model configuration was subsequently
allowlisted/imported; a full regression using it remains NOT RUN.

Machine summaries remain non-green due failures and dirty/unrecorded source
provenance. Do not combine independent attempts into a synthetic passing suite.

## Corrections and diagnostic additions

- Development CSP permits only explicitly configured loopback API/Supabase HTTP
  dependencies and realtime/HMR in development. Production sources are unchanged.
- Buyer authentication supplies its real `/buyer` returnTo for shared local host.
- Invalid-JSON observations retain method/status/MIME, body length/hash and parser
  classification, never headers, raw bodies or credentials. Normal JSON and actual
  HTTP/console/provider failures still fail. FX standalone request/parser checks
  pass. Actual browser navigation reproduced `requestfailed: net::ERR_ABORTED`
  followed by empty `Response.text()` for that same request. Only empty text on an
  explicitly cancelled request is excluded; unexpected empty 200 JSON, provider
  errors and HTTP failures still fail. Five negative/positive lifecycle regressions
  were added, and the latest buyer run passed.
- Installer serializes suites, enforces remaining lifetime and reads private
  fixture env in-memory. Mutation authority is enabled only for roles/regression.

## Phase 3 — completion status

Added a manual reservation evidence contract and 18 focused Jest cases for decoded
action identity, run marker/slot/customer/item/site matching, authenticated persisted
read and exact cleanup-candidate journaling. It does not execute reservation
creation or financial cleanup and cannot mark cleanup complete.

Still BLOCKED/NOT RUN: Robot external orchestration/atomic deletion, real social
OAuth/connect/disconnect, POS completed reservation, manual/Shop full channel
evidence and cleanup, positive Stripe test settlement/webhook forwarding, complete
buyer ownership/token lifecycle and subscription fulfillment. Existing zero-price
products and manual entitlement fixtures are not payment certificates.

The user's three phases are not all complete. Keep these residuals visible rather
than replacing live behavior with mocks or weakening required assertions.

## Follow-up — smoke diagnosis and local repair

At 21:36 UTC the installer confirmed `groupExists=true` for the exact QA ID;
expiry remains 22:35:34 UTC. `qaReady=false` is still reported by the lifecycle
state and must not be reinterpreted as a passing health certificate. No extension,
new infrastructure, deployment, commit, or production change was authorized here.
Resource-group deletion after expiry has not yet been verified in this follow-up.

The two latest smoke trace archives were copied to the installer's ignored private
`failure-traces/` directory. Sanitized inspection and a separate browser diagnostic
identified the following, without changing assertions:

- Content's persisted Server Action returns one fixture. Before its visibility
  assertion, the unfinished account's automatic GuidedTour navigates to
  `/onboarding`. The content is not demonstrated missing from the database.
- Content and Leads receive fresh no-store HTML preloading
  `app_1v4nwkhqgra6b._.js`, then that chunk returns 404. The SSR dynamic LayoutClient
  entry references absent dev output while the component exists in other emitted
  JS. Local manifests show a similar mismatch: evidence points to a Turbopack dev
  preload/output inconsistency, not unsupported `next/dynamic` usage. No speculative
  application import change or observer exemption was made. A clean single dev
  instance and an isolated `dev:webpack` comparison remain unexecuted diagnostics.
- Content's `/api/trends/reddit` response is a genuine 502 after a non-success
  upstream listing response. Reddit credential variables are absent from the
  generated QA environment, so public access is used unless a runtime override
  exists. Exact upstream status is not available in the saved artifacts; do not
  infer 403 or 429. Provider-approved access and egress validation remain required.
- Onboarding queries an obsolete `workflows` table and receives 404. The current
  workflow editor persists definition nodes in `instance_nodes`.

Local app corrections: automatic tour guidance is confined to `/onboarding`,
without navigation or interference with explicit manual/resumed tours; pending
checks are cancelled on route changes. Workflow validation uses authenticated,
site-filtered `instance_nodes` and shared definition types, excluding results and
unrelated nodes. Read denial cannot mark completion. A direct user-scoped query
against disposable QA returned HTTP 200 and zero definitions, as expected; no
workflow fixtures or customer metadata were fabricated.

Validation:

- Focused tour/onboarding regressions: **36 passed** across two suites.
- Broader relevant Jest run: **1,435 passed / 95 failed**, across 89 suites
  (86 passed / 3 failed). Failures are in unmodified Content deletion/preview
  permission fixtures and Trends table localization-provider setup; they are not
  waived and require separate investigation.
- Typecheck generates route types, then fails on the existing untracked
  `__tests__/e2e/manual-reservation-contract.test.ts:96` use of `row` before
  assignment. The new tour test's typing errors were corrected; no diagnostics
  remain in the files changed for this repair.
- New/updated regression test files pass targeted ESLint. The touched app modules
  retain six existing React-hook lint errors (five in onboarding validation, one
  in GuidedTour), confirmed against HEAD. One existing explicit-any diagnostic
  was eliminated; no lint rules were disabled. `git diff --check` passes.

These are local patches only. No corrected smoke or full regression was rerun
against a deployment containing them. Earlier exact suite results remain unchanged;
neither dependency failure nor missing live coverage is represented as green.