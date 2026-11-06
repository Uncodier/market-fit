# Complementary module read coverage — 2026-11-06

## Scope and safety

Added 15 native Playwright declarations beyond the earlier two balance tests:
two Visits tests, eleven workspace module tests and two personal-account tests.
The smoke suite now discovers 23 product cases plus one authentication setup.
These are authored counts, not a module-wide success certificate.

The cases exercise Visits identity gates, Suppliers and Purchase Requests search,
Approvals status filters, Procurement Rules and Inventory Minimums filters,
Assets type tabs, Costs reports, Team/Company/Calendar settings, Procurement
Settings, account-wide search and personal credential reads.

Only existing dedicated test credentials/workspace are used. No visit is
submitted; no decision, payment, invitation, upload, archival, settings save or
business-record mutation is requested. The deployed sidebar may automatically
persist navigation shortcuts, and application telemetry still runs. Tests do not
disable that behavior, intercept backend responses or ignore console failures.
Production CRUD remains prohibited by the existing environment guards.

## Local repairs

- Visits identity labels now associate with unique inputs using React `useId`.
  Jest checks accessible names, invalid email state and multiple form instances.
- DynamicShortcuts no longer saves prepared hydration back to the database or
  resubmits identical scoped content while a write is pending. Actual component
  tests cover StrictMode, pending writes and scope transitions. Genuine changes
  still save, and real errors remain visible. This reduces redundant writes; it
  does not guarantee durable completion of writes across hard navigation.

Neither repair is deployed. Production results concern the existing deployment;
no deployed SHA was configured and no deployment equivalence is claimed.

## Evidence and known blockers

Run artifacts are private local files under `shiplight-report/<run-id>/` and
`test-results/<run-id>/`. Each run's `run-summary.json` is authoritative. Traces
may contain authenticated data; do not upload raw artifacts or credentials.

- `prod-visits-live-20261106-172301`: kiosk/empty identity passed; contact
  validation failed the read-completion gate with outstanding requests.
- `prod-visits-retest-20261106-172541`: contact UI assertions completed but the
  strict observer failed on console errors. The trace records tracking `403`.
- `prod-module-reads-20261106-172335`: first expanded workspace/account batch.
  Two product cases passed and nine failed (authentication passed separately).
  Purchase Requests and Procurement Rules passed. Initial Suppliers/Approvals
  selectors needed correction; account search incorrectly counted Next's route
  announcement as an error alert. These test issues were corrected without
  disabling the application/dependency observer.
- `prod-locator-retest-20261106-172741`: corrected Suppliers, Approvals and account
  search journeys completed UI assertions, but all three still failed strict
  dependency observation. Their initial selector failures are not product bugs.
- Costs initially expected a hidden embedded report title absent in production;
  the test now checks the named tabpanel and its visible Costs heading instead.
- `prod-costs-retest-20261106-172857`: corrected Costs summary/categories journey
  completed its UI assertions; strict observation still failed on a console error.
- Across the final results for these 15 newly authored product cases: three
  passed (Visits empty identity, Purchase Requests, Procurement Rules), twelve
  failed. Authentication passed separately and is excluded from those counts.
  No skips are counted as success. These are partial runs, not full smoke health.
- `prod-added-settings-20261106-172617`: both Calendar and Procurement Settings
  UI journeys completed, but strict dependency checks failed. Procurement
  Settings additionally recorded a failed `/api/notifications` request.
- Tracking `403` responses from `/api/visitors/track-batch` recur across routes.
  Earlier tracking deployment blockers are documented in `E2E_TESTING.md`.
  This change does not modify tracking authorization or release the sibling SDK.

## Offline validation

- Visits and shortcut focused regression run: 48 passing tests.
- New accessible identity tests: 2 passing tests.
- Navigation regression suite: 104 passing tests across 13 suites.
- Suite-discovery regression: 8 passing tests; smoke explicitly allows only the
  six expected source files, not generated CRUD or isolated mutation suites.
- Maturation evidence contract: 6 passing tests; 91 rows regenerated, including
  correction of account-search attribution from a display ellipsis to its route.
- Targeted new-test ESLint passes. DynamicShortcuts retains the same existing
  lint findings as HEAD; this change does not disable rules.
- Typecheck was attempted and failed on existing demo-data typing outside the
  touched files; no errors were reported for the new smoke tests or repairs.

Module maturation is regenerated from source declarations. Existing database
aggregates are retained, not remotely refreshed. Remaining uncovered transaction
flows, public booking (missing an approved exact calendar fixture), Order Lines,
and other single-case modules are not claimed as covered by this read expansion.