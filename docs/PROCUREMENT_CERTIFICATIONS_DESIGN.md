# Procurement Certifications and Tender Evidence

**Status:** agreed design extension, 2026-10-16; not implemented functionality.
This is part of the [procurement and tenders design][main-design], not a separate app.
Basic profile credentials, tender requirements, and submitted evidence are included
in the initial tender workflow. Automated issuer verification is a later integration.

## 1. Purpose and ownership

An authenticated account can upload and manage certifications under **/home/profile**
and select them when participating in a tender. The **holder** is a person or an
organization; the **uploader** is the authorized account performing the action.
These identities must not be conflated. An employee uploading an organization's ISO
certificate does not become its holder, and a named contact is not automatically
authorized to manage that organization's credentials.

Credentials are structured, reusable records, not untyped profile attachments or
comma-separated certification names. A tender specifies which credentials qualify,
and the participant explicitly shares evidence for those requirements.

There is no independent Certifications app, separate supplier portal, or duplicate
personal profile. Supplier relationship approval remains buyer-specific and is not
equivalent to certification verification or tender eligibility.

## 2. Proposed data responsibilities

Names below are conceptual. Verify the database before choosing physical tables,
foreign keys, RLS policies, or migrations. Existing document-storage infrastructure
may be reused after authorization review; do not reuse catalog-file ownership rules.

| Record | Required responsibility |
| --- | --- |
| Certification type | Stable normalized identifier, display name and applicable standard/version. Support scoped custom requirements without granting anyone control of a global taxonomy. |
| Holder credential | Type, person/organization holder, issuer, certificate number/reference, issued date, expiry when applicable, covered activities/locations/specialties and optional verification URL. Record uploader separately. |
| Credential revision/evidence | Immutable metadata version, private file identity/version, upload time and actor; renewals create revisions rather than overwriting evidence already submitted. |
| Tender certification requirement | Published tender revision, required type, expected holder, required scope, accepted equivalents, mandatory/scored classification, validity rule and enforcement milestone. |
| Submission evidence link | Tender submission, exact requirement revision, selected credential revision/file, represented supplier and any assigned-person relationship needed to establish eligibility. |
| Review | Reviewer, time, evidence/requirement versions, outcome, reason and review scope. Authenticity verification and tender-specific acceptance are separate decisions. |

Examples include organizational ISO certifications, professional licenses, and insurance
evidence with a declared coverage period. A person's license can only satisfy an
assigned-professional requirement when the person and assignment are authorized and
meet the published rules; it is not interchangeable with an organizational certificate.

## 3. Tender requirements

In **/purchases/tenders/[id] > Requirements > Certifications**, the buyer selects:

- Certification type or a structured custom requirement.
- Expected holder: participating organization, individual professional, or assigned staff.
- Required activities, specialties, territory/site, or other relevant scope.
- Required standard/version and permitted equivalents, if any.
- **Mandatory** or **scored/preferred**; record scoring criteria when applicable.
- When it must be valid: submission, closing, award, or a specified execution period.
- When evidence is due and when missing/noncompliant evidence blocks progression.

Validity and evidence due dates are distinct. For example, a document may be required
at submission but must remain valid through award. If compliance is only required
before award, the UI must not silently block initial participation instead.

Example: **ISO 9001 held by the participating organization, covering the requested
service, valid at closing, with evidence required at submission.** Requirements cannot
be satisfied by a filename or a loosely matching free-text title. Normalize types and
evaluate holder, scope, dates and expressly accepted equivalents.

Requirements are part of the published bases. Changes produce an amendment/revision
and participant notification; do not silently evaluate an old submission against new
rules. Application and database validation must enforce the applicable revision.

## 4. Profile, participation, and evaluation screens

| Screen/section | Actions and displayed information |
| --- | --- |
| `/home/profile` > **Certifications** | List authorized holder credentials; add/edit draft metadata, upload evidence, renew, archive unused records and see expiry/review details. Offer only authorized holders in Acting as/holder controls. |
| `/home/tenders/[id]` > certification checklist | Show each requirement, mandatory/scored classification, expected holder/scope, validity date, selected evidence and reason for any missing/mismatched/expired state. |
| Proposal editor `/home/quotes/[id]` when tender-linked | Reuse the same checklist data; select an existing credential revision or upload one, explicitly share it for this tender, then submit with the quotation revision. |
| `/purchases/tenders/[id]` > **Requirements** | Configure normalized certification requirements, equivalents, validity/enforcement milestones and published revisions. |
| `/purchases/tenders/[id]` > **Evaluation** | Inspect only the shared evidence after the applicable opening gate, record authenticity review and accept/reject against this tender's requirements with reasons. |
| `/suppliers/[id]` > **Documents** | Show credentials explicitly shared with this buyer and the applicable review context; no automatic access to the holder's complete dossier. |
| Public tender detail | Show published certification requirements, not participants' certificates, private verification links, or review notes. |

Checklist states must distinguish **missing evidence**, **holder/scope mismatch**,
**expired/not valid at required date**, **pending review**, **accepted**, and **rejected**.
A submission confirmation records the exact quotation, requirements, and evidence
versions received, with a server timestamp.

## 5. Upload, validity, verification, and acceptance are different

1. **Uploaded:** evidence was successfully stored. This says nothing about authenticity.
2. **Validity:** evaluate dates against the published milestone, not only today's date.
   Missing expiry is allowed only where explicitly non-expiring, not treated as verified
   indefinite validity. Unknown or malformed dates require correction/review.
3. **Authenticity verification:** record the reviewer or trusted issuer/registry source,
   method, evidence, result and time. A supplier's own assertion or PDF is not verification.
