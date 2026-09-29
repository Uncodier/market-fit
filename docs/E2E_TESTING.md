# E2E execution and evidence

## Safety boundary

`npm run test:e2e` defaults to the **read-only smoke**, not all generated YAML.
The configuration excludes diagnostic/example tests and the nested agent project.
Never point regression, role-boundary or agent runs at production. Production
mutations cannot be enabled with a flag.

All live runs require explicit `TEST_TARGET`, `TEST_BASE_URL`,
`TEST_COMMERCE_BASE_URL`, `TEST_SITE_ID` and `TEST_SITE_NAME`. The selected browser
workspace must match both the configured name and UUID. Local origins must be
loopback; staging cannot use the known production hosts. Production uses the app
host and a separate www/apex commerce host.

Regression and role suites additionally require `TEST_ALLOW_MUTATIONS=1` and
`TEST_DISPOSABLE_ENVIRONMENT=1`. These are operator attestations, not proof that a
remote deployment/database is disposable. Provision and approve that environment
before running them; do not reuse production secrets or customer fixtures.

## Commands

```sh
# Discovery and transpilation only: no authentication, browser or application calls.
npm run test:e2e -- --list
npm run test:e2e -- --suite regression --list
npm run test:e2e:validate

# Live commands: configure and approve the environment first.
npm run test:e2e -- --suite smoke --target production
npm run test:e2e -- --suite regression --target staging
npm run test:e2e -- --suite buyer --target staging
npm run test:e2e -- --suite roles --target staging

# A filtered run is partial evidence, never full suite health.
npm run test:e2e -- --suite regression --target staging --grep 'Content'

# Publish this run only; never infer "latest" or merge independent reruns.
npm run test:e2e:report -- --run-id RUN_ID

# Safe, non-browser tests of the harness.
npm test -- --runInBand __tests__/e2e
```

No production build is part of test validation. Use the installed CLI and committed
npm lockfile. Generated `*.yaml.spec.ts` remain ignored and must not be hand-edited.
After strict transpilation, the runner invokes Playwright directly with the
Shiplight configuration/fixtures. This avoids the vendor `test` wrapper's implicit
CI action-cache synchronization, which is independent of report upload flags.
Telemetry is disabled for these harness commands; explicit Cloud publication is
handled only by the exact-run report command.

## Suites and required fixtures

| Suite | Evidence | Required fixtures beyond target/site |
| --- | --- | --- |
| `smoke` | Six strict read-only product checks: anonymous public product/storefront, app login redirect, exact workspace, persisted content and lead sentinels | Admin email/password; shop slug; catalog item UUID/name; `TEST_CONTENT_NAME`, `TEST_LEAD_NAME` |
| `regression` | Root YAML journeys, including destructive CRUD, settings, mobile accessibility and negative checks | Dedicated admin; configured entity dependencies and disposal authority; see each YAML/helper |
| `buyer` | Separate buyer login on commerce host, identity and completed read surfaces | `TEST_BUYER_EMAIL`/`TEST_BUYER_PASSWORD`; commerce fixtures |
| `roles` | Real role RPC capabilities, positive fixture existence and cross-site RLS denial, anonymous private API denial | Four distinct accounts: admin, collaborator, marketing, foreign; second site UUID; public Supabase connection |

The smoke fixtures must already exist and be visible to the configured identities.
Their names should be unique in the synthetic workspace. The storefront fixture
must be active, published/listed and visible in the tested listing. Tests do not
create fixtures in production or fabricate responses when data is missing.

Mutation cleanup uses a **test-specific public Supabase key and authenticated
owner/admin**, with an exact site/run-owned entity journal. A service-role key is
not a fixture credential. The fixture backend and browser session must match.
The legacy seed script now verifies explicit fixtures instead of inserting into
the first site. Shared settings restore captured originals during teardown and
verify persistence. Cleanup errors are test failures, not warnings.

Team invitation tests require a `.test`/`.invalid` mail sink and a disposable mail
transport. Do not send real invitations from automated regression.

## What a green means

The runner stores `run-manifest.json`, `run-summary.json`, Playwright JSON and the
unmodified Shiplight report in one run-specific directory. Summaries distinguish:

- Expected and selected product scenarios, excluding login/setup executions.
- Full suite versus filtered subset, missing results and blocked prerequisites.
- Passed, failed, retry-passed, skipped and blocked results.
- Test source SHA/dirty state separately from `TEST_DEPLOYED_SHA`; neither is
  proof of the other. Remote deployment SHA must be supplied by trusted deployment
  metadata, not guessed from the checkout.
