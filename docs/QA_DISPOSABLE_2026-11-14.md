# Disposable QA — 2026-11-14

## Scope and safety

This is a partial execution record, not a release certificate. The requested
scope is the full local Jest battery, all nine E2E suites, additional missing
browser scenarios, application repairs and refreshed module maturation evidence.
Existing assertions must not be weakened to make failures pass.

Docker is unavailable on the execution Mac: its CLI symlink points to a missing
Docker application. The user explicitly approved an Azure Linux Standard_D4as_v5
in West US 2 for up to four hours after reviewing the current retail compute
price of USD 0.172/hour, plus disk, IP, Automation and traffic charges.

- Exact QA ID: `qa-1794707562780-19f73f1e`.
- Exact resource group: `rg-makinari-qa-20261115015719-2948f`.
- Expiry: `2026-11-15T05:57:19.694466+00:00`.
- External expiration authorization was verified. The installer subsequently
  confirmed deletion; independent `az group exists` returned `false` and installer
  status reported `deleted-confirmed`, `groupExists=false`, `qaReady=false`.
- VM creation and host-tool installation succeeded. Application bootstrap failed:
  Supabase CLI 3.1.0 rejects `[inbucket]` and requires `[local_smtp]`. A temporary
  `supabase init` on that exact VM confirmed the new section and unchanged mail UI
  port 54324. No shared schema or installer source was changed to bypass the error.
  **No live E2E suite ran.** No replacement VM or expiry extension was created.

The initial packaging attempt stopped before creating resources because authored
changes made the frontend checkout dirty. The subsequent attempt used private
clean local clones of the current commits, without committing or discarding work:

| Service | Base revision |
|---|---|
| Frontend | `03639db08166f14d9a55145d4eb5bb7180c643ed` |
| API | `e0fab5997ff0a9f20beaed7bfe6f6f4dc0af5a98` |
| Workflows | `a9e46fd0521778d7710572130042f400de62c6aa` |

Bootstrap uses the sibling schema repository's reviewed local-only bootstrap,
not a production database clone. Any subsequent reviewed overlay must be recorded
separately; a base revision is not proof that overlay code ran.

## Checks and new coverage

- All nine suites passed offline discovery/strict validation: smoke, regression,
  buyer, roles, project-lifecycle, account-lifecycle, procurement, subsystems and
  records. Exact offline IDs: `qa-audit-20261114-<suite>`. These are **not browser
  passes** and do not establish working authentication, email, RLS or providers.
- Full initial Jest execution: **1,730 suites; 1,677 passed, 53 failed**.
  **21,012 tests passed, 98 failed, 5 skipped** (21,115 total). The initial run
  overlapped repairs; later discovery also includes newly added test files.
- Post-repair rerun of all 53 initially failed suites: **6 passed, 47 failed**;
  **325 tests passed, 77 failed** (402 total). This is not a second full green run.
  See the [exact unresolved source inventory](../specs/qa-disposable/jest-failures-20261114.md).
- New deterministic native E2E cases cover cancelling a POS customer draft
  without creating a lead or losing the selected customer, and cancelling Record
  deletion while preserving populated data after navigation/reload. See
  [subsystems](../specs/tests/subsystems.md) and [records](../specs/tests/records.md).
- Four offline contracts for the new native cases and five locale cases for
  custom procurement value preservation passed (9/9). Source contracts do not
  substitute for the new browser scenarios.
- Existing mobile primary button behavior passed 13/13 Jest cases.
- Harness unit battery: 10 suites / 261 tests passed. Six specialized offline
  configurations passed: catalog, pricing, instance-assets, OpenRouter, Stripe and
  top-up UI. The robot-runner configuration failed with no tests found because its
  single configured test path is absent; no `--passWithNoTests` was added.
- Full lint failed on existing findings. Full typecheck failed on the pre-existing
  PostCSS callback return type in `mobile-primary-buttons.test.tsx:176`. The runtime
  suite passes; its assertions and callback were not altered to hide the failure.

## Application repair

The existing portal localization regression proved that a custom credential type
was changed from `custom_business_type` to humanized text. The presentation helper
now translates only catalogued application values (with English catalog fallback)
and preserves unknown user-authored values verbatim. The existing portal suite
passed after this application change; its assertions were unchanged.

Other failures remain unresolved. Successful focused reruns must be distinguished
from full-suite and browser evidence; reviewed obsolete expectations do not imply
that every remaining failure is a test defect.

Procurement demo/account/supplier surfaces now use the existing localization
catalogs in English, Spanish, French, German and Japanese. All 76 hardcoded JSX
scanner findings were repaired in application code, not allowlisted in tests.
Quotation money now uses the active locale. The expanded targeted localization
battery passed 47 tests; an independent repair/coverage rerun passed 38 tests.
The final combined repaired-family battery passed **12 suites / 93 tests**.
Additional demo checks passed **4 suites / 37 tests** after verifying both actual
proposal preview and the unknown-publication demo branch. All modified TypeScript
files passed targeted ESLint; existing test files were not edited.

Deals now rejects failed/malformed reads instead of showing a successful empty
state, presents site/loading/error states with retry, retains same-site records
during background refresh and copies cached arrays before sorting. All five
Deals suites passed 39 tests, including all 13 existing loading cases.
Voice-agent settings retain disabled visible labels while voice options load.
Critical site-setup notices fall back to catalogued English when their translation
is absent. Three added feedback regressions verify missing/blank translation and
parameter interpolation. Required context providers remain strict: experimental
provider bypasses were reviewed and reverted, not retained to satisfy mocks.

Some existing failures are contradictory/outdated expectations or missing fixture
providers, not reproduced production defects: canonical Customers/root breadcrumb
behavior, demo reentry, responsive duplicated DOM controls in jsdom, missing
LayoutProvider, fake UUID submission IDs, a missing mocked `.not` method, direct
`jsdom` imports without a direct dependency, and email tests expecting stale
whole-array rewrites against the canonical reread contract. These remain failures;
application authorization/persistence and existing tests were not weakened.

## Maturation

The module snapshot was refreshed to 2026-11-14 using the existing generator and
file-level declaration attribution. Historical database counts retain their
2026-11-05 observation timestamp; no fresh production query was made. Static
authored E2E counts are not passes or coverage percentages. The 91-row generator
check and six existing maturation-contract cases passed after the refresh.

## Evidence and remaining gates

Machine logs and Jest JSON are private under `/tmp/market-fit-qa-20261114` on the
execution host; offline E2E summaries use the exact IDs above in the repository's
ignored report directory. Do not publish auth state, email links or raw provider
logs. No production build, deployment, remote production migration, commit or
push is authorized by this run.

Live completion requires an installer compatibility repair and a separately
approved replacement QA. The installer currently does not expose the records
suite, and evidence export also requires explicit allowlisting of the new native
spec paths. Those gates are not bypassed by raw runner calls or successful offline
discovery. The exact failed QA has been destroyed and absence verified.

Final local verification: all changed-code ESLint checks and `git diff --check`
passed; all touched files remain below 500 lines; no existing test file was edited.
The final 91-row maturation generator/check and six maturation contracts passed.
Final TypeScript check retains only the existing PostCSS test callback error at
`mobile-primary-buttons.test.tsx:176`; no new application TypeScript error remains.

The requested complete live QA is **not completed**. Remaining gates are the
installer compatibility repair, safe supported-suite/evidence provisioning, a
separately approved replacement QA, live execution and resolution of the 47
remaining failed Jest suites. No all-tests-pass claim, deployment or release
certification is justified by this partial run.