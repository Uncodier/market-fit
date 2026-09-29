# Agent Test: Reserve Across Channels

## Instructions

You are a testing agent for `market-fit`. Execute this case against
the target environment using terminal commands, database queries, logs, cloud
APIs, telemetry, and repo context. When the case has deterministic UI, run the
feature group's UI YAML (`tests/agent/reservations/ui/`) instead of driving the
browser yourself.

Do not mark PASS without concrete evidence. Do not use production customer data
unless this case explicitly says production synthetic data is allowed.

This case has two phases:

1. Environment preflight: confirm the selected environment can actually execute
   this case — including that the route, table, and component this case targets
   still exist (a renamed or removed surface is a `BLOCKED`, not a fabricated fixture).
2. Product verification: execute the feature checks and return PASS or FAIL.

If environment preflight fails, do not run product verification. Report
`Status: BLOCKED` with the concrete blocker. Once environment preflight is
ready, product verification must return exactly PASS or FAIL. Do not return SKIPPED.

Do not classify an external timeout, cancellation, or instruction to stop as a
product result. If the orchestrator interrupts execution before this case has
enough evidence for PASS, FAIL, or an environment/setup BLOCKED result, write
`Status: BLOCKED` only if the interruption exposed a concrete environment or
setup blocker named by this case. Otherwise write `Status: ABORTED` in the
report body, explain the orchestration interruption, and do not end the report
with PASS, FAIL, or BLOCKED. Release gates must reject ABORTED reports. Never replay an ambiguous mutating case automatically.

UI is codified as Shiplight YAML in `./ui/` and run as a subprocess (see the UI
section). Its Shiplight report, trace, and screenshots are the UI evidence —
reference them; do not drive the browser to collect them.

When the orchestrator provides `AGENT_VERIFICATION_REPORT_PATH`, write the
report to that exact path. Otherwise, write the report to a timestamped path:

`agent-test-reports/reservations-reserve-across-channels-<YYYYMMDD-HHMMSS>.md`

The report must include:

- Status: PASS / FAIL / BLOCKED, or ABORTED only for orchestration interruption
- Target environment and URLs used
- Fixture setup performed
- Evidence collected
- Findings
- Commands, queries, pages, dashboards, or logs inspected
- UI YAML evidence path (Shiplight report, trace, or screenshots) for the UI segments run
- Cleanup performed
- Follow-up required

End the report with one exact line:

`Status: PASS`

or:

`Status: FAIL`

or:

`Status: BLOCKED`

For orchestration interruption only, end with:

`Status: ABORTED`

## Requirements

- Ensure a user can create a reservable catalog item (Service/Product marked with `is_reservation = true`).
- Ensure the item can be added to cart and reserved in the POS.
- Ensure the item can be purchased/reserved through the public Shop storefront.
- Ensure an admin can create a reservation for this item directly from the Reservations page (`/reservations`).

Sources:

- `app/catalog/page.tsx`
- `app/pos/page.tsx`
- `app/shop/[siteSlug]/page.tsx`
- `app/reservations/page.tsx`

## Environment contract

