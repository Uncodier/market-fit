# Test Spec: Transaction (Expense) CRUD

## Status

Ready

## Goal

Verify that an Admin can create an expense, open it, and delete it.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Journeys And Variants

### Create / Read / Delete

- Priority: P0
- Steps: `/transactions` → **Add Expense** → `#amount` `100.50`, `#notes` `Automated Test Expense` → create campaign `Automated Expense Campaign` via **Use "…"** → **Save** → open row → **Delete** → confirm **Delete**.

## Test Data

- Amount: `100.50`
- Notes: `Automated Test Expense`

## Assertions

- Expense is gone from `/transactions` after delete.

## Cleanup

- Delete step removes the expense.

## Implementation Plan

- Test file: `tests/crud-transaction.test.yaml`
- Dialog submit label is **Save**, not Create.
