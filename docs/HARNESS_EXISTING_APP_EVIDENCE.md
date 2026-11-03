# Existing-app requirement evidence (additive, offline)

This is **not a live E2E result**, not a new executor, and not integrated with the
five synthetic production canaries. The existing `run.cjs`, `cases.cjs`,
`evaluate.cjs`, fixtures, observer and npm scripts are unchanged. New entry points:

- [`existing-app-cases.cjs`](../scripts/harness-e2e/existing-app-cases.cjs): three synthetic requirement
  archetypes: landing polish preserving branding/prices, cart bug repair, and a
  category filter extending an existing catalog.
- [`existing-app-evidence.cjs`](../scripts/harness-e2e/existing-app-evidence.cjs): pure `evaluateExistingApp(bundle)`
  and canonical `sourceTreeDigest(files)` helpers.
- [`existing-app-evaluate-cli.cjs`](../scripts/harness-e2e/existing-app-evaluate-cli.cjs): offline JSON evaluation.
- `__tests__/harness-e2e/existing-app-evidence.test.cjs`: offline regressions and
  synthetic bundle construction demonstrating every required input field.
Read-only DB inspection found an applied command and a completed submitting action,
but no harness session mapping or recent execution evidence. The earlier
`action_unfinished` diagnostic referred to the submitting turn, not the final state.
The installed scheduler's September creation-date cutoff excludes the April-created
app despite its November update. This does not establish source edits, cron completion
or working behavior; do not replay the command or mark it successful.
turn; do not infer a permanent blocker, replay the command, or mark it successful.
No customer text, IDs, credentials or DB records are copied into these cases.
All three cases retain the actual existing-app DB type `develop`; `changeKind`
separately describes design, bug or feature intent. The evaluator checks the DB
type before/after; it must not be overwritten to fit an archetype.

A separate coordinating read-only DB inspection subsequently reported that the
trusted action completed and the command was applied, but no requirement/session
mapping existed. That still fails this contract. It also reported a scheduler
creation-date filter excluding an old existing requirement; this evaluator imposes
no such cutoff. Those DB findings were not queried or independently validated by
this offline implementation; see the separate API handoff investigation.

## Intended workflow and collection prerequisites

1. Obtain explicit approval for a disposable, existing app and authenticated test
   user/site. Pin app/repository identity, existing requirement, expected origin
   assistant instance, and separate cron runner instance. Reject another tenant,
   customer repository or implicit production environment. This work authorizes
   neither paid calls nor remote mutations.
2. Agree an exact source inventory including untracked files, protected files
   (brand assets and commercial data), and allowed target edits. Read the existing
   source independently **before** sending the request. Do not seed runnable
   requirements, alter prices, change cron gates, or substitute a replacement app.
3. Install/pin a trusted **read-only** verifier outside the agent-writable app before
   the action. Pin its code SHA-256 and expected assertions. Run it on the baseline:
   preservation must pass and at least one requested change must demonstrably fail.
   Choose a disposable fixture that exposes the gap; do not introduce a bug into
   customer code. Baseline probes cover the same assertions as final probes.
4. Submit the catalog request via the existing interactive assistant, once. Record
   the external action identity, trusted actor, submitted/completed timestamps,
   actual persisted tool call/result pair and resulting requirement action revision.
   The tool queues the command during the turn; cron applies it after the turn
   completes. An applied command is still not proof of app execution.
   HTTP/SSE acceptance, text acknowledgement, or instructions update alone are intake.
5. Observe the normal cron, without forcing or invoking it. Resolve the persisted
   requirement-to-session mapping. Collect cycle, runner, workspace and terminal
   session/requirement state for **this action and revision**, after the submitting
   action finishes. A missing mapping means no proven cron execution; do not reuse
   a prior session. Current existing-app DB observation with no mapping is not a pass.
6. After terminal execution, independently enumerate/read the full agreed source
   scope, hash raw bytes, and run the pinned verifier on that exact tree. No agent
   tool claim, transcript stdout, old receipt, suspended-workspace read or stale
   deployment substitutes for fresh evidence. Do not resume a VM to obtain evidence.
