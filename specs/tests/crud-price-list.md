# Test Spec: Price List CRUD

## Status

Ready

## Goal

Verify that an Admin can create a price list, open it, and rename it via **Edit list**.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Journeys And Variants

### Create / Read / Update

- Priority: P0
- Steps: `/price-lists` → **Create List** → `#price-list-name` `Automated Test Price List` → **Create List** → open details → **Edit list** → rename → **Save**.

## Test Data

- Name: `Automated Test Price List` / `Automated Test Price List - Edited`

## Assertions

- Edited name is visible on the details page.

## Cleanup

- None. There is no delete-price-list action in the UI (only delete of line prices).

## Implementation Plan

- Test file: `tests/crud-price-list.test.yaml`
