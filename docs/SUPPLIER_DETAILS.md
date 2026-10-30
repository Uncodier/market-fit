# Supplier detail data and contact actions

The supplier detail sidebar presents the workspace relationship, recorded contacts,
supplier version and timestamps, and the readable linked company profile. Company
fields include contact channels, industry, size, employee count, revenue range,
description, address, legal/tax identifiers, public-company status and record metadata.
Absent fields are not fabricated. The procurement demo only has company reference
names, so it does not show invented company profiles.

The sidebar uses lead-style compact Info, Company, Contacts and Notes tabs.
Address and legal/tax information are sections inside Info, not additional tabs.
Supplier text and contact fields use the shared inline PropertyRow
editor; applying an edit updates the versioned draft, while Save changes persists
the supplier. Applied drafts survive tab switches. Linked company profile fields
are read-only here; Company holds the profile and Info holds address and legal details.
Supplier status is shown only in the sticky header as the full progressive
Prospect, Under review, Approved, Blocked and Archived widget. Status changes
update the draft; archival retains its explicit confirmation. Read-only members
cannot change status. Compact category pickers align with the property value
column without hidden-label spacing or a nested bordered input.
Category and linked-company fields display their values until clicked; selection
and removal remain local to the inline editor until applied. Primary-contact
flags and the main relationship text fields follow the same click-to-edit pattern.
Read-only views do not display permanent edit controls.

`GET /api/procurement/suppliers/[id]/company?site_id=<workspace>` validates the
supplier ID, authenticates and checks workspace select access through
`supplierAccess`, then verifies the supplier in that workspace. It reads the
server-owned company linkage through the same user-scoped RLS client, projects
explicit Company fields and returns private, no-store responses. Client-provided
company IDs do not select another company. Errors are distinct from absent data.

The existing supplier detail no longer exposes Add contact. Contacts can still
be entered during supplier creation and existing contacts can be edited. Email,
Call and WhatsApp actions use recorded contact data, preferring the primary
contact and falling back to the company. WhatsApp requires an international
phone number. Opening a channel does not record a contacted status or send a
message automatically. Read-only members can use valid contact links without
gaining mutation permissions.

Focused regression checks:

```bash
npm test -- --runInBand __tests__/procurement/supplier-company-api.test.ts __tests__/procurement/supplier-expanded-details.test.tsx __tests__/procurement/supplier-detail-alignment.test.tsx __tests__/procurement/suppliers-ui.test.tsx
```