7. Normalize these reads into the v1 bundle below. Keep private artifacts outside
   Git with restricted permissions; reports contain no raw input/IDs/text. Collection
   failure or truncation must set `complete: false` or a nonempty `errors` array.

No live collector for this full contract is implemented here. The existing observer
requires synthetic harness markers and does not collect external actions/revisions,
full baseline manifests or independent application probes. Do not feed it directly
to this evaluator or relax its marker checks. A handoff-only observer may supply
partial diagnostics, but cannot manufacture a passing bundle.

## Explicit v1 bundle contract

All timestamps are UTC ISO strings with seconds and optional three-digit
milliseconds. All digests are lowercase 64-hex SHA-256. IDs are nonempty opaque
strings used for equality only, never printed. The caller/collector is a trusted
boundary: JSON provenance labels are not cryptographic authentication. This pure
function validates consistency; it cannot prove that fabricated input is authentic.

Top level:

- `schemaVersion: 1`, `complete: true`, `errors: []`, `observedAt` (fixed observation
  time, not an implicit evaluator clock).
- `requirementBaseline`: identity fields, `requirementType: develop`, original
  `createdAt`, pre-action `observedAt`, nonnegative integer
  `externalUserActionRevision`. Existing requirements may be old; there is no
  creation-date cutoff. The original creation timestamp must remain unchanged.
- `contract`: `caseId`, `runId`, `siteId`, `userId`, `appId`, `repositoryId`,
  `requirementId`, `actionId`, `sessionId`, `originInstanceId`, `runnerInstanceId`,
  `collectorId`, `verifierId`, `verifierSha256`, `requestSha256`, `deadlineSeconds`
  (positive integer, at most 3600), `allowedChangePaths`, `targetSourcePaths`,
  `protectedPaths`. Request hash is SHA-256 of the exact catalog request including
  its safety suffix, UTF-8, without an added newline. Collect exact revision evidence
  rather than treating any change to instructions as a match. Hash the submitted
  user request, **not** rewritten stored instructions or README content. A reviewed
  adapter must prove the command/action link to this submitted request.
  Resolve `sessionId` after cron admission; never invent it at intake.

Identity fields `runId/siteId/userId/appId/repositoryId/requirementId` are repeated
on every evidence record. **Bound** records additionally repeat
`actionId/sessionId/requestSha256`. These are normalized correlation fields; do
not pretend they all exist as columns on every product table. A collector must
establish joins from actual persisted identities and revision provenance.

Required records:

| Record | Additional fields beyond identity/binding |
| --- | --- |
| `action` (bound) | `origin: interactive-assistant`, `actor: external-user`, `instanceId` matching origin instance, `status: completed`, `submittedAt`, `completedAt` |
| `persistedRequest` (bound) | `origin: assistant-tool`, `operation: requirements.update`, `state: applied`, `appliedAt` after turn completion, unchanged `createdAt`, `requirementType: develop`, increased `externalUserActionRevision`, `lastExternalUserActionId` matching action |
| `persistenceReceipt.call` (bound) | nonempty `id`, `tool: requirements`, `operation: update`, `at` |
| `persistenceReceipt.result` (bound) | matching `callId`, `ok: true`, `state: queued`, `at` before turn completion |
| `mapping` (bound) | `origin: persisted-requirement-run`, matching `runnerInstanceId`, fresh `observedAt` |
| `execution` (bound) | `origin: requirement-cron`, runner `instanceId`, nonempty `cycleId/workspaceId`, `status: completed`, `requirementStatus: on-review` or `done`, matching `externalUserActionRevision`, `startedAt` at/after command application and strictly after handoff, `completedAt` |
| `baseline` (identity only) | source snapshot captured before external action |
| `finalSource` (bound) | source snapshot captured after cron completion, matching `workspaceId` |

