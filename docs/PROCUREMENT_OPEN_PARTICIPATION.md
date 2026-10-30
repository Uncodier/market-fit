# Open public tender participation

## Directory discovery filters

The public directory retains the Marketplace sidebar and mobile filter layout.
Participation, country and category selections are combined on the loaded page;
counts describe publications on that page, not a global total. Empty facet groups
are omitted. Resetting an empty result clears all three selections.

`app/tenders/load-listing-facets.ts` runs only after the user-scoped public RPC
authorizes the bounded publication list. Its server-only service client reads
buyer locations using the Marketplace geography loader and emits normalized
country labels only. Countries describe buyer locations, not delivery eligibility.
Categories come from active, same-site catalog items linked to requirements in
the immutable saved revision matching the publication version, and active
same-site categories. Missing links never fall back to a newer working draft.
Category names are current discovery metadata, not immutable published terms;
same-named categories across buyers share a facet. Internal IDs, audit snapshots,
addresses and prices are not serialized as facet data.

No migration is required. Facet read failures remain directory errors rather
than fabricated empty options. Category behavior is covered by isolated Jest
fixtures; live availability depends on the published requirements' catalog links.

## Participation

Open **public** publications accept authenticated accounts with confirmed email
without a supplier record or representation grant created beforehand by the buyer.
Public visibility alone does not change `approved_suppliers` or `invitation_only`
participation rules.

The account portal lists eligible open public opportunities alongside authorized
supplier opportunities. Self entries use `acting_as_self: true`; `supplier_id` is
nullable before registration. The submission form registers the account for the
publication through `/api/procurement/credentials/participation/register` and then
submits its quotation using the existing commerce submission endpoint.

A publication deep link opens its editor automatically when exactly one eligible
acting identity is available. The editor supports an optional private PDF proposal
(up to 8 MiB), priced requirement lines, existing certification revisions and
in-flow certification uploads. Uploaded certifications are selected for the current
requirement; quotation drafts remain intact while the credential editor is open.
Proposal documents are stored as personal revisions of type `tender_proposal`,
excluded from the certification picker, and attached separately via
`proposal_revision_id`. A selected PDF must finish uploading before submission.
The buyer can download the proposal through quotation shared evidence after the
publication's disclosure rules allow access.

The public tender's Submit proposal button opens a checkout-style right sheet on
the same page, rather than navigating to the account portal. Desktop uses a 720px
panel, mobile uses the full viewport, and the net total/submission footer remains
fixed below the scrollable form. The form includes the published summary and
deadline, proposal upload, line pricing/certifications and disclosure terms.
Guests sign in with a return URL to the same tender. Multiple eligible identities
are available in an inline account dropdown. The account portal reuses the same sheet.
Closing retains the in-memory draft. Save draft explicitly persists form data in
this browser's local storage, scoped by account, acting identity, buyer workspace,
publication and version. It restores reference, prices, selected uploaded revision
IDs and the proposal holder name after reload. It is not cross-device storage;
selected files must be uploaded before saving and file bytes are never stored in
the draft. The footer communicates this limitation and reports storage failures.
Saved receipt keys/attempt state survive ambiguous sends; successful submission
clears the saved draft. Local values remain untrusted input to server validation.

The sheet uses the purchase checkout's white rounded cards, subtle borders/shadows,
muted backdrop, uppercase field labels and 48px rounded inputs. When multiple
identities are eligible, an inline account dropdown appears within the form without
a separate selection screen or Continue button. Personal participation is the
default when eligible; otherwise the first eligible identity is displayed. Choosing
another identity takes effect immediately and preserves separate in-memory drafts.
The dropdown is locked during uploads and after a submission attempt so retries
cannot silently change the submitting identity.

Open public opportunities include owned and active, effectively licensed business
workspaces. Business choices have `acting_site_id` and `acting_as_self: false`.
Registration sends that ID to `register_open_tender_business`; the server derives
the actor, verifies current workspace authority and creates a fresh prospect identity
scoped to the publication/business. It does not claim existing supplier/company
records or grant access to buyer-private information. Submission revalidates access,
including membership removal, manual disablement, licensing and workspace archival.
Credential uploads remain personal evidence shared by the submitting account;
business selection is not automatic authority over another person's private files.

