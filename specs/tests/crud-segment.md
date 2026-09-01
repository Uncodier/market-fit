# Test Spec: Segment CRUD

## Status

Ready

## Goal

Verify that an Admin can create, edit, and delete a segment.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Journeys And Variants

### Create / Read / Update / Delete

- Priority: P0
- Steps: `/segments` → **New Segment** → `#name` `Automated Test Segment` → **Create Segment** → open details → change `#name` → **Save Basic Information** → **Delete** → **Delete Segment**.

## Test Data

- Name: `Automated Test Segment` / `Automated Test Segment - Edited`

## Assertions

- Segment is gone from `/segments` after delete.

## Cleanup

- Delete step removes the segment.

## Implementation Plan

- Test file: `tests/crud-segment.test.yaml`
