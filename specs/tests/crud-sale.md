# Test Spec: Sale CRUD

## Status

Ready

## Goal

Verify that an Admin can create a sale, open it, and delete it.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Journeys And Variants

### Create / Read / Delete

- Priority: P0
- Steps: `/sales` → **Add Sale** → title `Automated Test Sale` → create lead `Automated Sale Lead` and segment `Automated Sale Segment` via **Use "…"** → **Create sale** → open row → **Delete** → confirm **Delete**.

## Test Data

- Title: `Automated Test Sale`

## Assertions

- Sale appears after create and is gone after delete.

## Cleanup

- Delete step removes the sale.

## Implementation Plan

- Test file: `tests/crud-sale.test.yaml`
- Update of title on the details page is not a dedicated named field; this cycle covers C/R/D.
