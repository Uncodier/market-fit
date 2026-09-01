# Test Spec: Lead CRUD

## Status

Ready

## Goal

Verify that an Admin can create, open, rename (inline), and delete a lead.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Preconditions

- The test account has a valid session and at least one active site.

## Journeys And Variants

### 1. Create

- Priority: P0
- Steps: `/leads` → **Add Lead** → name `Automated Test Lead`, email `shiplight.lead@example.com` → create segment `Automated Lead Segment` and campaign `Automated Lead Campaign` via **Use "…"** → **Create lead**.
- Expected result: Lead appears in the list.

### 2. Read

- Priority: P0
- Steps: Click the lead name.
- Expected result: `/leads/[id]` heading shows the name.

### 3. Update

- Priority: P0
- Steps: Click the heading, edit to `Automated Test Lead - Edited`, press Enter (blur/save).
- Expected result: Heading shows the edited name. There is no Save Changes button.

### 4. Delete

- Priority: P0
- Steps: Open menu → **Delete Lead** → confirm **Delete Lead**.
- Expected result: Back on `/leads`; edited name is gone.

## Test Data

- Name: `Automated Test Lead`
- Edited name: `Automated Test Lead - Edited`
- Email: `shiplight.lead@example.com`

## Assertions

- List contains the lead after create.
- Details heading matches.
- Lead is absent after delete.

## Cleanup

- Delete step removes the lead.

## Implementation Plan

- Test file: `tests/crud-lead.test.yaml`
