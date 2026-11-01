# Cross-screen subsystem E2E journeys

## Azure execution result — 2026-10-31

Exact run `qa-1793416143622-f99088dc-subsystems-6670798f` completed **2/2 passed**
on the disposable Azure VM, plus real admin login, without skips or retries.
Earlier failing attempts are retained separately. Tests ran as an uncommitted
overlay over recorded service snapshots; the clean-Git provenance health gate
remains false. See [the execution report](../qa-disposable/procurement-subsystems-20261031.md).

## Scope

Select explicitly with `--suite subsystems`. This native Playwright suite never
joins smoke or root YAML regression discovery, uses one Chromium worker and no
automatic retries, and has a 20-minute suite timeout.

1. **POS → customer → CRM → POS**: search the exact QA lead through the actual
   customer picker, verify the name/email and selected checkmark, inspect the
   application's IndexedDB cart session read-only for the exact lead UUID, reload
   and visit the same CRM lead, then return to POS and prove selection persists.
   The browser basket must initially be empty. No checkout/order/payment occurs.
2. **Lead → Commerce → Quotation → Lead**: open the exact lead's Commerce tab and
   Quotations subtab, find the exact linked sales quotation (paginating if needed),
   open it, verify both persistent identities, reload, return through browser
   history and re-read the same quotation under the authenticated user's RLS.

## Environment and ownership

Use the existing installer inside its disposable Azure VM. `TEST_TARGET=local`
refers to loopback services **on that VM**, not production or a local substitute.
The suite requires `QA_STATUS=VERIFIED`, exact `QA_ENVIRONMENT_ID`,
`SHIPLIGHT_RUN_ID=<qa-id>-subsystems-<unique-suffix>`, both mutation flags,
public-key Supabase configuration and at least 20 minutes before `QA_EXPIRES_AT`.
Admin Auth metadata, site description and lead metadata must match the exact
installer QA marker, ID and expiry. Browser and backend account identity must agree.

`TEST_LEAD_NAME` must resolve to one same-site QA fixture. The optional
`TEST_QUOTATION_ID` must be a same-site, exact-lead `purpose=sales` quotation;
the test never updates or deletes a supplied quotation. Without it, setup creates
one zero-total, empty draft through the authorized public-key user session with a
preallocated UUID and exact run-owned notes. The actual schema has no quotation
`title` column. Cleanup requires matching UUID/site/lead/sales-purpose/notes/draft
state and independently verifies absence. Changed
or ambiguous identities fail closed; no broad deletion, upsert or service role.

## Validation and evidence

```sh
npm run test:e2e -- --suite subsystems --list
npm test -- --runInBand __tests__/e2e/subsystem-crossflows.test.ts __tests__/e2e/qa-module-policy.test.ts
```

Discovery and Jest are offline evidence only. The native browser specs contain no
API interception, mocked backend or injected browser session/cart state. Fake
database chains appear only in offline cleanup-policy regression tests.

Live run IDs, deployed source snapshots, testing-overlay hashes, outcomes and
remaining defects must be recorded separately after execution on Azure. Failure
artifacts may contain authenticated synthetic data; retain them privately and use
the installer's allowlisted evidence export, never upload dotenv or Auth state.

These two journeys are an initial cross-screen battery, not a claim that every
screen/modal, fulfillment, booking, Stripe or integration subsystem is covered.