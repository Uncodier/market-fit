# Test Spec: Record CRUD

## Status

Ready

## Goal

Verify that an Admin can create a record, rename it, and delete it.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Preconditions

- The site has at least one record category. **New Record** creates against the selected category or the first category; otherwise the UI toasts an error.

## Journeys And Variants

### Create / Read / Update / Delete

- Priority: P0
- Steps: `/records` → **New Record** (creates `Untitled Record`) → open details → title `Automated Test Record` → **Save** → **Delete** → confirm **Delete**.

## Test Data

- Created title: `Untitled Record`
- Edited title: `Automated Test Record`

## Assertions

- Record is gone from `/records` after delete.

## Cleanup

- Delete step removes the record.

## Implementation Plan

- Test file: `tests/crud-record.test.yaml`
