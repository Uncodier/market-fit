# Procurement and finance browser backlog — 2026-10-31

See [audit evidence and release gates](preproduction-20261031.md). All paths are
relative to `/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit`. The recent
9/9 procurement run covers nine specific scenarios, not all variations below.
Existing Jest/SQL files establish local test implementation, not fresh execution
by this audit. Test scopes are intentionally different from product completeness.

| ID | Priority | Screens and missing edge scenarios | Source / current evidence |
|---|---|---|---|
| B01 | P0 | Public tender submission at exact deadline: sheet open before close, submit at/after close, buyer timezone differs, immutable amendment issued during editing. Deny late/stale submission without partial quote/evidence/registration effects. | `app/home/submissions/submission-form.tsx`, quotation capture/submission migrations; `__tests__/procurement/commerce-postgres.test.ts`. Recent browser tests do not submit at deadline equality. |
| B02 | P0 | Sealed disclosure transition: opening timestamp before closing must not disclose early; after both gates, allowed buyer sees exact prices/files and other actors still cannot. Cancellation/private portal/archival during open file request, stale envelope cache and refresh errors must fail safely. | `app/purchases/procurement/evidence`, `app/purchases/quotes/quotation-detail.tsx`; `__tests__/procurement/proposal-postgres.test.ts`, `quotation-envelopes-postgres.test.ts`. Live sealed case proves pre-open metadata-only view, not clock-driven opening. |
| B03 | P0 | Concurrent approval/vote/adjudication: two eligible managers, approve/reject race, same vote twice, changed reason/key, actor revoked during pending dialog, response lost after publication/order finalization. Exactly one vote/effect, conflict explained and no automatic resubmission. | `app/api/procurement/approvals/[id]/decisions/route.ts`, `app/purchases/procurement/approvals`; `event-approvals-postgres.test.ts`. Live rejection has sequential opposite replay, not concurrency. |
| B04 | P1 | Draft persistence/isolation: two tabs same draft revision, personal↔two businesses, changed publication/version, edited draft after submit attempt, upload pending, DB failure, fresh login/resume/delete. Preserve newest state and correct applicant; do not silently overwrite or submit twice. | `app/home/submissions/use-submission-draft.ts`, `app/api/procurement/credentials/drafts`; drafts/list PostgreSQL suites. Live saves/resumes one personal draft and tests a business switch. |
| B05 | P0 | Evidence limits/lifecycle: empty/oversized/truncated file, wrong MIME/signature, malicious filename, quota exact boundary, interrupted Storage upload/completion, expired reservation, archived/revoked revision, other applicant/private file and browser caching. Completion requires exact backend bytes/MIME; rejected upload never becomes ready/shared. | `app/api/procurement/credentials/route.ts`, `20261030230000_procurement_storage_admission.sql`; `credential-storage-postgres.test.ts`, evidence/proposal/storage suites. Valid PDF/sharing passed live; malformed/quota/uncertain uploads lack browser evidence. |
| B06 | P1 | Tenders/policies/suppliers/requests: two editors stale version, amend after submissions/pending approval, global/public/private/unlisted/invitation settings, withdrawn/revoked supplier with existing draft, duplicate primary contact and foreign reference. Published snapshots and historical approvals stay immutable; no silent retargeting. | `app/purchases/tenders`, `app/suppliers`, `app/purchases/procurement/domain`; lifecycle/suppliers/publication PostgreSQL suites. Live amendment uses no competing edit/submission. |
| B07 | P0 | Tender order partial receipts: quantity 2 as 1+1, concurrent remaining quantity, same receipt key/payload replay versus changed payload, multiline overreceipt, response lost then explicit retry. One receipt effect; all invalid lines roll back; immutable accepted quantities never resurrect. | `app/purchases/procurement/commerce/ProcurementOrdersPanel.tsx`, commerce receipt migration/RPC; `commerce-postgres.test.ts`. Live mapped order accepts one full quantity-2 non-stock line. |
| B08 | P0 | Ordinary Bills stock receipt: concurrent receive/two bills same SKU, failed second stock write, missing/wrong/restricted location, repeated acknowledgement and stock-received flag failure. Inventory and source completion must agree atomically or expose a recoverable partial state. | `app/purchases/actions.ts#receivePurchaseStock`; `__tests__/purchases/actions-security.test.ts`. REVIEW_RISK: per-line writes followed by flag, unchecked item errors; no transaction/conservation E2E proof. |
| B09 | P0 | Bills payment registration: partial/full, exact outstanding balance, duplicate click/two tabs, timeout after save, legacy payment history, wrong decimal/currency. Retain every legitimate payment once and reconcile due amount plus dated accounting entries. | `app/purchases/actions.ts#registerPurchasePayment`; `actions-accounting.test.ts`. REVIEW_RISK: timestamp-generated payment ID and direct payment-only update without visible compare-and-set/idempotency key. |
| B10 | P0 | Bill/journal lifecycle: posted source edits, payment after date change, account/line change, unpublish/delete while another tab pays, synchronization failed after source saved. No fake success, lost cash history or partial ledger; pending review must be explicit. | `app/purchases/actions.ts`, `app/accounting/ensure.ts`, `app/accounting/source-lifecycle.ts`; accounting integrity/source lifecycle/dated-posting tests. |
| B11 | P0 | Accounts receivable/buyer payable documents/wallet payouts: balance changed while dialog open, partial/overpayment, second tenant/user, expired token, withdrawal requested twice or competing available balance, provider failure and lost acknowledgement. Wallet, credits, receivable and ledger balances remain distinct. | `app/accounts-receivable`, `app/payments`, `app/admin/payouts`, `app/api/stripe/checkout`; payout/public-checkout/account-receivable suites. Dedicated financial fixtures/provider permission required. |
| B12 | P1 | Requisitions: multiline catalog/service estimates, tax/null handling, submit/edit/resubmit, multiple approvers/quorum/self vote, stale policy, missing required reference, linked tender launching from exact request. UI draft must not imply approval or execute unsupported policy outcomes. | `app/purchases/requests`, `app/purchases/procurement/approvals`; requests/event-approval/lifecycle PostgreSQL suites. Not part of live nine-scenario battery. |
| B13 | P1 | Replenishment/minimums: zero vs unreadable stock, exact minimum/rounding, concurrent Check stock, already outstanding request/order, changed supplier mapping, deleted location, manager revoked before worker, failed enqueue/worker duplicate recovery. No duplicate demand or unauthorized background creation. | `app/purchases/procurement/replenishment/rules.tsx`, `docs/PROCUREMENT_REPLENISHMENT.md`; replenishment/queue/worker PostgreSQL suites. Scheduler activation is separate proof. |
| B14 | P1 | Accounting chart/manual journals: balanced/nonbalanced/zero/third decimal/huge amount, foreign dimensions, missing account, system/referenced account deletion, marketing/collaborator rights, simultaneous opening entries/stale hash. Persist/refresh and source links must match ledger. | `app/accounting/access.ts`, `app/accounting/entries.ts`; accounting access/migration/journal suites. Finance read YAML is not mutation/ledger acceptance. |
| B15 | P1 | Finance and exports: UTC midnight, date-range overlap, two currencies, missing/malformed journal, more rows than display cap, rapid site/period/section changes and stale download callback. Exact CSV values/filter scope must match valid ledger; null never silently becomes zero. | `app/finance/components/FinanceReportsClient.tsx`, report export modules; accounting finance UI/export tests. Known source metric/date limitations remain separate from CSV serialization. |
| B16 | P0 | Billing/credits/license lifecycle: repeated initialization after spending, two-tab purchase/upgrade, canceled checkout, annual periods/add-ons, trial expiry, manually disabled member/channel, insufficient credits, repeated/reordered settlement and auto-top-up concurrency. No refills/extra grants or accidental reactivation; verified paid windows own entitlements. | `app/api/billing/initialize/route.ts`, `app/api/stripe/checkout/credits/route.ts`, `docs/AUTO_TOP_UP.md`, `docs/AGENT_CHANNEL_ACTIVATION.md`; billing/settlement/licensing PostgreSQL/Jest suites. Manual QA license capacity does not prove Stripe. |

