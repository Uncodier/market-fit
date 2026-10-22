# Production Shiplight execution — 2026-10-22 UTC

## Latest rerun — 04:40–04:43 UTC

| Exact run ID | Result excluding authentication setup |
| --- | --- |
| `rerun-20261022T044016Z-47905-smoke` | FAIL: 4 passed, 2 failed of 6 |
| `rerun-20261022T044016Z-47905-buyer` | FAIL: 0 passed, 1 failed |
| `rerun-20261022T044016Z-47905-project-lifecycle` | PASS: 1 passed |

All three authentication setups passed. Content and Leads smoke cases still
recorded the visitor-tracking HTTP 403. Leads also recorded the undefined `.map`
runtime error and did not render the configured sentinel. Buyer completed its
page-read steps but failed the final strict observation on the same tracking 403.
Do not substitute the earlier buyer PASS for this failing rerun.

The rerun created and password-archived project
`34b892e3-6abb-4909-88f6-da8d9f927e85`; archival was confirmed and fallback cleanup
was not used. All three runs were complete, unfiltered, with no retry/skipped cases.
Release provenance remains incomplete, so `healthGreen` remains false even for
the functional lifecycle PASS.

Jest passed again: 23 suites / 519 tests. Strict regression validation
`rerun-regression-validate-20261022T044024Z-48007` transpiled/discovered 50 cases
without errors or warnings; general regression was not executed in production.
All three fresh reports' vendor JSON, HTML and Playwright JSON were checked for
the configured admin/buyer passwords; none were found. Files were created with
owner-only permissions. No deployment, migration or report publication occurred.

## Results

| Suite / exact run | Result | Scope |
| --- | --- | --- |
| `prod-readonly-20261022T040243Z-594a1d39-smoke` | FAIL: 2 passed, 4 failed; authentication passed | Full six-case production read-only suite |
| `prod-readonly-20261022T040243Z-594a1d39-buyer` | PASS: 1 passed; authentication passed | Full production buyer read journey |
| `shiplight-project-lifecycle-safe-20261022T043614Z` | PASS: 1 passed; authentication passed | Full isolated project lifecycle |
| `shiplight-regression-validate-20261022T040455Z` | PASS: 50 YAML files transpiled strictly; 50 cases discovered | Validation only, not live regression |

Reports are local under `shiplight-report/<exact-run-id>/run-summary.json`.
No report was published, no production build/deployment/migration was performed.
Live provenance is incomplete: the test working tree is modified and no deployed
SHA was supplied. Functional PASS is not a green release-health certification;
the machine summaries correctly keep `healthGreen: false`.

Local validation passed: `npm test -- --runInBand __tests__/e2e
__tests__/api/site-archive.test.ts __tests__/api/site-archive-migration.test.ts`
reported 23 suites and 519 tests passing. `npm run typecheck`, targeted ESLint on
all authored/modified test and runner files, and `git diff --check` also passed.

## Production findings

All four smoke failures recorded HTTP 403 at
`https://backend.makinari.com/api/visitors/track-batch`. Public product, workspace
selection and content failed strict dependency/console checks even though their
main read assertions completed. Leads also recorded
`TypeError: Cannot read properties of undefined (reading 'map')` and did not display
the configured sentinel within 45 seconds. Missing lead display alone does not
prove a missing database fixture; the runtime error is separately observed.
No assertion was weakened and no application fix was deployed.

## Project evidence

Final synthetic project ID: `e919eb98-d9a7-4379-83d7-1862ff2468f7`.
The new project persisted, appeared in a fresh chooser, selected with matching
cookie/localStorage, survived cancellation, and archived through the password
dialog with an HTTP success. User-scoped RLS reads and a fresh chooser excluded it
afterward; the reference workspace remained selectable. Fallback cleanup was not
used. Archived synthetic records/defaults are retained, not physically deleted.

Earlier attempts are not merged into the passing result:

- `shiplight-project-lifecycle-20261022T040607Z`: failed before creation because the
  browser uses chunked `sb-db-auth-token` cookies rather than the direct backend
  cookie name. Fixed with issuer-validated session binding and a regression test.
- `shiplight-project-lifecycle-20261022T040846Z`: failed before creation because the
  deployed nested fields have visible labels but no associated accessible names.
  Real browser inspection confirmed placeholders; tests now use those actual hooks.
- `shiplight-project-lifecycle-20261022T041032Z`: creation and archival succeeded;
  final storage verification raced document replacement. Fixed by waiting for the
  archive-driven `/projects` navigation before reading storage.

## Reporter security

The installed vendor reporter serialized native Playwright `Fill` step titles
containing account passwords even with tracing/video/screenshots disabled.
Earlier lifecycle and read-only suite artifacts are credential-bearing: their
permissions were restricted to owner-only access, and they were not published.
Do not upload or share them. Rotate the affected test credentials if these artifacts
were accessible outside the authorized operator account.

`tests/support/safe-shiplight-reporter.ts` now sanitizes native step titles, errors
and retained output before vendor serialization. The final lifecycle's
`report-data.json`, HTML and `playwright.json` were checked programmatically and
none contained the configured admin password. This is not a retroactive claim
that old reports, traces or arbitrary application payloads are safe.

## Changes and boundaries

- Shiplight updated `0.1.104` → `0.1.106`; npm dependency and lockfile are modified.
  The automatic skill refresh also updated its own guidance/skill lock.
- Added native `tests/projects/lifecycle.spec.ts`, isolated suite discovery,
  explicit lifecycle consent, public-key/session backend binding and exact-ID
  archival containment. This follows the repository's native smoke convention;
  Shiplight MCP was unavailable, so no guessed YAML was authored.
- Production regression, roles and agent mutation prohibitions remain intact.
  Those suites were not run live against production.
- Cleanup never adopts a marker match without the actual creation-response ID,
  never deletes records and never follows redirects or replays an ambiguous archive.
- No paid subscription, checkout, channel connection or DNS operation was requested
  by the test. Normal creation can initialize defaults/credits/background setup;
  archival does not terminate external workflows.