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

## New requested execution — 2026-10-28

IN PROGRESS; no new live suite result is claimed yet. User requested a new
disposable environment and execution. The eight-hour cost/lifetime question timed
out; no extension was approved. The existing four-hour installer configuration
was retained under the explicit creation request. Current public retail baseline
is approximately USD 0.76 for VM, standard IP and prorated disk over four hours;
disk operations, egress, automation and provider usage are not included.

New exact ID: `qa-1793220482163-d601ed05`, resource group
`rg-makinari-qa-20261028204911-27ec6`; West US 2, `Standard_D4as_v5`.
Created 2026-10-28 20:49:11 UTC; expires 2026-10-29 00:49:11 UTC, external
expiration schedule rounds up to the next minute. Managed-identity cleanup
verification completed before VM creation. The previous group remains absent.

Packaging uses isolated, clean committed snapshots; unrelated local API,
Workflows and frontend changes are excluded and preserved:

- Frontend `4b703933a5be8d0d160ade09728dfb818fc72950`.
- API `2545ee69a811379dbf7496b802e3a0857b5a9d34`.
- Workflows `e3c2b117a85eae76e935f410091e0b7472bed34e`.
- Schema `a91e80d12287d55fed36e9b7c350adf1b7cae603`.

Local preflight: 595 frontend E2E support tests and 85 installer tests passed;
all 50 regression sources strictly transpiled/discovered with no warnings.
The 145-chunk schema manifest/hash/guard validation passed. Typecheck has two
existing self-referential query typing diagnostics in
`__tests__/commerce/checkout-recorded-promotion.test.ts:41-42`; those unmodified
tests are not waived. Credentials were inspected only for mode/presence:
Stripe keys are test mode, and private test-model credentials are available.

The installer is building the fresh stack and enables local token-hash email
templates in the staged schema copy only. A QA-specific bootstrap correction sets
managed frontend readiness to `/auth` and API readiness to `/api/status`, not the
API's nonexistent `/` page; its 16 targeted installer tests pass.

Planned sequential execution: provision → account-lifecycle → project-lifecycle →
smoke → buyer → roles → full regression. The 7,500-second regression admission
window remains mandatory; no run will silently extend expiry. Existing Robot,
social OAuth, full reservation/cleanup and paid Stripe fulfillment gaps remain
distinct prerequisites, not coverage established by the buyer read suite.

### Fresh stack readiness and first live account run

The fresh VM replayed all 145 migrations. Frontend `/auth` and API `/api/status`
returned 200; Supabase containers and both Redis instances became healthy and
three workers entered RUNNING. Auth/site counts before seeding were zero. Installer
`qa provision` completed with VERIFIED status: five Auth fixtures, two sites and
21 rows. Chromium was installed through the committed Playwright CLI.

Supabase CLI 2.122.0 now uses Mailpit v1.31.3 behind the `inbucket` service name.
The old `/api/v1/mailbox/...` endpoint returned 404 while the actual Mailpit API
was healthy. A testing-only read adapter was added: fall back on a genuine 404
only, search the exact run recipient, verify recipient again on message reads,
and retain all action-origin/redirect/token-type checks. No provider responses
are mocked and Auth email confirmation remains enabled. The adapter's 34 focused
tests and ESLint pass; its SHA is preserved in the private testing-overlay file.
This local overlay is explicit provenance, not a claim of a clean committed
frontend test run. Application source is unchanged.

First account run launched through the installer:
`qa-1793220482163-d601ed05-account-lifecycle-8b78c1af`. Results remain pending.

### Exact live attempts in the new QA

| Run suffix | Suite | Actual product result |
| --- | --- | --- |
| `account-lifecycle-8b78c1af` | accounts | 1 passed / 2 failed; signup persisted and email received, confirmation journey failed; invalid-login locator ambiguous |
| `account-lifecycle-024e1271` | accounts | 2 passed / 1 failed; both negative cases passed; confirmation click occurred before hydration, no confirmed identity |
| `account-lifecycle-0fee5cf1` | accounts | 2 passed / 1 failed; real confirmation and initial password setup passed, later login/logout/recovery journey incomplete |
| `project-lifecycle-f948d9b3` | projects | login setup passed, product failed while reading creation response after navigation |
| `project-lifecycle-df5f688a` | projects | same response capture failure; not a passing creation/archival certificate |
| `project-lifecycle-01098684` | projects | creation/selection/cancel advanced; failed at archival response-body capture after navigation |
| `smoke-870898ff` | smoke | 4 passed / 2 failed; login setup passed; Content fixture visible but dependency observer fails (Reddit 502 and notification/network errors); Leads observer fails |
| `buyer-28bc4a92` | buyer | full defined read journey passed, login setup passed; no payment/subscription certificate |
| `roles-395e005b` | roles | 7/7 passed; real role/RLS boundary assertions |