- Only `local` and explicitly disposable `staging` are supported. Production execution is forbidden.
- Set `TEST_TARGET`, `TEST_BASE_URL` (workspace), `TEST_COMMERCE_BASE_URL`, `TEST_SITE_ID`, and `TEST_SITE_NAME` explicitly. No default host is inferred.
- Both `TEST_ALLOW_MUTATIONS=1` and `TEST_DISPOSABLE_ENVIRONMENT=1` are required.
- Set `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, and (staging) `TEST_SUPABASE_PROJECT_REF`; authenticate as the dedicated test user. Never use service role for verification or cleanup.
- Provide `TEST_AGENT_STORAGE_STATE`, a freshly authenticated state for the disposable workspace, and `TEST_RESERVATION_CUSTOMER_ID` / `TEST_RESERVATION_CUSTOMER_NAME` for an existing synthetic customer.
- The runner sets `TEST_PROJECT_ROOT`, `AGENT_VERIFICATION_RUN_ID`, and exact report/evidence paths. Each attempt has separate state.
- Backend identity and selected site must match the browser before creating records.
- The orchestration account must have enough authorization to remove only its run-owned data. Missing fixture support is BLOCKED, not permission to pick the first customer or item.

## Environment Preflight

Before product verification, prove the selected environment is ready:

1. Confirm the target URLs are reachable.
2. Confirm the route, table, and component this case targets still exist.
3. Confirm backend/database access works when required.
4. Confirm login/session bootstrap works for required accounts (for UI cases, the minted `storageState`).
5. Run the fixture setup command for the selected environment.
6. Confirm required fixtures exist and are safe to mutate.

If any item fails, stop before product verification and write a report ending
with `Status: BLOCKED`. The report must name the specific blocker.

## Fixture Preparation

After environment preflight completes, prepare case-specific data:

- Set up a test user session with permissions for the catalog, POS, and reservations pages.
- (Optional) Use a bespoke setup script if needed, or rely on the UI YAML to create the item.

Use this prefix for newly created records unless the environment section says
otherwise:

`agent-reservations-reserve-across-channels-<timestamp>`

## UI (deterministic YAML)

Deterministic UI is codified in the feature group's shared embedded project
`tests/agent/reservations/ui/`. 

- Setup writes each role's `storageState` to `TEST_AGENT_STORAGE_STATE`; the embedded Playwright config requires this explicit path.
- Run a segment: `cd tests/agent/reservations/ui && npx shiplight test tests/<segment>.test.yaml`.
- Segments to run:
  1. `tests/create-reservable-item.test.yaml`: Creates a run-named item and writes its ID to `.runtime/<run-id>/fixture.json` using the case-root helper.
  2. `tests/reserve-in-pos.test.yaml`: Navigates to `/pos` and reaches checkout. It does NOT complete payment or prove a persisted reservation; the case cannot PASS until this missing evidence is supplied by a verified test-mode completion step.
  3. `tests/reserve-in-shop.test.yaml`: Uses the configured commerce host and current run item for a zero-total cash order. It does not test Stripe.
  4. `tests/reserve-in-reservations-page.test.yaml`: Navigates to `/reservations`, creates a reservation manually for the same item.

## Task

Execute the verification steps:

1. Run setup (fixture mechanism + `storageState`).
2. Run the UI YAML segments under `tests/agent/reservations/ui/tests/`.
3. Read `.runtime/<run-id>/fixture.json` for the shared item. Capture each exact reservation ID from its successful response and correlate it with a user-scoped database read; never infer IDs from an unrelated existing row.
4. Verify in the database (Supabase or API) that the reservations were correctly inserted for POS, Shop, and Manual admin entry.
5. Cleanup.

## Suggested Checks

- UI states asserted by the `./ui/` YAML segments.
- Query the `reservations` table or equivalent to verify 3 rows were created for the test catalog item.
- Verify status codes and timing of API requests if checking via logs.

## Expected Evidence

Collect evidence for each required behavior:

- UI YAML execution reports for all 4 segments showing PASS.
- Database queries showing the catalog item was created with `is_reservation = true`.
- Database queries showing the reservations were linked to the catalog item, with correct source (POS, Shop, Manual).

## Pass Criteria

PASS only if all required behaviors and evidence are present.

FAIL only if environment preflight completed and any required behavior is broken
or required evidence is missing.

If backend access, secrets, URL reachability, login/session bootstrap, fixture
repair, app startup, or other required environment capability is unavailable,
stop before product verification and end the report with `Status: BLOCKED`
instead of `Status: FAIL`.

## Cleanup

Cleanup every exact run-owned reservation, order and synthetic customer, and archive the run-owned catalog item. Verify the final state through successful user-scoped reads. Incomplete or unsafe cleanup prevents PASS; retain the exact journal and report the blocker instead of broad deletion.

## Structured evidence gate

Write JSON to `AGENT_VERIFICATION_EVIDENCE_PATH` matching `tests/agent/agent-evidence.ts`:

- Current `runId`, `target`, `siteId`, and the one created `itemId`.
- Exactly three `observations`, one each for `pos`, `shop`, and `manual`, with distinct `reservationId`, matching `itemId`/`siteId`, current `observedAt`, `persisted: true`, and the actual successful `uiReportPath`.
- `cleanup.completed` and `cleanup.verified` must both be true.

The runner rejects stale/missing evidence, missing/failed UI artifacts, contradictory status lines and missing cleanup. It validates structure and artifact results; it does not independently execute the database observations written by the agent. This is agent-adjudicated evidence, not deterministic payment certification. A missing POS completion step must remain FAIL/BLOCKED, never a claimed reservation success.