Snapshots contain `origin: independent-source-read`, matching `collectorId`,
`complete: true`, `symlinksAbsent: true`, `capturedAt`, `files`, `treeSha256`.
`files` is a complete nonempty manifest of `{ path, sha256, bytes }` with unique
repository-relative paths and nonnegative integer byte counts. No absolute paths,
parent traversal, backslashes, symlinks or raw contents. Compute `treeSha256` using
`sourceTreeDigest(files)` (canonical sorted JSON triples, not Git's tree hash).
At least one **existing** target file must change content and remain nonempty;
receipt-only additions, instruction-only edits, unchanged files and forbidden edits
fail. Every protected path must exist unchanged in both inventories.

`verifications` has exactly two bound records, `phase: baseline` and `phase: final`,
with distinct nonempty `id`, `origin: independent-functional-verifier`, matching
`verifierId/verifierSha256`, nonempty artifact SHA-256, matching snapshot
`treeSha256`, `complete: true`, `startedAt/completedAt`, and `checks`.
Each check is `{ id, assertions, failures }`; counts are integers, assertions > 0,
0 <= failures <= assertions. Include every catalog change/preservation check exactly
once. Baseline preservation passes; at least one change check fails. Final checks
all pass. A `passed` boolean, agent statement or exit code alone is insufficient.
Final probes must start after the final source read and finish by `observedAt`.

Pin the verifier **before** sending the request and protect its code/assertions from
agent edits. Artifact hashes reference separately retained real assertion evidence,
not assistant-generated summaries. Confirm that no edits occur between the source
snapshot and probe (read-only clone or equivalent isolation). Never use weak checks
that only search source text or echo a success marker.

### Functional oracle obligations

- Landing: compare mobile viewport overflow/layout measurements and independently
  reviewed hero/plan hierarchy against baseline; exercise focus/activation; compare
  logo/name/colors, copy, price/period tuples and CTA target. Subjective polish needs
  a reviewed rubric/artifact, not an agent's opinion or screenshot existence.
- Repair: exercise real cart state via UI; calculate totals independently from
  fixed baseline item prices for increase/decrease/removal, verify persistence,
  currency/rounding and unchanged checkout destination. No mocked successful API.
- Feature: select real data categories, compare exact item sets, restore All,
  exercise empty fixture/keyboard behavior, item navigation and existing cart actions.
  Existing routes and price/brand data remain checked against baseline.

## Offline commands and outputs

From `/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit`:

```bash
PATH=/opt/homebrew/bin:$PATH node node_modules/jest/bin/jest.js --config jest.harness-e2e.config.cjs --runInBand
PATH=/opt/homebrew/bin:$PATH node scripts/harness-e2e/existing-app-evaluate-cli.cjs /absolute/private/evidence.json
```

The CLI reads one absolute JSON path, capped at 4 MiB, and writes a sanitized report
to stdout. Exit 0 only when **all** checks pass; every failed, incomplete, malformed,
oversized or unreadable input exits 1. No dotenv, auth or live runner is imported.
The report contains only fixed case/check labels, booleans and aggregate counts.
`blocked` denotes invalid/incomplete evidence; `failed` means a supplied complete
bundle does not prove the contract, **not** a claim of an observed agent failure.

## Integration proposal (not enabled)

Keep a separately selected existing-app suite rather than extending the five-case
runner's assumptions or health summary. Review an authenticated assistant-intake
adapter and a read-only collector for the correlation joins above. Resolve original
vs runner instances explicitly; retain read-only diagnostics for missing mapping.
Add a trusted pinned browser/functional verifier, private artifacts and exact-run
reports. Require explicit environment/paid budget approval before any live run;
finish the submitting turn before expecting cron admission. Missing capability
must block, never trigger automatic replay, seeding, direct execution or remote
DB repairs. Only after this integration and a reviewed live collection can the
suite establish realistic existing-app E2E success.

Repo guidance references `docs/SECRET_SCANNING.md`, but that file was absent during
this inspection. Credential regressions still generate synthetic values at runtime
with `node:crypto`, use URL setters on a reserved test host, and assert every value
is absent from reports. No secret detector is disabled.

### Validation performed

The full offline harness Jest config passed: **10 suites, 261 tests**. Targeted
ESLint passed for the three new CJS modules and new regression suite; `git diff
--check` passed. An initial new test had a Jest `test.each` empty-array callback
timeout; its argument table was corrected and the full suite rerun successfully.
No live assistant/browser runner, paid canary, remote DB mutation, deployment or
production build was run. The CLI only evaluates externally collected bundles;
automated live assistant intake and full collection remain proposed integration.