# Azure QA procurement and subsystem verification — 2026-10-31

## Exact target and source boundary

- QA ID: `qa-1793416143622-f99088dc`.
- Disposable Linux D4as_v5 in West US 2; creation cost was explicitly confirmed.
- Local Supabase, Redis, frontend, API and workers on the Azure VM; browser tests
  use loopback origins on that VM. No production database or deployment changed.
- External automatic expiry: `2026-10-31T07:15:09.168052+00:00`; exact group
  deletion/absence must be verified separately after evidence export.
- Service sources are clean private snapshots of the current frontend/API/worker
  HEADs. New tests were transferred as a reviewed testing-only overlay, not
  committed or pushed. Private source revision/hash manifests are retained under
  the installer's `.installer/qa/<exact-id>/` directory.
- The complete 183-file Supabase bootstrap replay succeeded. The tested forward
  Storage correction `20261030230000_procurement_storage_admission.sql` was then
  applied only to this QA, atomically with its exact canonical migration history.

## Authored browser scope

Nine native procurement scenarios cover creation/editing, approval/publication,
immutable amendments, invitations/withdrawal, personal and business submissions,
persisted drafts, private proposal PDFs, selected certifications, tenant/role
denials, sealed receipt privacy, human rejection, whole-tender award, order
approval and non-stock acceptance. See [the matrix](../tests/procurement.md).

Two native subsystem scenarios cover POS/customer UUID persistence through
reload/CRM roundtrip and exact lead/quotation navigation through reload and back.
See [subsystem scope](../tests/subsystems.md).

This is not every procurement-related screen or every subsystem. Request-linked
requisitions, replenishment, advanced supervisor/AI flows and additional
sales/order/shipment relation graphs still need dedicated browser fixtures and
scenarios. Unsupported product behaviors are not substituted with fake tests.

## Live defects and corrections

1. **Installer blocker:** Playwright Chromium was missing. Installed the exact
   lockfile CLI's browser/dependencies on QA and fixed canonical QA provision to
   install them before fixture creation; failures now stop before test setup.
2. **Test fixture schema defect:** ordinary `quotations` has no `title` column.
   Replaced invented fields with actual notes/identity fields and exact scoped
   cleanup; preserved primary and cleanup errors separately.
3. **Locator defects:** breadcrumb/entity duplicate headings, closed/open Radix
   sheets, icon wrapper versus SVG classes and populated implicit textarea labels.
   Scoped to actual semantic entity/dialog/textbox anchors without weakening UUID,
   persistence, visibility or tenant assertions.
4. **Cold chooser navigation:** retained the actual chooser interaction and exact
   selected site/URL checks, with a bounded 45-second route-transition wait.
5. **Streamed not-found:** Next can return HTTP 200 for streamed not-found UI.
   Unpublished/rejected tender denial now requires the exact not-found screen,
   private terms absent, no submission action and independent anonymous RPC `[]`;
   HTTP success alone is never accepted as privacy proof.
6. **Product SQL defect:** Storage v1.84.19's admission INSERT uses
   `mimetype/contentLength`, not final `size`. The restrictive policy rejected
   valid PDFs. The forward correction permits incomplete admission metadata only
   for exact, unexpired, caller-owned reservations; supplied mismatches still fail,
   pending objects remain unreadable, caller UPDATE/DELETE stay denied and ready
   completion still requires exact backend size and MIME. No service-role fallback.

## Validation and evidence interpretation

- Frontend harness regressions: 29 suites / 688 tests passed.
- Storage/evidence isolated PostgreSQL: 3 suites / 50 tests passed, no skips.
- Installer regressions: 10 suites / 199 tests passed.
- Schema static validation: 184 migrations / 39 upgrades; six validator tests passed.
- Full frontend typecheck passed; targeted authored-file ESLint passed. A broader
  unchanged-helper lint check found 12 pre-existing explicit-any errors in
  `mutation-collections.ts`, `mutation-fixtures.ts` and `mutation-settings.ts`.

Subsystem run `qa-1793416143622-f99088dc-subsystems-6670798f` completed **2/2 passed**,
with successful real admin setup and no failures/skips/retries. Earlier attempts
remain in the exact-run exports and are not hidden or merged into this result.

Procurement attempts progressed from 0/9 to 3/9 to 7/9 as defects were repaired.
The 7/9 run was `qa-1793416143622-f99088dc-procurement-012598bb`. Final full run
`qa-1793416143622-f99088dc-procurement-591526e3` completed **9/9 passed**, plus
successful real admin setup, in 8.1 minutes. There were no failures, skipped
cases or retries. Both previously failing edit/amendment scenarios passed in
this same full execution; passes from different runs were not combined.

The final allowlisted export contains all nine exact execution attempts and has
`extraction.status=ok`. Subsystem and procurement source/overlay hashes are
retained privately alongside the safe per-case outcome/source-location evidence.

The runner's `healthGreen` remains false for uncommitted testing overlays without
its clean-Git provenance certificate, even when browser assertions all pass.
Report actual per-case outcomes plus overlay/source hashes; do not disable the
provenance gate or call these runs passes of published Git revisions alone.

Raw logs, traces, synthetic data and ownership journals remain private. The
installer's allowlisted evidence export contains exact run IDs/counts/source
locations, not credentials, bearer URLs, browser Auth state or document bytes.

## Cleanup verified

After final evidence export, `install.sh qa destroy --id
qa-1793416143622-f99088dc --yes` completed. A subsequent installer status reported
`state=deleted-confirmed` and `groupExists=false`; independent Azure
`az group exists` returned `false` for the exact run-owned resource group.
No infrastructure remains for this QA. Immutable synthetic records and uploaded
documents were removed with the disposable database/Storage infrastructure;
private evidence exports remain locally. No production environment was touched.

All authored application/test/schema follow-up changes remain uncommitted and
unpushed. Publishing the new migration and tests, and any non-QA rollout, require
separate explicit authorization.