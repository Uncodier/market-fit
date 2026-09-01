# Test Spec: Campaign CRUD

## Status

Ready

## Goal

Verify that an Admin can create a campaign and rename it inline on the details page.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Journeys And Variants

### Create / Read / Update

- Priority: P0
- Steps: `/campaigns` → **New Campaign** → `#title` `Automated Test Campaign` → **Create campaign** → landing on `/campaigns/[id]` → click heading → rename → Enter.

## Test Data

- Title: `Automated Test Campaign` / `Automated Test Campaign - Edited`

## Assertions

- Details heading shows the created then edited title.

## Cleanup

- None. `handleDeleteCampaign` exists in the detail hook but is not wired to a button.

## Implementation Plan

- Test file: `tests/crud-campaign.test.yaml`
