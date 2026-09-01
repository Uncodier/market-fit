# Test Spec: Screens that are not list CRUD

## Status

Ready

## Goal

Record which plan entities cannot receive a deterministic Create-Read-Update-Delete YAML test because the UI does not expose that cycle.

## User Roles

- `admin` (shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Incompatible entities

### People (`/people`)

- This screen is a people finder / search workspace, not a contact CRUD list.
- There is no create-person dialog or delete-person control for a first-party record.

### Companies (`/companies/[id]`)

- There is no companies list page. Companies are created as a side effect (`findOrCreateCompany`) from other flows.

### Orders (`/orders`)

- Top-bar create dispatches `orders:create`, which navigates to `/pos`.
- Order creation is a POS checkout journey, not an orders-list form.

### Shipments (`/shipments`)

- Create shipment requires selecting an existing order and line items.
- Not a standalone entity CRUD without a prior order fixture.

### Purchase Orders (`/purchases/orders`)

- Top-bar create opens the marketplace (`/marketplace?ownerSiteId=...&returnTo=/purchases/orders`).
- Buying from marketplace is a different journey.

### Purchase Quotes (`/purchases/quotes`)

- Same marketplace-entry pattern as purchase orders. No in-app quote create form on the list.

### Agents (`/agents`)

- Agents are site-provisioned templates, not user-created records with a New Agent dialog.

### Team / Members (`/settings?tab=team`)

- Flow is invite-by-email, not a self-contained CRUD with safe delete cleanup.
- Inviting real addresses from CI would send mail and leave members on the site.

## Assertions

- None. These screens stay covered by navigation smoke tests, not CRUD YAML.

## Cleanup

- None.

## Implementation Plan

- No `tests/crud-*.test.yaml` files for the entities above.
- Keep navigation coverage in `tests/*-navigation.test.yaml`.
