# Production requirement harness canaries

This opt-in operational suite evaluates the **existing API requirement cron**.
It does not replace the executor, invoke a parallel agent, or call the production
cron endpoint. Creation follows the product's authenticated Supabase/RLS data path;
the normal minute cron admits the resulting requirements. It is not a browser UI E2E.

This suite is the narrow, explicitly requested exception for five synthetic
production requirements. The existing Shiplight smoke/CRUD/agent suites keep their
production mutation prohibition. Do not change `TEST_ALLOW_MUTATIONS` or
`TEST_DISPOSABLE_ENVIRONMENT` to enable this suite.

## Five short requests

| Case | Task | Independent expected result | Deadline from activation |
| --- | --- | --- | --- |
| `01-file` | Write one text file | Actual file hash/bytes match `hello harness` plus a newline | 5 minutes |
| `02-repair` | Start with subtraction, observe a failing addition assertion, fix and rerun | Failure receipt precedes a success of the same assertion; exact final source hash | 7 minutes |
| `03-continue` | Run a command that intentionally exits 7, then write a file | Exactly one exit-7 receipt, later successful work and exact file hash | 5 minutes |
| `04-resume` | Write before.txt, wait 70 seconds, read it and write after.txt | At least two cron cycles, same session/workspace, preserved before file and correct after file | 8 minutes |
| `05-plan` | Complete two existing plan/backlog steps | Original plan/step/item IDs completed with progress receipts, no replacement plan, exact files | 7 minutes |

The exact requests and expected bytes live in `scripts/harness-e2e/cases.cjs`.
Every path is below `.harness-e2e/<run-id>/`. Requests forbid pushes, deployment,
dependency installation, provisioning, external communication, or edits outside
that directory. Use an explicitly approved test repository, never a customer repo.

The evaluator checks actual persisted tool-call/result pairs and SDK file reads,
not an assistant's claim of success. A failing test is expected in cases 02/03,
not a reason to fail unless the agent cannot continue. Status alone is insufficient.
For case 02 the identical assertion may be the final invocation after a literal
source repair in the same command. The evaluator recognizes that bounded Python
heredoc shape, requiring matching working directories and a prior AssertionError;
it rejects changed assertions, trailing commands and ambiguous shell prefixes.
Case 04 also recognizes the bounded Python read/assert/write sequence executed
after the sleep in a subsequent tool call; `read_files` is not mandatory. Two
cycles, ordering, successful receipts and independent exact file hashes remain
required. Arbitrary Python programs are not inferred safe or executed locally.
The observer never runs source code on the operator machine and saves only file
hashes and byte counts, not downloaded source or environment files.

## Credentials and preflight

Node 22 and the installed dependencies of both sibling repositories are required.
No dependency install, Next build, deployment or migration is performed.

- `market-fit/.env.local`: existing `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`,
  `TEST_SUPABASE_URL`, `TEST_SUPABASE_PROJECT_REF`, `TEST_SUPABASE_ANON_KEY`,
  `TEST_SITE_ID`, `TEST_SITE_NAME`, `TEST_TARGET=production`,
  `TEST_BASE_URL=https://app.makinari.com`.
- `API/.env.local`: server-only observation credential for the **same** backend,
  plus the existing sandbox token/team/project. The API's `.vercel/project.json`
  supplies linked project IDs when missing; it contains no token. Explicit
  `HARNESS_E2E_SANDBOX_TOKEN`, `HARNESS_E2E_SANDBOX_TEAM_ID` and
  `HARNESS_E2E_SANDBOX_PROJECT_ID` can override this scope in local environment.
- `HARNESS_E2E_DEPLOYED_SHA`: independently established **API deployment** SHA,
  not the frontend source SHA. An unset value is unknown provenance, not green.

