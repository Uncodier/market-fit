# Test Spec: Control Center Task CRUD

## Status

Ready

## Goal

Verify that an Admin can create, edit, and delete a task.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Journeys And Variants

### Create / Read / Update / Delete

- Priority: P0
- Steps: `/control-center` → **New Task** → `#title` + `#description` → create lead `Automated Task Lead` via **Use "…"** → **Create task** → open `/control-center/[id]` → edit `#title` → **Save Basic Information** → **Delete Task** → confirm **Delete**.

## Test Data

- Title: `Automated Test Task` / `Automated Test Task - Edited`
- Description: `Task created by automated CRUD test`

## Assertions

- Edited task is gone after delete.

## Cleanup

- Delete step removes the task.

## Implementation Plan

- Test file: `tests/crud-control-center.test.yaml`
