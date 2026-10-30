# 14035 integration readiness — 2026-10-30

## Authorized integration follow-up

The owner subsequently approved merging `14035` into `master` and pushing both
repositories to production. Remote refs were refreshed: app `master` was
`101585f6` and commercial `main` was `5944d3c`, matching local targets. GitHub
deployment records confirm both target branches deploy to Vercel Production.

The complete local app work was saved as `0db9be49`; commercial proxy work was
saved as `20d1e94`. The app merge preserves both timezone and preview behavior in
the sole conflicted file, `ReservationSlotPicker.tsx`. The readiness findings
below remain historical evidence, not a claim that all release gates passed.
Remote migration application was not included in this follow-up.

## Status

**Not release-green.** This review prepares existing local work; it does not
commit, merge, push, build, deploy or apply remote migrations. Preserve the
uncommitted work in both repositories. The app's master checkout stays untouched.

- App worktree: `/Users/prado/.cline/worktrees/14035/market-fit`, `cline/14035`
  at `40675392` during review.
- Target: `/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit`, `master`
  at `101585f6` (15 commits ahead of the branch base).
- Proxy: `/Users/prado/Desktop/Proyectos/Uncodie/Code/commercial-site`, `main`,
  with existing local integration changes.
- Inventory against local master: **70 new endpoints: 27 pages and 43 APIs**.
  These include untracked files, not only the branch's one committed change.

## Public path inventory

| Pages | Ownership / checks |
| --- | --- |
| `/home` | Account shell; authentication outside explicit read-only demo mode |
| `/home/orders`, `/home/quotes`, `/home/subscriptions`, `/home/library` | Buyer views reused; legacy detail URLs remain under `/buyer` |
| `/home/profile`, `/home/submissions` | Account credentials, opportunities, drafts and submissions; no forced workspace selection |
| `/home/search` | Account/public search; same-origin supplier and marketplace API allowlists |
| `/home/tenders` | Compatibility account page |
| `/home/preview/[kind]/[id]` | Demo-only: orders, quotes, subscriptions, library, reservations; unknown IDs/kinds fail closed |
| `/tenders`, `/tenders/[siteSlug]`, `/tenders/[siteSlug]/[tenderSlug]` | Public snapshot reads, canonical site identity, public error/not-found states |

All above paths are covered by www's existing `/home` and `/tenders` prefix
rewrites. `/buyer` courses, tickets, downloads, booking, orders and quotes retain
legacy compatibility. `/course-resources/:path*` is newly forwarded: Next's
asset prefix does not include public MP4/worksheet files. Do not proxy all APIs
or internal workspace pages to solve a missing public dependency.

## Internal page inventory

These remain workspace-owned, not www routes:

- `/inventory/minimums`
- `/purchases/procurement/approvals`
- `/purchases/requests`, `/purchases/requests/new`, `/purchases/requests/[id]`
- `/purchases/rules`
- `/purchases/tenders`, `/purchases/tenders/new`, `/purchases/tenders/[id]`,
  `/purchases/tenders/[id]/edit`
- `/settings/procurement`, `/settings/tenders`
- `/suppliers`, `/suppliers/[id]`

## API inventory

All paths below start with `/api/procurement`. Each route retains independent
authentication/authorization and input validation; middleware is not the API
authorization boundary. The portal RPC is intentionally public and returns a
restricted projection. Processing endpoints retain their separate worker gates.

| Family | New suffixes | www |
| --- | --- | --- |
| Approvals | `/approvals`, `/approvals/inbox`, `/approvals/[id]/decisions` | No |
| Catalog | `/catalog/[id]` | No |
| Commerce | `/commerce/approvals`, `/commerce/options`, `/commerce/orders`, `/commerce/quotes`, `/commerce/quotes/[id]`, `/commerce/receipts` | No |
| Supplier submissions | `/commerce/submissions` | Yes |
| Credentials | `/credentials`, `/credentials/[id]`, `/credentials/drafts`, `/credentials/drafts/list`, `/credentials/participation`, `/credentials/participation/register`, `/credentials/revisions/[id]/file` | Yes |
| Evidence management | `/credentials/proposals`, `/credentials/representatives`, `/credentials/shared` | No |
| Policy | `/policy`, `/references` | No |
| Replenishment | `/replenishment`, `/replenishment/[id]/evaluate`, `/replenishment/cases/[id]/close`, `/replenishment/process` | No |
| Requests | `/requests`, `/requests/taxes`, `/requests/[id]`, `/requests/[id]/decisions`, `/requests/[id]/revalidate`, `/requests/[id]/submit` | No |
| Suppliers | `/suppliers`, `/suppliers/references`, `/suppliers/[id]`, `/suppliers/[id]/activity`, `/suppliers/[id]/company` | No |
| Tenders | `/tenders`, `/tenders/portal`, `/tenders/[id]`, `/tenders/[id]/participants`, `/tenders/[id]/publish` | No |

## Corrections from this review

