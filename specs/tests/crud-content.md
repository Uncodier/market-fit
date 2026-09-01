# Test Spec: Content CRUD

## Status

Ready

## Goal

Verify that an Admin can create, edit, and delete content.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Journeys And Variants

### Create / Read / Update / Delete

- Priority: P0
- Steps: `/content` → **New Content** → `#title` `Automated Test Content` → create segment `Automated Content Segment` and campaign `Automated Content Campaign` via **Use "…"** → **Create Content** → open details → change title → **Save** → **Delete** → confirm **Delete**.

## Test Data

- Title: `Automated Test Content` / `Automated Test Content - Edited`

## Assertions

- Content is gone from `/content` after delete.

## Cleanup

- Delete step removes the content.

## Implementation Plan

- Test file: `tests/crud-content.test.yaml`