Login must verify the exact configured nonarchived site and owner/active-admin
membership before the observer client is created. All fixture writes use the
authenticated user client. Private harness session/mapping SELECTs use the
server-only observer after run/site/user identity validation; no lease or artifact
RPCs are called. Denied full artifacts stay unavailable; ACLs are never relaxed.
Costs come from the site's existing RLS-visible credit ledger, filtered by session.

```sh
# No dotenv, login or network: print exactly five cases.
npm run test:harness:e2e -- list

# Authentication + scoped reads only. Optionally persist a preflight report.
npm run test:harness:e2e -- preflight --ack-observer-service-role --run-id canary-preflight-20261014

# Offline tests of evaluator, observation, fixture/CLI safety and file verification.
npm run test:harness:unit
```

The preflight requires at least two available credits, observable billing,
deployed harness storage and an authorized sandbox read probe. Presence of the
sandbox token/team/project variables alone is not sufficient. A single filtered
SDK list request checks access without enumerating unrelated work, creating a
project, or starting a sandbox. The report distinguishes missing configuration
from an HTTP authorization failure and reports available versus required credits.
Storage availability does
not prove the deployed cron uses the new executor. An actual `agent:` cycle and
the requirement-bound session are required by the test evidence.

## Prepare and execute explicitly

Set `RUN_ID`, `SITE_ID` and `REPOSITORY_URL` in your shell to the reviewed run, site
and GitHub HTTPS `.git` URL. Never put credential-bearing URLs in these arguments.
Repository default branch is `main`; review/adapt configuration for another branch
before creating fixtures.

```sh
# Creates five non-runnable requirements and their run-owned runners, plus one plan.
npm run test:harness:e2e -- prepare --run-id "$RUN_ID" --site-id "$SITE_ID" --repository "$REPOSITORY_URL" --ack-production-canary --ack-observer-service-role

# Activates one requirement at a time; existing API cron does all agent execution.
npm run test:harness:e2e -- run --run-id "$RUN_ID" --site-id "$SITE_ID" --ack-production-canary --ack-observer-service-role

# Exact run-owned stop; does not delete evidence or change customer work.
npm run test:harness:e2e -- stop --run-id "$RUN_ID" --site-id "$SITE_ID" --ack-production-canary --ack-observer-service-role
```

No automatic rerun creates more requirements. IDs are deterministic per run and
case, collision checks verify ownership, and a manifest is saved before inserts.
Insertion is not transactional: failures can leave inactive fixtures. Inspect a
partial run; do not force reuse. A run may be activated only once. Retain fixtures
for diagnosis; record deletion is deliberately not automated.

## Local observer / cron

### Diagnostic execution when the independent file oracle is unavailable

An explicitly acknowledged `--diagnostic-no-files` on both `prepare` and `run`
allows collection of production cron/session/tool evidence when Vercel read access
is unavailable. Funding, identity, ownership, timeouts, cost monitoring and
fail-fast behavior remain required. No SDK file reads are attempted in this mode.
Reports always keep `healthGreen=false` and `behaviorPassed=false` and identify
`independentFileVerification=unavailable`. Diagnostic completion is not a file
verification pass. Other failed checks are never ignored.

The 2026-10-14 run `canary-live-20261014-0425` uses this mode after funding was
confirmed, using the repository already bound to the synthetic test site's
existing requirements. This is distinct from the earlier blocked preflight.
It created five fixtures and activated the first one. Production created a session
in 46.368 seconds, then failed workspace opening in three cycles with zero model
turns/tool calls and zero recorded model credits. The first case timed out after
309.488 seconds including polling latency; the supervisor confirmed its stop and
did not activate the other four. The persisted generic provider error does not
establish that its cause is the same HTTP 403 observed locally. A local API repair
now preserves authorization/billing classifications and pauses operator-required
workspace failures; it was tested but not deployed by this run.