- Added course-resource proxy coverage, including byte-range and HEAD tests.
- Commerce POST handlers now reject untrusted origins before authentication/RPC
  and reject disguised JSON media types. Supplier credential writes support the
  exact www/apex HTTPS origins when targeting the fixed app origin; no arbitrary
  forwarded-host or sibling-domain trust was added.
- Submission preflight uses the API schema before recording an immutable
  attempt. The input limit is 120; older 200-character drafts remain readable
  and editable before an attempt. Ambiguous retries remain locked/idempotent.
- Expired-session account redirects retain query parameters. Canonical tender
  detail redirects retain submission intent and repeated query values.
- The demo awarded-order link uses a hard navigation to app, not a missing www
  workspace path, carrying the explicit fictional demo selection.
- Preserved the documented supplier-detail policy: contacts are created in the
  creation form and existing contacts edited in detail; no Add action in detail.
- Fixed icon boolean types and test typing/setup failures. Integrated master's
  reservation timezone behavior without dropping preview slots.
- Fixed commercial `FeatureBentoCard`'s mismatched JSX closing tag.

## Validation evidence

- App `npm run typecheck`: passed after integration fixes (no production build).
- Reservation/payment/type-fix checks: 7 suites, 43 tests passed.
- Supplier preflight/account redirect checks: 4 suites, 58 tests passed.
- Commerce origin/API/evidence checks: 4 suites, 38 tests passed.
- Public canonical routing checks: 2 suites, 5 tests passed.
- Public demo/origin/redirect checks: 3 suites, 19 tests passed.
- Commercial proxy/transport/middleware/theme: 4 suites, 285 tests passed.
- Actual local Next www→app HTTP checks: 15 portal paths plus `/tenders` returned
  HTML 200 in existing demo mode. Ordinary/segment RSC returned
  `text/x-component` after Next normalized `_rsc`. Actual video bytes matched
  app with 206 `bytes=0-31`; worksheet bytes matched too.
- Initial expanded app run: 194 suites, 181 passed, 13 failed; 1,686 tests
  passed, 25 failed, 5 skipped. Follow-up repairs must be reported separately,
  not counted as a clean rerun of all 194 suites.
- Follow-up of those 13 failing suites: seven repaired-fixture suites produced
  60 passes and one failure; the other six produced 56 passes and six failures.
  **Seven failures remain**, including locale-sensitive currency formatting,
  hardcoded procurement copy, stale order/demo layout assertions, a tender
  loading-layout assertion and credential metadata presentation. Assertions were
  not removed to manufacture a green result.
- Initial full commercial run: 103 suites, 84 passed, 19 failed; 1,461 tests
  passed, 83 failed. Full TypeScript after the JSX repair still reports 1,482
  diagnostics across legacy code. The default ESLint command lacks flat config.

Passing groups overlap; do not add their counts into a unique-test total.
HTTP fixtures and demo presentation do not prove live authenticated supplier
flows, hydration, payment behavior or deployed Vercel routing. Browser MCP tools
were unavailable; no visual/browser acceptance is claimed.

## Merge and release gates

1. Review and commit the intended local files in both repositories only after
   approval; do not merge just `40675392` and omit the substantial untracked work.
2. The committed-only merge is clean, but current local changes introduce three
   additive hunks in `ReservationSlotPicker.tsx`. The prepared worktree includes
   **both** `previewSlots` and `displayTimezone` in props, destructuring and effect
   dependencies. Keep both when resolving the actual merge. No merge ancestry
   has been recorded; integrating source does not eliminate Git's later conflict.
3. Six other overlaps auto-merge in the read-only audit: client wrapper,
   commerce checkout, root layout, reservation page, Development and docs index.
   The remaining master-only changes still need the real merge and its tests.
4. Resolve remaining regression/localization failures and commercial type/lint
   debt or explicitly agree a scoped release gate. Do not disable safety checks.
5. There are **35 new migrations** relative to master. Their remote application
   state is not verified. Confirm the target, schema, ordering and grants/RLS,
   obtain approval, and validate the entire pending chain before deployment.
   Some timestamps are later than the review date; do not assume calendar time
   establishes which versions are already installed.
6. Deploy the compatible app and database before commercial-site's matching
   proxy release. Verify a real published tender and a supplier without a
   workspace: sign-in return, draft save/resume, uploads/downloads, submission,
   denied access, search and legacy buyer details.
7. Re-run integration checks after the actual master merge; no remote fetch was
   performed, so local refs are not evidence of current GitHub state.

Remaining failing suites:

- `__tests__/procurement/partners-localization.test.tsx`
- `__tests__/procurement/portal-localization.test.tsx`
- `__tests__/procurement/localization-contract.test.ts`
- `__tests__/procurement/workspace-order-detail.test.tsx`
- `__tests__/procurement/home-demo-sections.test.tsx`
- `__tests__/procurement/home-demo-details.test.tsx`
- `__tests__/procurement/tender-marketplace-design.test.tsx`