`register_open_tender_participant(p_publication uuid)` derives the user from the
session, checks the current published version, participation deadline, public
visibility, enabled portal and active workspace, and atomically creates an account
self identity and publication-scoped registration. Retries reuse that identity.
The internal supplier bridge starts as a prospect; it is not buyer approval,
organization representation, or access to private buyer supplier records.
No existing contact, email or company record is claimed automatically.

Quotation validation, personal evidence disclosure, proposal counting and award
validation recognize publication-scoped self participation. Existing restrictions,
monetary validation and sealed evidence rules remain enforced. Each publication
requires its own registration, even if the account already has a self identity in
that workspace.

## Rollout and validation

### Free-text quotation lines

`20261030190000_procurement_free_text_quotations.sql` permits quotation submission
when a tender requirement has no catalog mapping. It does not create a product,
modify the published tender, or infer a tax exemption. Description, unit and
quantity remain defined by the tender; the supplier offers the net unit price.
Existing explicit mappings still require an active same-site, same-currency item.

Unmapped quotation items store SQL `NULL` for tax amount and tax snapshot. If any
line is unmapped, quotation tax and gross total are also `NULL`; net amounts stay
available for evaluation. Read DTOs retain these nulls, and the UI labels them as
pending taxes rather than displaying a zero-tax total. Mapped items keep their
existing tax calculation. Sales items still require catalog identity and sales
quotations still require non-null totals.

Net-only proposals can participate in award evaluation, including all free-text
lines in policy context. Order validation rejects unresolved catalog/tax data
before approval materialization. A buyer-authorized, separately versioned order
preparation/resolution workflow is not implemented by this change; do not edit an
immutable submitted quotation or bypass this gate to create an order.

The migration preserves representation checks, personal/business participation,
idempotency, evidence disclosure, and quotation immutability. A previously rejected
catalog-free attempt can retry its saved key against the same publication after
the migration, provided the publication and participation remain eligible.

Applied with explicit approval to `rnjgeloamtszdjplmqxy` on 2026-10-30 UTC,
alongside the local nullable-tax UI changes. No data backfill was needed.
The migration was recorded once and deployed function bodies matched the canonical
file. Remote verification was read-only; no supplier quotation was submitted.
Validation uses a socket-only disposable PostgreSQL instance:

```bash
npm test -- --runInBand __tests__/procurement/free-text-quotations-postgres.test.ts
```

Apply `supabase/migrations/20261030120000_procurement_open_self_participation.sql`
through the approved migration workflow before relying on the new application
behavior. Its PostgreSQL regressions use an isolated local cluster, not the
configured Supabase database. No remote migration is authorized by these tests.

The approved connected project now has both that migration and
`20261030130000_procurement_proposal_attachments.sql` applied. See
[targeted migration validation](PROCUREMENT_TARGETED_MIGRATION_VALIDATION.md) for
the actual target, transaction guards and security evidence.

`20261030140000_procurement_open_business_participation.sql` was subsequently
approved and applied to the same target. Its exact canonical SQL and sanitized
validation manifest are also in the DB-schema repository. Backend validation:
63 tests across five suites, including 18 business-participation PostgreSQL cases.
UI regression covers explicit selection, switching applicants, separate drafts and
business registration payloads. Live browser checks confirmed checkout styling and
mobile geometry; the available buyer test account had no business choices, so the
live multi-business path remains unverified (covered by local UI/PostgreSQL tests).

```bash
npm test -- --runInBand __tests__/procurement/open-participation-api.test.ts __tests__/procurement/open-participation-ui.test.tsx __tests__/procurement/open-participation-postgres.test.ts
```

The tests cover new accounts, registration retries, quotation retries, forged
identities, restricted/expired/stale publications, private data and evidence,
cross-account access and award integration.