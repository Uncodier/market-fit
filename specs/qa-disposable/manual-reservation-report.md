# Manual Reservation Contract Implementation Report

## Scope and result

**Live manual reservation segment: NOT RUN.** No browser session, database write,
provider call, payment or cleanup mutation occurred. The existing manual YAML and
generated `.yaml.spec.ts` files were deliberately left unchanged.

Producer documentation was read before implementation. Its browser-walk and
real-locator requirements could not be satisfied in this source-only task, so
the authorized fallback was selected: local positive/negative fixture contracts.
No provider was simulated; database reads in Jest use an isolated test double.
These checks integrate the real private filesystem journal with contract logic;
they are not local-Supabase or end-to-end integration results.

## Source-supported minimal contract

- `CreateReservationDialog.tsx` uses `submitServiceReservationForm`, not the
  separate public/admin `BookingExperience` upsert flow.
- `reservation-dialog-submit.ts:188–204` calls `saveServiceReservation` and
  discards its returned row after showing success.
- `sale-order-actions.ts:261–313` saves the reservation, creates/links an
  order/sale, and returns the exact reservation row. It can return an error
  **after the reservation committed**.
- `reservation-dialog-service-fields.tsx:237–244` provides
  `#reservation-notes`, allowing a run-owned marker before submit.
- The installed Next.js server-actions guide describes one Flight response
  carrying both returned data and rendered UI. A substring UUID extractor is
  not a trustworthy action-result decoder.

`tests/agent/reservations/manual-contract.ts` accepts only a decoded successful
result with exact site/item/customer/run-notes marker, confirmed status, valid
ordered timestamps and reservation/order-line UUIDs. It writes an exclusive
0600 journal, refuses stale or inconsistent ownership, and uses the existing
authenticated public-key `fixtureClient` for an exact site+reservation-ID RLS
read. Read errors/denials do not count as absence or successful persistence.

The journal records exact cleanup candidate IDs but always retains
`cleanup.completed: false` and an explicit financial-dependency blocker. It
does not authorize or execute deletion, claim payment, or claim full agent
evidence. Persistence is returned to the caller; no completed/persisted journal
state is fabricated.

## Remaining blockers before YAML wiring

1. Browser-confirmed current manual UI flow and actual action response encoding.
2. An action-return decoder/correlation adapter tied to the submitted
   `saveServiceReservation` request and run-owned notes, with bounded waiting
   and fail-closed handling of unsupported Flight references/errors. Do not
   use the first POST response or search all response/UI UUIDs.
3. Pre-submit durable intent and safe reconciliation for partial commits and
   lost responses. Never retry ambiguously committed creation automatically.
4. Exact order/sale/line dependency discovery and cleanup policy preserving
   financial audit/permission constraints. Cancelling a reservation alone does
   not prove all its order/sale side effects were cleaned.
5. Configured local schema, isolated current-run item/customer, availability,
   fresh browser auth matching the public-key verification account, and both
   explicit mutation flags.

Until these are satisfied, the contract is preparatory support only. Do not wire
an unsafe cleanup or mark the three-channel reservation agent PASS.

## Validation commands

- `npm test -- --runInBand __tests__/e2e/manual-reservation-contract.test.ts __tests__/e2e/mutation-fixtures.test.ts __tests__/e2e/mutation-safety.test.ts`
- `npx --no-install eslint tests/agent/reservations/manual-contract.ts __tests__/e2e/manual-reservation-contract.test.ts`

Results are reported separately from live status. No provision-qa module,
installer, generated YAML file or application source was edited.

Final validation: **3 Jest suites / 80 tests passed** (including the new
positive/negative contract suite); targeted ESLint and `git diff --check`
completed successfully. An initial run caught an overly specific error-message
matcher and an explicit-any lint error in the new test; both were corrected and
the listed checks rerun. This is local contract evidence only. Live manual
reservation and local-Supabase execution remain **NOT RUN**.