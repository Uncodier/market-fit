# Native procurement browser suite

## Azure execution result — 2026-10-31

The complete nine-scenario suite passed on the disposable Azure QA in exact run
`qa-1793416143622-f99088dc-procurement-591526e3`: **9/9**, plus real admin login,
no skips or retries. A forward Storage admission policy correction was required
and applied only to that QA. This verifies the scenario matrix below, not every
procurement subsystem. Source snapshots and test overlays were not committed;
the separate clean-Git provenance health gate remains false. See
[the complete execution report](../qa-disposable/procurement-subsystems-20261031.md).

## Execution and safety

`TEST_SUITE=procurement` selects only native TypeScript Playwright tests in
`tests/procurement/` plus the main admin password-login setup. No YAML/AI steps,
intercepted responses, fake authentication, service-role access or provider calls
are used. Main owns suite configuration/preflight, not this feature's helpers.

Required: verified local disposable QA (`QA_STATUS=VERIFIED`), both mutation
flags, `QA_ENVIRONMENT_ID`, `QA_EXPIRES_AT` with at least 20 minutes remaining,
unique `SHIPLIGHT_RUN_ID=${QA_ENVIRONMENT_ID}-procurement-<unique>`, explicit app,
commerce and loopback public-key backend origins; site ID/name, catalog item ID,
foreign site ID and distinct installer-owned admin/buyer/collaborator/foreign
email/password credentials. Production and staging fail closed. Secondary
contexts start empty and authenticate through actual password UI, then verify
backend issuer, account email and exact server-owned QA metadata.

Main must explicitly enable the exact disposable workspace portal with its real
authenticated `/api/procurement/tenders/portal?site_id=...` API after verifying
admin/site QA ownership. Suite setup never changes shared portal settings or an
existing policy. When absent, the application's **publication endpoint** bootstraps
its owner/admin human fallback policy (`publication-default.ts`); the suite
approves the single self-approval-eligible human publication stage through UI.
Existing policy restrictions are not overwritten. Unsupported policy stages,
pending AI or multi-stage approvals cause failure, not skips. Tenders opt out of
global listing because the default policy disallows it. Publication, award and
order have distinct policy decisions.

Each test creates its own synthetic tender. UI creation/edit is covered directly;
other scenarios provision through real authenticated same-origin APIs and check
returned UUIDs and persisted requirements. Read verification uses `fixtureClient`
and `bindBrowserFixture` for the same explicitly authorized admin/backend. No
shared customer, tender, invitation or quotation is modified.

Private `procurement-owned-<scenario>.json` evidence records exact QA ID, run ID,
backend, site, expiry, unique marker, attempted creations and returned tender,
publication, approval, quotation, award/order/receipt and proposal revision IDs.
Files use mode 0600. Journals survive failures and do not contain credentials.
Immutable procurement data, certificates and append-only revisions are retained
until **explicitly authorized destruction of this exact QA group**. There is no
blind per-record cleanup, delete-all, title-prefix reset or immutability bypass.
Main's QA group destroy/absence verification owns eventual cleanup. Browser
contexts closing and the app's own conditional draft clear are not data teardown.

## Scenario matrix

| Scenario | Native coverage | Limits |
|---|---|---|
| Create/edit free-text tender | `tender-ui.spec.ts`: real create dialog, field labels, select choices, save, reload API persistence and versions | Currency USD, no linked request |
| Publication approval and visibility | Real Request publication, Approvals/Approve/reason/Confirm decision; anonymous unpublished 404 then public detail and buyer portal listing | Single human stage or immediate approval; global directory opt-in unsupported under default policy |
| Published immutable terms | Working revision changes description; public revision and snapshot remain unchanged; `invitations-amendment.spec.ts` separately approves amendment and retains old snapshot | Reuses real existing QA human policy, no revision bypass |
| Personal open participation | Actual buyer login, eligible self opportunity and inline public proposal sheet | No pre-created buyer supplier or representation grant |
| Save/resume free-text proposal | Real authenticated database draft PUT/GET; close context, fresh password login, restore reference/prices/proposal, immutable submit and quotation UUID | Current implementation persists server-side, **not localStorage** despite older docs |
| PDF proposal | Actual private multipart upload, ready revision ID, saved/resumed attachment, buyer Certificates & proposal download and PDF signature | Synthetic PDF, no authenticity/AI acceptance claim |
| Certification sharing | `certification-sharing.spec.ts`: real in-flow credential dialog upload, selected requirement revision and exact submission evidence; buyer file access denied before sharing then allowed; foreign applicant denied before/after sharing | Personal evidence only; no authenticity or assessment worker claim |
| Supplier invitations | `invitations-amendment.spec.ts`: API creates exact run-owned prospect then approves with expected version; UI selects, registers, withdraws invitation; persisted states checked | Does not email real recipients or establish supplier representation |
| Rejection/duplicate vote | `rejection.spec.ts`: human publication rejection UI, persisted rejected/own vote, duplicate opposite vote 409, unpublished public detail 404 | Requires human fallback; no artificial approval setup |
| Buyer quotation review | Received quotations row opens `/purchases/quotes/<id>`, supplier/reference, requirement, net and pending tax review; no sales conversion | Free-text null taxes are never represented as zero |
| Business identity | Foreign owner selects real eligible business, personal in-memory reference stays separate, business registration payload and mapped supplier quotation checked | No multiple-business membership revocation scenario |
| Denied boundaries | Anonymous 401; collaborator/foreign/buyer 403 for management; restricted self registration 403; forged acting business 403; stale version 409 and unchanged persisted snapshot | Denial requests target exact run-owned tender |
| Sealed receipt | Future after-close publication, actual submission, buyer single read 404 and list excludes private quotation/reference; sealed UI section | Does not advance clock to open sealed evidence |
| Mapped award/order/acceptance | `mapped-order.spec.ts`: actual 180-second published deadline, explicit bounded polling, distinct human award and order approvals, persisted award/order IDs and non-stock acceptance receipt | 480-second timeout; no clock override, no inventory movement, payment, shipment or external fulfillment |
| Early award denial | Both free-text/mapped pre-closing quotation award request returns 409, no order inferred | Order requires award ID, not quotation ID |
| Unmapped order resolution | Not covered in native suite | Product has no buyer-authorized mapping/tax-resolution workflow for immutable free-text quotes; do not bypass; SQL/Jest gate coverage remains canonical |
| Request-linked approvals, replenishment, supervisor/AI, evidence assessment, orders split by supplier | Not covered | Separate domain workflows, migrations and deterministic fixture prerequisites; not claimed by suite |

