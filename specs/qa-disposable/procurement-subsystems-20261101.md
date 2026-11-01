# Fresh Azure QA rerun — 2026-11-01

## Target and candidate

- QA ID: `qa-1793492208249-e162e226`; new disposable Linux D4as_v5 in West US 2.
- Infrastructure cost explicitly approved; four-hour external expiry configured
  for `2026-11-01T04:17:33.857820+00:00`. The environment was deleted earlier.
- Frontend: `2fc01fb3846ff491f0ca84d5a97e3be646cd56be`.
- API: `55a852b766906f83721355dc36f85238c451b8c3`.
- Workflows: `e3c2b117a85eae76e935f410091e0b7472bed34e`.

Services used clean private HEAD snapshots plus the recorded native-test overlay.
Unrelated uncommitted application/printing/worker changes were excluded, not
committed or deployed. The installer used its reviewed current working tree.
Test file hashes and exact service revisions remain in the private QA artifacts.

## Fresh installation

All **184 bootstrap migrations** applied from scratch, including
`20261030230000_procurement_storage_admission.sql`. No separate repair was needed
after installation. Frontend `/auth` and API `/api/status` returned HTTP 200 at
00:29 UTC. The installer provisioned synthetic QA identities/data and the exact
installed Playwright Chromium revision. The authenticated owner/site binding was
verified before enabling this QA's tender portal through its real API.

No production database, credentials, Storage objects or configuration were used
for execution. Browser origins were loopback on the Azure VM.

## Full browser results

| Suite | Exact run ID | Passed | Failed / skipped / retries | Scope |
|---|---|---:|---|---|
| Subsystems | `qa-1793492208249-e162e226-subsystems-41dd8b16` | 2/2 | 0 / 0 / 0 | Full selected suite |
| Procurement | `qa-1793492208249-e162e226-procurement-60208b71` | 9/9 | 0 / 0 / 0 | Full selected suite |

Both runs had real admin login setup, complete results, no missing/unexpected
cases and allowlisted evidence extraction `ok`. No failed run was automatically
retried; these are new independently identified executions.

Covered behaviors are unchanged from the documented
[procurement matrix](../tests/procurement.md) and
[two cross-screen journeys](../tests/subsystems.md). This confirms the prior
corrections work on a fresh QA, including PDF/credential upload, private sharing,
published amendments and the real-clock award/order/non-stock receipt flow.

The clean-Git provenance gate still reports `healthGreen=false` because authored
tests ran as an uncommitted overlay over service snapshots. Browser assertions
passed; this is not a claim that the new tests/SQL are published or deployed on
production. The broader preproduction edge-case backlog and dependency-observation
limitations remain in [the audit](../e2e-coverage-gaps/preproduction-20261031.md).

## Local checks

- Four focused Jest suites: **71 tests passed**, including Storage admission SQL.
- Installer/evidence: **57 tests passed** in two suites.
- Schema validator: 184 migrations / 39 upgrades, plus **six tests passed**.
- Full frontend typecheck and targeted test/helper ESLint passed.
- Discovery validated all nine procurement scenarios without live execution.

## Evidence and cleanup

Safe per-case outcomes/source locations and exact-run summaries were exported
before destruction; extraction had no errors. Raw authenticated traces, fixture
credentials and provider configuration remain private and were not published.

The installer verified exact QA deletion at **00:45:45 UTC**. Follow-up installer
status reported `deleted-confirmed` and `groupExists=false`; independent Azure
`az group exists` also returned `false`. No resources remain for this QA.

No application repair, remote production migration, commit, push or production
build was performed in this rerun. Only this report was added to the application
working tree; existing unrelated changes were preserved.