The explicit retry `canary-retry-20261014-0438` also stopped on its first case:
29.045 seconds to session creation, three workspace-open failures, no model/tool
calls, zero recorded model credits, and timeout at 309.539 seconds including
polling. The first requirement is confirmed blocked with no active lease; the
other four remain inactive. The generic production message still does not prove
an HTTP cause. Subsequent offline testing with the installed Sandbox SDK exposed
a separate non-HTTP OIDC-context failure path, now classified by the local API
repair. Deployment and production confirmation of that repair remain outstanding.

```sh
# One sample, read-only, safe to invoke from an operator-managed local cron.
npm run test:harness:cron -- --run-id "$RUN_ID"

# Bounded local polling every 15 seconds, read-only.
npm run test:harness:observe -- --run-id "$RUN_ID" --watch
```

`scripts/harness-e2e/cron.cjs` is a local cron entrypoint, **not a new production
Vercel cron**. No OS schedule is installed automatically. One process owns the
run-local lock; overlapping samplers fail closed. Do not run it simultaneously
with `run`, which already observes each tick. After a killed process, check its
PID and only then remove the stale `.lock` manually. Read-only observation never
activates, resumes or cancels requirements or sandboxes.

## Evidence and interpretation

Private, ignored files under `agent-test-reports/harness/<run-id>/`:

- `run.json`: exact five IDs, original plan/runner IDs, configured backend, source
  SHAs and requested API deployment SHA. No credentials.
- `observations.json`: timestamped scoped statuses, sanitized tool transcript,
  cycle/session/workspace IDs, counters, ledger cost and file hashes.
- `report.json`: individual checks and numeric evidence, startup/completion times,
  tool/failure counts, cycles, active time, tokens, credits and aggregate verdict.

Files are created owner-only, and reports are written atomically. Raw provider/DB
errors are suppressed. Missing/truncated evidence is `blocked`, never a passed
skip. Five behavior passes with unknown/dirty/mismatched provenance still have
`healthGreen=false`. Frontend test source and API deployment are separate SHAs.
Evidence storage is bounded to 150 samples per case and 16 MiB per run; exceeding
either limit stops observation rather than silently truncating the audit trail.

## Limits and watchdog

The supervisor checks every 15 seconds, stops on first failure, and never activates
remaining tests after an error. Default thresholds are two **aggregate observed**
credits and 25 minutes per run; individual deadlines are in the table. On stop or
SIGINT/SIGTERM, active run-owned requirements are set to `blocked`; host ownership
checks prevent subsequent dispatch. Already running external operations may finish.

These are polling watchdogs, **not atomic spending ceilings or an external kill
switch**. Overshoot is possible, including charges between observations. SIGKILL,
operator-machine loss or an unavailable stop API can leave work active under the
harness's normal budgets. The read-only cron does not stop it. Monitor the private
report's `stopConfirmed` and use explicit `stop` after interruption. Sandbox costs
are not guaranteed to be represented by the model-credit ledger.

No test can enforce the prompt-only no-push/provision rule before a misbehaving
agent calls a tool; the evaluator detects observable violations afterward. A
scoped/disposable repository and funded synthetic account are still required.

## Current production preflight

The execution attempt on 2026-10-14 confirmed successful account/site authorization
and readable session/mapping storage. Available credits were **0.4**, below the
two-credit minimum. Both the deployment lookup and the actual SDK sandbox-read
probe returned **HTTP 403**. The earlier presence-only sandbox check was therefore
a false positive and has been replaced with a real read authorization probe.

No test requirements were created or activated, no credits were added, and no
production code, migrations or permissions were changed. The API deployment SHA
remains unverified. All five production scenarios are **blocked**, not passed or
failed agent executions. The attempt and local validation evidence are recorded in
`agent-test-reports/harness/canary-attempt-20261014-2/`.

Before another run, fund the configured synthetic site, supply a token authorized
for the intended Vercel sandbox project, verify the API deployment SHA and select
the approved repository explicitly. Do not bypass either preflight failure to
force a result.