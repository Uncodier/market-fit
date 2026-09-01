# Test Spec: Quotation CRUD

## Status

Ready

## Goal

Verify that an Admin can create a quotation with a new client, open it, and delete it.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Preconditions

- The test account has a valid session and at least one active site.

## Journeys And Variants

### 1. Create a Quotation

- Priority: P0
- Steps:
  - Visit `/quotations`.
  - Click **Create Quotation**.
  - Fill name: `Automated Test Quotation`.
  - Create client `Automated Quote Client` via RelationSelect **Use "…"**, email `shiplight.quote.client@example.com`.
  - Create line item `Automated Quote Item` via RelationSelect **Use "…"**.
  - Click **Create Quotation**.
- Expected result: Redirect to `/quotations/[id]`.

### 2. Read

- Priority: P0
- Expected result: Details toolbar shows Delete.

### 3. Delete

- Priority: P0
- Steps: Click **Delete**, confirm **Delete**.
- Expected result: Redirect to `/quotations`.

## Test Data

- Quotation name: `Automated Test Quotation`
- Client: `Automated Quote Client` / `shiplight.quote.client@example.com`

## Assertions

- Details page loads after create.
- User returns to `/quotations` after delete.

## Cleanup

- Delete step removes the quotation. The helper lead/client may remain.

## Implementation Plan

- Test file: `tests/crud-quotation.test.yaml`
- Flakiness: create submit becomes **Continue** if a dynamic-priced catalog line is added; this test leaves line items empty.