## Unsupported behavior — prove a blocker, not fabricated success

Verify current implementation guide/API contracts before each batch. The inspected
code/documentation does not provide complete successful workflows for:

- AI credential authenticity/acceptance assessment or delegated approval workers.
- Full organization credential/representation authority and legal evidence review.
- Every mandatory taxonomy/expiry/equivalence/supervisor rule from the design.
- Full business-calendar sequential/relative deadline execution.
- Direct procurement without a tender, submitted quotation replacement/withdrawal.
- Buyer-authorized mapping/tax resolution of immutable free-text offers into
  order-ready quotations. A free-text offer can be submitted/awarded but cannot
  bypass the missing order mapping.
- Tender stock movement, bill allocation/discrepancy/payment reconciliation.
- Advanced inventory valuation/period-close processes and every supplier sourcing
  conversion/SKU-preference extension.

These items require implementation decisions or explicit feature gating. Existing
UI controls/configuration must not suggest that an unimplemented enforcement or
worker succeeded. Not every item on an older delivery checklist is current; use
source and forward migrations to establish the actual boundary.

## Required fixtures and test layers

At least two eligible approvers, restricted/read-only/revoked actors, two supplier
businesses and personal applicants; published amendments with existing drafts and
submissions; short real deadlines; invalid/limit-size synthetic PDFs; multiline
mapped offers/orders; partially received stock; dated/legacy/paid bills; finite
wallet/credit balances; valid/invalid journals and two currencies.

Browser tests prove the real dialog and recovery state. Isolated PostgreSQL tests
must separately prove concurrency, rollback, exact monetary/quantity invariants
and RLS. Provider tests prove actual delivery/settlement using authorized sandbox
accounts; neither mocks nor manual paid-state injection substitutes for them.