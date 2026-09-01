# Test Spec: Requirement CRUD

## Status

Ready

## Goal

Verify that an Admin can create, edit, and delete a requirement.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Journeys And Variants

### Create / Read / Update / Delete

- Priority: P0
- Steps: `/requirements` → **New Requirement** → `input[name=title]` `Automated Test Requirement` → **Create requirement** → open details → change title → **Save** → **Delete** → confirm **Delete**.

## Test Data

- Title: `Automated Test Requirement` / `Automated Test Requirement - Edited`

## Assertions

- Requirement is gone from `/requirements` after delete.

## Cleanup

- Delete step removes the requirement.

## Implementation Plan

- Test file: `tests/crud-requirement.test.yaml`