## Implementation sources inspected

- `app/purchases/tenders/{schema,tender-editor,tender-detail,tender-activity}.tsx`
  (schema is `.ts`), tender route handlers and publication-default policy.
- `app/tenders/{detail-view,submission-entry,tender-listing-card}.tsx`, shared
  `app/book/site-slug.ts` and real public visibility RPC boundary.
- `app/home/submissions/{submission-form,use-submission-draft,proposal-upload,applicant-picker}.tsx`
  (`use-submission-draft` is `.ts`), participation/register/drafts/credentials APIs.
- `app/purchases/quotes/quotation-detail.tsx`, commerce approval, orders/receipts,
  quotation shared evidence and nullable tax DTOs.
- Open personal/business participation and free-text SQL migrations, especially
  `20261030190000_procurement_free_text_quotations.sql` clock and tax/order gates.
- Canonical repository operations/security docs and installed Next Link guide.

## Offline regression evidence

2026-10-31 baseline: targeted Jest **2 suites / 25 tests passed** (policy rejection matrix
and source contracts); targeted ESLint passed for all authored procurement specs,
helpers and Jest tests. Native Playwright `--list --project=procurement` found
exactly **6 procurement scenarios plus admin setup (7 tests / 6 files)**. Full
typecheck is reported by main's integration checks. No live application, backend or deployed
browser was contacted during authoring. Offline green is not a live E2E pass.

Follow-up expansion adds exactly three independent specs plus
`procurement-expansion.ts`, without editing the initial six scenario bodies or
their helpers during main's execution. Discovery now finds **9 procurement
scenarios plus setup (10 tests / 9 files)**; expanded Jest **27 tests / 2 suites
passed**, targeted ESLint passed and full `tsc --noEmit --incremental false`
completed without errors. Main can execute these after the initial six; no live
result is claimed here.

First baseline live attempt reported duplicate title headings in the workspace
(breadcrumb h1, screen-reader h1, entity h2). Local correction explicitly targets
the entity **level-2 heading** and public detail **main/header level-1 heading**,
not an arbitrary first match. A focused locator/source regression was added;
targeted Jest now reports **28 passed**, and procurement ESLint remains clean.
Main owns rerunning the corrected overlay; this correction is not live-pass evidence.

Main also confirmed the unpublished/rejected public route renders the real
`Tender not found` UI with HTTP 200 after streaming begins. Installed Next
`not-found` documentation explicitly permits 200 streamed/404 non-streamed.
The unavailable assertion now navigates to the exact absolute commerce URL and
requires settled main-level not-found heading/hint, absent tender title/description
and submit control, unchanged backend `publications: []`, plus an independent
**anonymous public-key** `public_procurement_tenders` call returning exactly `[]`
for the persisted portal slug and exact tender slug. An outage/error or ordinary
HTTP 200 content cannot satisfy denial. Main owns the corrected live rerun.

Second live attempt exposed retained closed, aria-hidden Radix submission sheets.
The local proposal helper now selects the uniquely accessible `Submit proposal`
dialog and requires `data-submission-checkout=true`, `data-state=open` and
visibility before returning the scoped sheet. Raw checkout-attribute selectors
are prohibited by a focused source regression. No force click or first-match
fallback is used; main owns rerunning the correction.

Second-run amendment editing also reached the correct dialog only after delayed
hydration. Both UI edit paths now wait for the named `Edit tender` dialog,
expected loaded title and enabled description (45 seconds for readiness only),
then require exact tender PUT response 200/ID and dialog closure. Backend version
and immutable publication assertions remain unchanged. The mapped scenario now
also follows the received quotation's `Open tender` link and returns through its
Received quotations row, asserting exact tender/quotation IDs. Main reported
mapped award/order/non-stock receipt passed in the second run; remaining failures
and rerun results remain main-owned evidence, not a full-suite pass claim.

Third-run evidence identified the actual edit locator mismatch: the description
textarea is nested directly inside its label, so an exact label-text selector can
include populated textarea content. Creation/edit/readiness now use the textbox
role and exact accessible name (`Public description and terms`, likewise `Title`)
rather than exact `getByLabel`. A regression prohibits the problematic populated
textarea label selector. No product behavior or authorization was modified.

Commands (from the repository root, npm on the installed Node PATH):

```sh
npm test -- --runInBand __tests__/e2e/procurement-policy.test.ts __tests__/e2e/procurement-contracts.test.ts
npx eslint tests/procurement/*.spec.ts tests/support/procurement-*.ts __tests__/e2e/procurement-*.test.ts
```

Run browser tests only via the main QA runner with the verified explicit fixture
environment and unique run provenance. Never infer a deployed URL or load real
customer credentials to satisfy a missing fixture.