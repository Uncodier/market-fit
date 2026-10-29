# E2E execution and evidence

## Safety boundary

`npm run test:e2e` defaults to the **read-only smoke**, not all generated YAML.
The configuration excludes diagnostic/example tests and the nested agent project.
Never point regression, role-boundary or agent runs at production. General production
mutations cannot be enabled with a flag. The isolated `project-lifecycle` suite is
an explicitly requested exception for creation and archival of its own new project
only; it does not change the existing mutation-helper restrictions.

The separately requested [five production harness canaries](HARNESS_PRODUCTION_CANARIES.md)
are an isolated operational exception, not a Shiplight suite or a change to those
flags. Their explicit site/repository acknowledgements, sequential activation,
read-only local observer and watchdog apply only to their five run-owned requirements.

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

# Explicitly acknowledged exception: one newly created synthetic project only.
# Requires existing target/site/admin and public-key Supabase configuration.
TEST_ALLOW_PROJECT_LIFECYCLE=1 SHIPLIGHT_RUN_ID=unique-lifecycle-run \
  npm run test:e2e -- --suite project-lifecycle --target production

# A filtered run is partial evidence, never full suite health.
npm run test:e2e -- --suite regression --target staging --grep 'Content'

# Publish this run only; never infer "latest" or merge independent reruns.
npm run test:e2e:report -- --run-id RUN_ID