The full corrected regression `regression-0a3fd78f` launched at approximately
21:18 UTC with all 50 product scenarios selected and separate login setup. This
is a full unfiltered execution; at this update it is RUNNING, not passed. Runtime
is bounded by the existing two-hour suite timeout and exact environment expiry.
Robot/OAuth tests retain their explicit missing-prerequisite blockers.

Test-only corrections preserve live behavior: confirmation navigation waits for
document load before clicking an SSR button; invalid-login assertion selects the
actual invalid-credentials alert. Project creation and archival capture the real
HTTP body through a single upstream relay before a hard navigation destroys
Chromium's response identifier. The original upstream response is passed through
unchanged; no fabricated API success, extra insert or replay is permitted. Exact
run-owned site/user/name checks and authenticated archival remain in force.
The revised project flow still needs another live verification after regression.

All machine summaries remain `healthGreen=false` because git-archive deployment
does not retain repository provenance and explicit test overlays are present.
Passing product assertions are reported separately, never promoted to reproducible
release health. Safe summaries are exported locally through installer `qa results`;
raw Auth state, mail links, account passwords and traces remain private.

### Confirmed logout proxy-origin failure

An isolated QA browser diagnostic logged in as the synthetic admin, then followed
the app's actual logout route. Its 302 Location was `http://localhost:37695/auth`,
the managed runtime's internal port, rather than the browser origin
`http://127.0.0.1:3000`. This is a demonstrated app/proxy incompatibility explaining
the post-password account journey failure, not an absent user or email.

A local forward fix returns relative `Location: /auth`, preserving the original
cookie clearing/session signout and avoiding trust in client or forwarded hosts.
Six tests cover local/internal/production host cases, untrusted headers/returnTo
and expired-session cleanup. It is not applied to the running app during regression;
a later isolated QA retest is required before claiming the account journey works.

### Sequential completion controller

A private, exact-ID local controller continues this already authorized execution;
it is not a recurring scheduled task. It waits for full regression finalization,
exports safe summaries/journals, then restarts only the verified QA supervisor with
the reviewed proxy correction. The correction converts internal loopback absolute
Location values on the exact serving port to relative paths; external/OAuth URLs,
other ports and client/forwarded hosts are never used as redirect authority.
Focused runtime tests pass 58/58. No baseline application source is changed while
regression runs.

After readiness it sequentially requests fresh account/project/smoke/buyer/roles
runs through the installer, with lifetime admission gates. It cannot create or
extend infrastructure. Finalization exports evidence and requests destruction of
only `rg-makinari-qa-20261028204911-27ec6`, then checks `groupExists=false`.
At this update those retests/destruction are PENDING, not completed; private
`completion-progress.json` and individual exact-run summaries are authoritative.

Final local repair validation on the current working tree: 606 tests passed in
25 frontend E2E/auth suites, 137 installer tests passed in seven suites, targeted
ESLint and `git diff --check` passed, and `npm run typecheck` passed. Concurrent
unrelated frontend edits were preserved; the earlier checkout-promotion typing
diagnostics no longer reproduce. These checks do not replace pending live retests.

### Full regression terminal result and closure — 2026-10-28

`qa-1793220482163-d601ed05-regression-0a3fd78f` finished at 22:14:41 UTC after
starting at 21:18:35 UTC. **All 50 product cases were selected and produced
results: 1 passed, 47 failed, 2 blocked; no flaky or skipped cases.** Separate
login setup passed. Scope is full, missing/unexpected counts are zero, but
`complete=false` because prerequisite-blocked cases remain. `healthGreen=false`
and exit code 1. This is an actual step-executing baseline, not a successful
regression certificate and not the earlier model-configuration failure.

At 22:15 UTC the private controller exported final safe evidence and uploaded
reviewed runtime/test files. It then failed its exact-supervisor safety check
before corrected-runtime readiness or any new retest launch. It did not bypass
that check or infer success. **Corrected-proxy account/project/smoke/buyer/roles
retests did not run.** The failure was recorded and closure continued with safe
evidence export, final summaries, and exact-group destruction request. Resource
absence was subsequently confirmed at approximately 22:19 UTC: Azure returned
`ResourceGroupNotFound` and installer status returned **`groupExists=false`**.
No infrastructure remains for this exact QA group. Safe reports/journals were
exported before destruction; earlier pre-destruction account journals correctly
retain `cleanup.completed=false` as historical records.

Earlier Buyer read and roles passes remain valid product results for the baseline,
not proof of signup/recovery, paid checkout, subscription delivery or full
reservation cleanup. The latter journeys still require authored positive tests
and verified provider/fixture prerequisites. No production mutations, commit or
push were performed; eight-hour lifetime extension was not approved or applied.

