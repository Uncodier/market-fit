# Test Spec: Catalog CRUD

## Status

Ready

## Goal

Verify that an Admin user can successfully Create, Read, Update, and Delete a Catalog item (Product).

## User Roles

- `admin` (Shared Playwright setup using `.auth/admin.json`)

## Starting Point

- Base URL: `{{TEST_BASE_URL}}`
- Auth: Logged in via shared auth setup.

## Preconditions

- The test account has a valid session and at least one active site.
- `app.makinari.com` / `localhost:3000` is reachable.

## Journeys And Variants

### 1. Create a Product
- Priority: P0
- Steps:
  - Visit `/catalog`.
  - Click the "Add item" / "Agregar ítem" button to open the creation dialog.
  - Create category `Automated Catalog Category` via RelationSelect **Use "…"**.
  - Fill in Name: "Automated Test Product".
  - Fill in SKU: "TEST-01".
  - Fill in Default Sale Price: "99.99".
  - Click "Save" or "Create".
- Expected result: The product is created and appears in the catalog list, or redirects to the detail page.

### 2. Read / Verify the Product
- Priority: P0
- Steps:
  - Locate the newly created "Automated Test Product" in the catalog.
  - Click to view details (`/catalog/[id]`).
- Expected result: The product details page loads successfully, showing the correct name and SKU.

### 3. Update the Product
- Priority: P0
- Steps:
  - On the product details page, change the name to "Automated Test Product - Edited".
  - Click "Save Changes".
- Expected result: A success toast appears. The updated name is persisted.

### 4. Delete the Product
- Priority: P0
- Steps:
  - On the product details page (or list), click the Delete / Trash icon.
  - Confirm deletion if prompted.
- Expected result: The product is removed from the catalog, and the user is redirected back to `/catalog` (or the item is no longer in the list).

## Test Data

- Category: "Automated Catalog Category"
- Product Name: "Automated Test Product"
- Product Edited Name: "Automated Test Product - Edited"
- SKU: "TEST-01"

## Assertions

- `VERIFY:` The product appears in the list after creation.
- `VERIFY:` The details page reflects the edits.
- `VERIFY:` The product is no longer present in the list after deletion.

## Cleanup

- The deletion step itself acts as cleanup.

## Implementation Plan

- Test files: `tests/crud-catalog.test.yaml`.