# Safe, non-browser tests of the harness.
npm test -- --runInBand __tests__/e2e
```

Installer `qa results --id <exact-id>` now exports `test-evidence.json` in addition
to safe summaries: per-case outcomes, attempts, step indexes, classification and
reviewed source file/line/column locations. It excludes raw messages/titles,
payloads, headers, bearer URLs and logs. Validate its extraction status before
destroying QA; missing reports/count mismatches are explicit errors, not guessed
test failures. Previous environments whose individual reports were not exported
cannot be reconstructed from summary counts alone.

Read observation waits for request termination before deciding whether an empty
or unavailable response body was explicitly cancelled. Cancellation is bound to
the exact request; genuine empty JSON, nonempty error data, HTTP failures and
missing Next static assets still fail. Completed browser navigation is never
equivalent to healthy dependencies.

No production build is part of test validation. Use the installed CLI and committed
npm lockfile. Generated `*.yaml.spec.ts` remain ignored and must not be hand-edited.
After strict transpilation, the runner invokes Playwright directly with the
Shiplight configuration/fixtures. This avoids the vendor `test` wrapper's implicit
CI action-cache synchronization, which is independent of report upload flags.
Telemetry is disabled for these harness commands; explicit Cloud publication is
handled only by the exact-run report command.

## Suites and required fixtures

### Disposable account and project onboarding

`account-lifecycle` is an isolated local-QA suite with an empty browser context.
It registers a fresh run-owned account through the app, receives and consumes real
confirmation and recovery emails from local Inbucket, verifies the exact Auth user,
tests login/logout, changes the password, rejects the old password and confirms
replacement login. Negative cases cover invalid login and missing-token recovery.
It does not reuse or change the five provisioned role/buyer identities.

The installer exposes `qa run --suite account-lifecycle` and
`qa run --suite project-lifecycle` after `qa provision`. Account runs require
25 minutes remaining; browser timeout is 20 minutes. The account preflight requires
verified QA identity/expiry, `TEST_ALLOW_ACCOUNT_LIFECYCLE=1`, both disposable
mutation flags, a unique installer run ID, a public Supabase key and explicit
`TEST_INBUCKET_URL`. Production and remote staging are forbidden for this suite.
Project creation/selection/password-confirmed archival uses the existing separate
project journey, not fixture seeding. Run both before product smoke/regression.

```sh
# Discovery only: no signup, mailbox read, login or other network execution.
npm run test:e2e -- --suite account-lifecycle --list
npm run test:e2e -- --suite project-lifecycle --list
```

Passwords and action links remain in memory. Account trace/video/screenshots are
disabled; evidence contains only IDs and confirmed checkpoints. The private
account journal records `cleanup.completed=false` until the installer verifies
absence of the exact disposable resource group. There is no service-role Auth
delete, no shared-user password reset, and no fabricated success response.
Fresh QA needs enabled email confirmation and app-compatible local email templates;
an older QA with disabled confirmations must fail, not silently bypass the journey.
Current Supabase CLI releases use Mailpit behind the legacy `inbucket` service
name. The account helper supports both transports: only an actual old-endpoint
404 selects Mailpit; auth/server errors remain failures. Mailpit search and
message reads are bound to the exact run-owned recipient. No global mailbox
deletion or generated-link shortcut is used. Confirmation waits for document
load before clicking its server-rendered button. Passwords remain ephemeral
worker values, not persisted test fixtures; native fill titles and bearer-link
query credentials are redacted before reporter serialization.
See [account lifecycle spec](../specs/tests/account-lifecycle.md).

New account coverage is authored and offline validated, **not live verified**.
No new environment or expiry extension was authorized. A passing Jest helper test
or Playwright discovery is not evidence that email delivery or onboarding works.

| Suite | Evidence | Required fixtures beyond target/site |
| --- | --- | --- |
| `smoke` | Six strict read-only product checks: anonymous public product/storefront, app login redirect, exact workspace, persisted content and lead sentinels | Admin email/password; shop slug; catalog item UUID/name; `TEST_CONTENT_NAME`, `TEST_LEAD_NAME` |
| `regression` | Root YAML journeys, including destructive CRUD, settings, mobile accessibility and negative checks | Dedicated admin; configured entity dependencies and disposal authority; see each YAML/helper |
| `buyer` | Separate buyer login on commerce host, identity and completed read surfaces | `TEST_BUYER_EMAIL`/`TEST_BUYER_PASSWORD`; commerce fixtures |
| `account-lifecycle` | New UI signup, real email confirmation, initial password setup, login/logout, recovery/password change; invalid login and missing token | Verified disposable local QA, unique run/expiry, public Supabase key, local Inbucket, explicit account/disposal flags |
| `project-lifecycle` | New run-owned project persists, selects and archives with password; cancel preserves it; reference workspace remains intact | Admin credentials; Supabase URL/project ref/public key; unique run ID; `TEST_ALLOW_PROJECT_LIFECYCLE=1` |
| `roles` | Real role RPC capabilities, positive fixture existence and cross-site RLS denial, anonymous private API denial | Four distinct accounts: admin, collaborator, marketing, foreign; second site UUID; public Supabase connection |

The smoke fixtures must already exist and be visible to the configured identities.
Their names should be unique in the synthetic workspace. The storefront fixture
must be active, published/listed and visible in the tested listing. Tests do not
create fixtures in production or fabricate responses when data is missing.

Buyer read assertions use the application's merged translation catalog and the
current, settled `html[lang]` rather than assuming English. Completed empty and
populated states must match that locale; supported localized loading/error states
remain hard failures. The helper never changes the account's language preference.
The initial `qa-e2e-20261021T044246Z-11362-buyer` failure displayed the Spanish
completed-empty orders state while its old locator required English. That is a
test-language mismatch, not evidence of failed order retrieval. Tracking console
errors remain independent failures; see
[the batch-session diagnosis](EMBEDDED_APPLICATION_DIAGNOSTICS.md#tracking-batch-session-mismatch-2026-10-21).

The repaired helper completed all six Buyer read surfaces in
`repair-buyer-20261021T052814Z-72968`: the authentication setup and the one full
journey passed, with no retries, skipped steps or observed dependency failures.
Its health gate remains non-green because deployed SHA is unconfigured and the
test checkout is dirty. This run establishes the language-helper repair only;
it does not establish that the local Robots or SDK source changes are deployed.

The follow-up `repair-smoke-20261021T055449Z-2498` against the existing production
deployment was incomplete: four product checks passed, exact workspace selection
failed on a tracker console error, and the lead check did not run after the global
timeout. Authentication passed separately. The attempt includes a long execution
gap, so wall-clock duration is not useful application-performance evidence.
Do not combine this attempt with earlier runs or claim the local SDK/Robots fixes
were deployed. Its saved trace retains the real tracking `403` failure.

Local repair validation passed 584 tests in 32 relevant Jest suites and strict
transpilation/discovery of all 50 regression scenarios. After correcting extracted
component types, the final TypeScript check passed with no diagnostics; an
additional five-suite Robots run passed 56 tests. The typecheck used a temporary
incremental cache, not a production build. The extraction initially exposed four
lint errors and twelve warnings; the subsequent repair below addresses them
without disabling lint rules or E2E failure assertions.

### Local follow-up: browser state, creation lifecycle and SDK tests

Robots browser state now reconciles incoming reads in site/instance-scoped render
state instead of synchronous setter effects. Saved state and explicit URL choices
remain authoritative until reads complete. New artifact arrival selects the
intended artifact; user tab/layout changes cannot repeatedly consume `should_reload`.
A fresh visibility/manual read snapshot retains the deliberate same-timestamp
reload behavior. Fresh empty read arrays cannot cause a render loop. Persistence
remains an effect, and stale event setters cannot alter a different workspace.

Instance creation separately tracks site lifetime and current eligibility. It
rechecks authentication and eligibility before insert, ignores old-site responses
after each await, and does not cancel its own flow merely because its loading
state changes. Successful inserts still refresh/select the new instance. Avatar
results cannot overwrite a new site's state. Tests use actual React setters and
StrictMode, not delayed setter shims or disabled lint rules.

The final follow-up Jest run passed 642 tests in 38 relevant suites. Targeted
Robots lint passed with `--max-warnings=0`; all modules compile with the installed
Next SWC compiler and the final frontend TypeScript check passed. The sibling
SDK's complete suite passed 380 tests in 44 suites and its TypeScript check
passed. The prior eight chat/experiments failures are now
repaired, with additional identity-lifecycle, consent and weighted-selection cases.
These are local results; production SDK publication/deployment remains separate.

### Explicit production smoke provisioning

`scripts/e2e/provision-smoke.cjs` is a separate operator provisioning tool, not
part of the E2E runner. It authenticates with `TEST_ADMIN_EMAIL`/password and a
public `TEST_SUPABASE_ANON_KEY`, verifies the explicit backend and exact site
name/UUID, and requires owner or active admin access. Service-role access,
updates, resets, deletes and automatic insert retries are not supported.

```sh
# Read-only database inspection; optionally prepare local env values.
node scripts/e2e/provision-smoke.cjs --write-env