The requested environment/run/cleanup cycle is finished, but product coverage is
not green. A new approved QA would be needed to live-verify the local logout/proxy
and capture fixes and author/execute the missing paid/reservation/provider flows.

## Result-driven repair batch — 2026-10-28 (local only)

The user requested repairs to tests and application using the QA results. The
previous group remains deleted. No new cloud resources, deployments, migrations,
commits, or provider mutations were authorized in this repair batch.

Evidence boundary: the 1-pass/47-fail/2-blocked full regression summary was saved,
but its per-test Playwright report and traces were not exported before destruction.
The individual 47 causes cannot be recovered from counts; do not present inferred
bugs as observed regression failures. Two exact smoke traces and recorded
account/project checkpoints remain available privately.

Implemented, verifiable corrections:

- Observer: unavailable/empty response bodies are classified after same-request
  terminal state, fixing the documented CDP cancellation/event ordering race.
  Nonempty application failures, real malformed/empty JSON, other-request
  cancellation and actual HTTP failures still fail. Missing `/_next/static/`
  files are explicit HTTP failures, not dependent on console capture.
- Workspace shell: use supported `React.lazy` + existing Suspense instead of the
  SSR `next/dynamic` react-loadable preload path. SSR and no-workspace route lazy
  boundaries remain intact. Root layout carries credits-widget CSS so initial
  shell styles are not delayed. Real installed compiler, rendering, and isolated
  Next dev checks verify emitted JS/CSS 200s and browser hydration in both
  Turbopack and webpack; they do not call application APIs or providers.
- Reddit: upstream transport, HTTP, malformed JSON and shape failures are typed
  sanitized dependency 502s, not client-JSON 400s or cached empty successes.
  Configured OAuth failure does not retry anonymously; public reads are retained
  only when both OAuth fields are absent. Logs retain phase/kind/status, not raw
  provider details. Actual provider access remains an unresolved prerequisite.
- Unit fixtures: Content deletion/preview use precise permission/role/location
  RPC semantics, including strict `false` for no location restrictions and
  distinct fail-closed lookup errors. Trends table uses the real localization
  provider. The 95 stale-fixture failures were reproduced before fixing tests;
  product authorization and persistence assertions are not weakened.
- Installer evidence: `qa results` exports allowlisted per-test outcomes,
  attempts, nested step indexes and source locations privately, revalidated
  locally. Missing reports/count mismatches/extraction failures are explicit;
  raw messages/titles, passwords, bearer URLs, bodies/headers and logs cannot
  enter safe JSON. This enables a future diagnostic rerun; it does not recover
  deleted evidence.

Initial batch validation: 1,124 frontend tests pass in 48 relevant suites,
including previously failing Content/Trends fixtures; two additional isolated
Next dev/browser tests pass (Turbopack + webpack). Exact provider/cache regressions
pass and targeted ESLint is clean. Final consolidated checks are recorded below
after the remaining title-editor and runtime-control repairs finish.

Live acceptance remains NOT RUN for this repair batch. Earlier QA results remain
unchanged and cannot be relabeled green from local Jest/compiler validation.

### Consolidated repair validation — 2026-10-29

The title-editor and local runtime-control repairs are now implemented:

- Campaign/deal rename uses keyboard-accessible edit buttons and labeled inputs,
  with same-tick Enter/blur save serialization, retained failed drafts, explicit
  retry, Escape cancellation and IME handling. The two YAML journeys retain real
  reload/DB persistence and cleanup assertions; their strict transpilation passes.
- `./install.sh --stop` controls only its canonical local supervisor through its
  owner-only Unix socket, verifies running instance identity and waits for graceful
  child/public-port closure. It never matches arbitrary PID command strings or
  unlinks a live socket. Wrong roots, symlinks, replaced sockets, unexpected
  arguments and unconfirmed shutdown fail closed. This is a tested replacement
  for the brittle ad-hoc restart preflight, not a claim that its deleted QA retest
  was recovered.

Final checks:

- **1,155 frontend tests passed in 51 relevant suites**, including actual isolated
  development server/browser asset and hydration checks with Turbopack and webpack.
- **186 installer tests passed in 10 suites**; the final dispatch/helper focused
  rerun additionally passed 21 tests after strict extra-argument forwarding.
- `npm run typecheck` passes. Initial newly authored test typing diagnostics were
  repaired rather than suppressed. Targeted ESLint and both repos' diff checks pass.
- The fixture servers were stopped and their temporary directories removed.
  No QA/app server, browser suite or teammate remains active from this repair.

Remaining acceptance boundary: no full repaired app run occurred on disposable
Azure QA. The 47 failed baseline scenarios cannot all be diagnosed from saved
counts; the newly repaired per-case export must be used on the next approved run.
Reddit provider access, Robot/OAuth prerequisites and complete paid/reservation
journeys remain unresolved. Do not report the application or release as green.