4. **Tender acceptance:** the buyer determines whether that evidence satisfies this
   requirement; acceptance by Buyer A is not automatic approval by Buyer B.

Pending human review is not the same as missing evidence. Published rules determine
whether submission is allowed pending review and whether award requires acceptance.
Equivalence decisions need explicit reasons and must follow the published criteria.

Renewing, archiving, or editing a profile credential must not rewrite or delete prior
submission evidence. Later expiry/revocation can trigger a new review at award or
execution; preserve the historical submission and append the current assessment.
The final retention/deletion policy must distinguish unused drafts from submitted
evidence and comply with applicable obligations; do not promise unrestricted deletion.

## 6. Security and selective sharing

- Derive holder-management and representation authority from verified relationships.
  Never trust a client-supplied holder, supplier, buyer site, or evidence ID.
- Use private storage, MIME/size validation and authorized downloads with appropriately
  short-lived links. Set certification-specific upload limits; do not inherit catalog
  upload allowances simply because a visual component is reused.
- Explicitly link/share only the selected evidence revision with the relevant tender
  and authorized buyer reviewers. Other buyers and participants cannot browse it.
- Apply sealed-submission opening rules to certificates as well as prices/technical
  proposals. Profile access or a public document token must not bypass the opening gate.
- Protect PDFs, previews, exports, verification URLs, audit data and cache entries;
  no public bucket URLs or full-profile serialization in tender/public responses.
- An optional verification URL is untrusted input. Do not automatically fetch arbitrary
  URLs; future automated verification needs trusted issuer sources and outbound controls.
- Server-side submission checks bind requirements, supplier representation, selected
  revisions and file access atomically. Client checklist colors are not authorization.
- Revoking a representative ends their access, not the buyer's lawful historical audit
  record. Any share revocation/retention rules must be explicit and auditable.

## 7. UI/UX references: adapt, do not build from scratch

| Target | Existing visual reference | What to reuse and what to replace |
| --- | --- | --- |
| Profile Certifications section | [Buyer profile][buyer-profile], [SectionCard][section-card], [shared table][table] | Existing account-page spacing, section headers, table/status presentation and empty/loading states; add holder, issuer, scope and dates. |
| Credential upload/evidence list | [ProductDownloadableFilesCard][file-card] | Adapt file rows, upload affordance, progress/error feedback and removal confirmation. Do not reuse digital-product restrictions, catalog mutations, download entitlements, storage policy or its advertised file-size limit. |
| Add/edit credential dialog | [Dialog][dialog], [RelationSelect][relation-select], [DatePicker][date-picker] | Existing form/validation/busy-state patterns; type/holder selection and issue/expiry dates with explicit non-expiring handling. |
| Tender certification requirement editor | [ItemSpecsEditor][spec-editor] | Adapt grouped/repeatable fields and searchable relation controls. Write tender requirement revisions, not catalog specifications or automation requirements. |
| Participant checklist and evidence picker | [CreateQuotationLineItems][quote-lines], [RelationSelect][relation-select], [document-list][document-list] | Repeatable rows, selection and status styling; bind each row to a certification requirement and immutable evidence rather than a priced catalog item. |
| Buyer review in Evaluation | [QuotesTable][quotes-table], [SectionCard][section-card], [confirmation dialog][confirm-dialog] | Existing comparison/detail/action patterns; show review scope, reasons and timestamps. Never auto-mark uploaded files as verified. |

All sections live inside the main design's existing screens and shared `/home` shell.
Match desktop/mobile, keyboard/focus behavior, light/dark themes, skeletons, denied
states and read-only states. Use existing icons and typed presentation adapters.

## 8. Acceptance checks

- A representative can upload an organization credential only with authority; they
  cannot switch a payload ID to manage another holder's credentials.
- A normalized required type, holder and scope are matched independently of filename.
  Scored criteria and declared equivalents follow published rules.
- Test expiry at submission, closing, award and execution milestones, including exact
  boundaries, future validity, unknown dates and explicitly non-expiring credentials.
- Enforce missing mandatory evidence at the declared gate; pending review must not be
  represented as accepted or rejected without an actual review.
- Select an existing revision or upload new evidence during participation. The resulting
  submission pins its file and metadata even if the profile credential is later renewed.
- Buyer A sees only evidence shared with A's tender; Buyer B, competitors and anonymous
  users cannot access it through IDs, public tokens, previews, exports or cached responses.
- Sealed evidence remains unavailable to reviewers until opening; revocation and later
  expiry append review history rather than rewriting the original submission.
- Acceptance in one tender neither verifies authenticity globally nor approves all
  supplier relationships. No standalone certification app or duplicate quote is created.

This documentation does not claim implemented verification, database constraints, or
passing feature tests. Implement authorization, storage, lifecycle and UI tests when
building the feature, under the main design's approved validation workflow.

## Source references

[main-design]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/PROCUREMENT_AND_TENDERS_DESIGN.md
[buyer-profile]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/buyer/profile/page.tsx
[section-card]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/section-card.tsx
[table]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/table.tsx
[file-card]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/catalog/components/ProductDownloadableFilesCard.tsx
[dialog]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/dialog.tsx
[relation-select]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/relation-select.tsx
[date-picker]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/date-picker.tsx
[spec-editor]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/catalog/components/ItemSpecsEditor.tsx
[quote-lines]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/quotations/components/CreateQuotationLineItems.tsx
[document-list]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/documents/document-list.tsx
[quotes-table]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/documents/quotes-table.tsx
[confirm-dialog]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/confirm-dialog.tsx