# Run only after reviewing the site and its workflow configuration.
node scripts/e2e/provision-smoke.cjs --apply --site-id "$TEST_SITE_ID" --ack-workflows --write-env
```

The script reads the root `.env` and `.env.local`. It requires `TEST_TARGET`, both
production origins, `TEST_SITE_NAME`, `TEST_SUPABASE_URL`,
`TEST_SUPABASE_PROJECT_REF`, `TEST_SUPABASE_ANON_KEY`, and the matching
`NEXT_PUBLIC_SUPABASE_URL`. The shell example requires exporting `TEST_SITE_ID`
or replacing it with the UUID printed by dry-run.

It plans three deterministic site-scoped records: draft `QA Smoke Content`,
contactless `QA Smoke Lead` with calls prohibited, and publicly listed
`QA Smoke Product - NOT FOR SALE` with `is_purchasable=false`. Existing marked
fixtures are verified, never overwritten. A name collision or altered fixture
fails closed. This is not paid checkout coverage.

**Production content/lead inserts trigger workflow database webhooks.** Metadata
does not disable them. Review/approve downstream automation before applying;
the acknowledgment flag records acceptance, not proof that workflows are safe.
The product is visible publicly. Nothing changes site settings or existing
customer records, but database-triggered external effects remain possible.
Insertions are sequential, not transactional: a failed run may leave preceding
fixtures. Inspect with dry-run before rerunning; never use a global reset.

`--write-env` atomically replaces only smoke configuration keys in `.env.local`,
keeping other secrets intact and mutation flags disabled. In dry-run, these are
**planned values**, not proof records exist. Buyer credentials and deployed SHA
are deliberately not fabricated. The shop segment uses the verified site UUID,
which public routing supports and which avoids name-slug ambiguity.

The equivalent `scripts/e2e/provision-smoke.sql` is an operator-only SQL Editor
script, not a migration. It pins the verified site/owner, uses the same fixture
IDs and payloads, inserts in one transaction and returns only the three synthetic
record IDs/names. Run the complete file only in the reviewed Makinari production
project. SQL Editor uses privileged database access; this is **not** proof of RLS
or user login. It does not disable triggers, and the same webhook/public-listing
warnings apply. SQL cannot update local dotenv files; the prepared env values
already match these IDs. A rerun verifies existing fixtures instead of updating
them. Any insertion or collision error rolls back all inserts in the transaction.

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

## Production smoke repair findings (2026-10-05/06)

The original content/lead failures were 15-second visibility races, not missing
fixtures. Traces from `prod-smoke-repair-20261006` include successful content
results (30 rows) and a successful lead search (one row). Fixture assertions
completed in about 21 and 17 seconds. Smoke keeps the same positive assertions
with a bounded 45-second read budget and drains actual data/body reads before
navigation. The observer follows redirected prefetch request chains, but does not
wait for speculative Next.js streams to finish. It still rejects API, application,
console and real-read failures.

Local API repairs distinguish a successfully absent optional requirement tenant
from repository errors and return nullable tenant fields only after primary
requirement authorization. A concrete missing tenant/requirement is still 404;
access failures and provider errors are not converted to empty success.

The narrow anonymous-login rerun passed its browser assertion after the observer
repair. It is partial evidence, not a green suite: missing deployment provenance
and an uncommitted test checkout still fail the runner health gate. Production
traces also contain image/session routing 404s on www, tenant-probe 404s, external
visitor tracking 403s and an embedded application 404. Local application changes
require reviewed deployment; see `PUBLIC_VISITOR_AND_IMAGE_DELIVERY.md` for the
separate commercial-host rewrite requirements. Do not suppress those errors or
claim deployed fixes from local Jest results.

The final full rerun `prod-smoke-final-repair-20261006` executed all six cases:
one passed, five failed, and the separate admin authentication setup passed.
Content/lead fixture assertions passed; remaining failures include unexpected
application/dependency errors, including a lead response-body inspection error.
Do not describe that run as healthy or merge its results with the passing narrow
anonymous-login rerun. No production fixtures were edited by the repair work.

### Follow-up cancellation and SSR repairs

The post-push run `prod-smoke-after-push-20261006-ba603eb` passed anonymous auth
and exact workspace selection but failed four other cases. A subsequent real
browser reproduction established that unsuccessful `response.text()` reads on
superseded content/lead requests carried `net::ERR_ABORTED`. The observer now
uses the same explicit-cancellation policy for response inspection and
`requestfailed`; unknown body failures, non-aborted network errors, HTTP errors
and positive fixture requirements remain failures. It never ignores an API
status just because the request was later cancelled.

The filtered `prod-read-cancel-fix-20261006` run passed content, while leads
failed only a console error from an aborted notification read. Notification
loads now carry an AbortSignal, cancel on site changes, replacement reads,
unmount and pagehide, and resume on a back-forward-cache restoration. Stale
responses cannot replace the new site's notifications; actual failures still
return errors. This app change needs deployment, unlike the local observer fix.

Public shop/marketplace/cart/book images now receive serialized SSR delivery
scope so the initial HTML and hydrated src/srcset agree on the canonical app
cache-only route for official hosts. Local/preview/custom hosts remain relative
and unscoped workspace generation is unchanged. See
`PUBLIC_VISITOR_AND_IMAGE_DELIVERY.md` and the real SSR/hydration regression tests.

The embedded preview's nurture route and external SDK segment error are
separate ownership boundaries, not fixes established by these changes. See
`EMBEDDED_APPLICATION_DIAGNOSTICS.md`. Their assertions remain enabled.

Follow-up local validation passed 507 tests in 47 suites and `npm run typecheck`.
The final `prod-followup-full-20261006` attempt against the existing deployment
was incomplete: anonymous auth passed, two public cases failed on www image
404s, and three admin cases were blocked by the password-login setup timing out.
The run is not green. Auth capture remains disabled; the login timeout is not
proof of invalid credentials or MFA. Do not bypass it or combine this incomplete
attempt with earlier filtered passes. New SSR/notification application fixes
must be deployed before a fresh complete live validation.

## Project lifecycle exception

`tests/projects/lifecycle.spec.ts` is a deterministic native Playwright test using
the Shiplight runner, like the native smoke tests. It is discovered only by its
own suite. See `specs/tests/project-lifecycle.md` for its exact safety contract.
Trace, screenshot and video recording are disabled because the archive dialog
requires an account password. Its structured attachment contains only synthetic
project identity and step outcomes. `safe-shiplight-reporter.ts` redacts environment
passwords/tokens from native Playwright step titles before the vendor serializes
them; disabling trace alone does not prevent passwords from appearing in reports.
Application initialization can create default
records, credits and optional background setup; archival retains them and does
not stop external workflows. No paid checkout, DNS or channel connection is tested.

If cleanup cannot confirm archival, the run is failed and reports the synthetic
project ID for follow-up. Never replay an ambiguous archive request or delete a
site directly. General mutation flags still cannot authorize production regression,
role-boundary or agent workflows.

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

- The 2026-10-22 read-suite repair reproduces the Leads undefined `.map` crash
  locally and fixes the segment collection returned during deferred workspace
  loading. Regression coverage uses real SWR and the actual filter dialog in
  `__tests__/leads/search-loading.test.tsx`. This is not evidence that the local
  application fix has been deployed or that the configured production lead is
  absent. Keep the persisted-sentinel assertion unchanged.
- The latest saved Content and Buyer failures share a tracking `403`: events and
  their proof disagree on session/visitor identity while site identity matches.
  The traces load the old SDK `1.965`; the already repaired sibling source passes
  its full 380-test suite but needs a separately approved build/CDN release and
  subsequent live verification. Do not weaken authorization, replace the tracker
  with a mock, or ignore console errors to obtain a green result. See
  [the read-suite diagnosis](EMBEDDED_APPLICATION_DIAGNOSTICS.md#read-suite-follow-up-2026-10-22).
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