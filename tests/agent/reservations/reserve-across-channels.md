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
with PASS, FAIL, or BLOCKED. Release gates should ignore ABORTED reports and
rerun the case.

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

## Project Context

- Product/project name: `market-fit`
- Local URLs: `http://localhost:3000` (Main), POS (`/pos`), Shop (`/shop`), Reservations (`/reservations`)
- Staging URLs: `https://staging.market-fit.example.com`
- Production URLs: `https://market-fit.example.com`
- Fixture setup and mutation policy: Agent may create a test catalog item and submit test orders/reservations.
- Cleanup ownership: Test should remove the test catalog item and reservations if possible, or leave them with prefix `agent-reservations-`.

## Testing Environments

The orchestrator or tester must specify one listed target environment before
execution, for example through `AGENT_VERIFICATION_TARGET=local` or an equivalent
parameter. If no target environment is specified, stop before preflight and
report `Status: BLOCKED` with blocker `target_environment_missing`. Record the
selected target in the report. A PASS is valid only for the selected target
environment.

### Local Development

- Web URL: `http://localhost:3000`
- Admin URL: `http://localhost:3000`
- API URL: `http://localhost:3000/api`
- Backend setup:
  - `npm run dev`
- Fixture setup authority: Agent can use Supabase local instance / standard API routes to insert test data.
- Required accounts: Test user should have access to admin pages (`/catalog`, `/pos`, `/reservations`).
- Mutation policy: test-owned records only.

### Staging

- Web URL: `<staging-web-url>`
- Admin URL: `<staging-admin-url>`
- API URL: `<staging-api-url>`
- Environment preflight command: Verify access to staging.
- Fixture setup command: Agent can create a test product.
- Mutation policy: seeded fixtures or clearly test-owned records only.

### Production

- Web URL: `<production-web-url>`
- Admin URL: `<production-admin-url>`
- API URL: `<production-api-url>`
- Production policy: read-only unless this case lists exact synthetic fixtures
  and explicit mutation approval.

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

- Setup writes each role's `storageState` to `tests/agent/reservations/.runtime/`, where the YAML's `use.storageState` points.
- Run a segment: `cd tests/agent/reservations/ui && npx shiplight test tests/<segment>.test.yaml`.
- Segments to run:
  1. `tests/create-reservable-item.test.yaml`: Creates the reservable item in `/catalog` and extracts its ID to `evidence.json`.
  2. `tests/reserve-in-pos.test.yaml`: Navigates to `/pos`, adds the item to the cart, completes checkout, and creates a reservation.
  3. `tests/reserve-in-shop.test.yaml`: Navigates to `/shop/:slug`, finds the item, checks out, and reserves.
  4. `tests/reserve-in-reservations-page.test.yaml`: Navigates to `/reservations`, creates a reservation manually for the same item.

## Task

Execute the verification steps:

1. Run setup (fixture mechanism + `storageState`).
2. Run the UI YAML segments under `tests/agent/reservations/ui/tests/`.
3. Read `tests/agent/reservations/.runtime/evidence.json` to get the item ID and reservation IDs.
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

Describe cleanup for all records (catalog item, reservations) created by the case. If cleanup is not safe, leave
records clearly named with the agent test id and note them in the report.
