# Test Spec: Promotion CRUD

## Status

Ready

## Goal

Verify that an Admin can create a promotion against an existing campaign, edit it, and delete it.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Preconditions

- None. The campaign is created on the fly via the RelationSelect (`Use "…"`).

## Journeys And Variants

### Create / Read / Update / Delete

- Priority: P0
- Steps: `/promotions` → **Create Promotion** → type `Automated Promo Campaign` in **Select campaign...** → click **Use "Automated Promo Campaign"** → `#name` `Automated Test Promotion` → **Create promotion** → edit name → **Save Changes** → **Delete Promotion** (native `confirm`).

## Test Data

- Name: `Automated Test Promotion` / `Automated Test Promotion - Edited`

## Assertions

- Redirect to `/promotions` after delete; edited name is gone.

## Cleanup

- Delete step removes the promotion.

## Implementation Plan

- Test file: `tests/crud-promotion.test.yaml`
- Campaign is created through the dependency selector; no pre-existing campaign is required.
