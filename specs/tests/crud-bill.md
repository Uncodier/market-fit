# Test Spec: Bill CRUD

## Status

Ready

## Goal

Verify that an Admin can create a bill and delete it from the details page.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Journeys And Variants

### Create / Read / Delete

- Priority: P0
- Steps: `/bills` → **New bill** → first textbox `Automated Test Bill` → **Create bill** → landing on `/bills/[id]` → **Delete** → confirm **Delete**.

## Test Data

- Title: `Automated Test Bill`

## Assertions

- Bill is gone from `/bills` after delete.

## Cleanup

- Delete step removes the bill.

## Implementation Plan

- Test file: `tests/crud-bill.test.yaml`
