# Test Spec: Deal CRUD

## Status

Ready

## Goal

Verify that an Admin can create a deal, open it, and rename it inline.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Journeys And Variants

### Create / Read / Update

- Priority: P0
- Steps: `/deals` → **Create Deal** → name `Automated Test Deal`, amount `1000` → create company `Automated Deal Company` and lead `Automated Deal Contact` via **Use "…"** → **Create deal** → open details → click heading → rename to `Automated Test Deal - Edited` → Enter.

## Test Data

- Name: `Automated Test Deal` / `Automated Test Deal - Edited`
- Amount: `1000`

## Assertions

- Details heading shows the created then edited name.

## Cleanup

- None in UI. `deleteDeal` exists in actions but no Delete control is rendered on the deal page. Leftover test deals may accumulate.

## Implementation Plan

- Test file: `tests/crud-deal.test.yaml`
- Known gap: no Delete step.