- Last attempted run versus last complete run. A failure or missing report must
  never leave the most recent attempted status appearing green.

The `health-*.json` index is local to the workspace. Ephemeral CI runners retain
per-run summaries as artifacts; this does not create a durable cross-run dashboard
or an alert when a schedule stops executing.

A full, complete, first-attempt pass with adequate provenance is required for
`healthGreen`. Partial runs remain useful debugging evidence but cannot certify
the suite. A required fixture blocker is not a successful skip.

The installed Shiplight CLI uploads through its **local-runs** API and does not
offer a supported target override. The publisher labels the trigger with
target/suite/scope/run ID and preserves repository-owned metadata rather than
falsifying vendor artifacts. The Cloud `target: local` field alone is therefore
not environment evidence. Upload warnings/omissions fail publication even if the
vendor CLI exits zero. Configure an organization token for CI; never share a
personal token from a developer's dotenv file.

## Strict assertions and dependency visibility

Critical outcomes use non-self-healing code assertions. Shiplight `WAIT_UNTIL`
records warnings and is not a correctness gate; visual verification fallback is
not a database oracle. CRUD verifies persistence through successful scoped reads,
and navigation requires route-specific content, not an error-free page title.

Read observers fail on unexpected API/database HTTP failures, HTTP-200 JSON error
envelopes, thrown Server Action errors, failed requests, unhandled browser errors
and console errors. They wait for relevant pending reads. They store only safe
endpoint/status classifications, not response bodies, credentials or tokens.
This may expose real pre-existing provider or application failures. Fix those
failures; do not weaken assertions or accept empty fallback UI as success.

## Agent verification

The reservation project is excluded from root discovery because its segments
share one run-owned item. Use `npm run agent:verify -- --target staging --suite
smoke` only after its dedicated setup. Production execution is forbidden.

The runner has no unrelated application URLs, no automatic engine retry/fallback
for mutating cases, and no permission-bypass flags. It requires one final status
line plus current structured channel evidence, successful UI artifacts and
verified cleanup. Raw engine transcripts are not printed to CI logs.

The POS segment currently reaches checkout; it does **not** prove a completed
reservation. The Shop segment is a zero-total cash order, not Stripe coverage.
The agent cannot report PASS without the missing persisted channel evidence.
Structured validation does not independently establish that an agent's database
observations are true. See the case's explicit evidence contract.
The embedded project's installed Shiplight version must match the root. A mismatch
is a preflight blocker, not permission to install an arbitrary latest version or
rewrite the committed lockfile during a test run.

## Remaining product/environment blockers

- Robot creation and social/OAuth mutations require safe exact-ID provisioning
  and cleanup fixtures; they are fail-closed, not counted as coverage restored.
- People currently displays the initial search prompt for zero results; that is
  not an explicit completed-empty success state. The strict test exposes it.
- Some workflow modes remain skeletons without a configured active instance.
- Paid Stripe settlement, complete POS reservation, full buyer ownership/token
  lifecycle and full workflow completion are not claimed as live E2E coverage.
  Existing Jest tests are valuable but not a deployed integration certificate.

## Retired activity debugging surface

The `/api/cron-status` route and its unused `ActivitiesView` component were
removed. They belonged to a superseded approach to debugging Temporal activities;
the product now uses metadata attached to Temporal workflow executions instead
of maintaining this parallel status view. The boundary test requires 404, not
authentication on a revived endpoint, and Jest prevents accidental reintroduction
of its source files or application consumers.

The `cron_status` database table is intentionally unchanged. Retirement of external
writers/readers and any eventual data migration require separate verification.
This source deletion is not a deployment or proof of Temporal metadata coverage.

## CI and operational follow-up

Workflows are repository definitions only until reviewed, pushed and configured
with protected GitHub environments, dedicated test accounts and fixture variables.
Deployment-triggered production checks must validate trusted origin and SHA.
Do not expose production secrets to untrusted pull-request code.

No recurring schedule is enabled by this change. Configure monitoring cadence,
notification destinations and alert ownership explicitly. E2E cannot replace
runtime monitoring of webhook lag, stuck jobs, queue age or missing cron heartbeats.

Auth setup disables trace/video/screenshots. Other failure traces can still
contain authenticated request headers and synthetic records: treat them as
sensitive, restrict artifact access and retention, and never upload `.auth`,
dotenv files or raw engine transcripts.