# Procurement repair validation

This change addresses the 2026-10-28 local implementation review. It is not a
deployment or a claim that the entire procurement design is complete.

## Covered regressions

- Legacy seller, buyer and public quotation projections explicitly select the
  `site_id` relationship, despite the new `buyer_site_id` foreign key.
- Linked requisition requirements and proposal minimums remain cumulative at
  subsequent procurement transitions; unresolved requirements do not pass merely
  because a new event's policy has no requirements.
- Published tender request provenance is kept privately, without adding internal
  IDs or policy data to public DTOs. Unpublished edits cannot become effective by
  closing the tender instead of obtaining publication approval.
- Request revalidation preserves line/tax history and requires fresh submission
  and approvals. Archiving a rule does not require its former approvers to remain
  eligible for unrelated new requisitions.
- The replenishment endpoint explicitly authorizes cookie-free system access and
  uses one database transaction per queued rule. Inactive references can be
  disabled without allowing new or re-enabled rules to bypass eligibility.
- Replenishment rules and cases have independent pages, exact counts and linked
  worker status. Nothing is silently hidden after 200 rows.
- Definitive initial receipt validation failures unlock the draft for correction.
  A prior uncertain attempt retains its idempotency identity and locked input.
  Order list refresh can recover from an earlier load error.

## Revalidation and publication provenance

Owners/administrators with unrestricted location access and update permission
can choose **Revalidate approval** on an approved request. Confirmation calls
`POST /api/procurement/requests/[id]/revalidate` with `expected_revision`.
The database copies the current quantities, estimates, categories and taxes to a
new draft revision without changing the approved financial content. Prior line
versions, stages, votes and audit records remain immutable. The new draft must
be submitted normally under the current policy; old votes are never reused.

Revalidated drafts cannot edit that financial content. A returned revalidation
can explicitly restart unchanged. Existing linked purchase orders prevent the
reset, including a concurrent order committing during the operation.

Original published request obligations remain cumulative after revalidation or
an amended publication. Unresolved participation requirements block publication;
participation/evaluation/award requirements block award; order requirements also
block the PO. The missing receipt/credential acceptance workflows are not
simulated or automatically considered satisfied.

Private publication bindings are backfilled only from the exact saved tender
version and request submission audit. Missing provenance blocks progression.
Internal request IDs, estimates and plans are never added to public snapshots.

## Local checks

```bash
npm test -- --runInBand __tests__/procurement __tests__/licensing
npm test -- --runInBand __tests__/commerce __tests__/buyer __tests__/quotations __tests__/catalog
npm run typecheck
```

The quotation relationship regression also exercises real PostgREST over an
isolated PostgreSQL database when the installed binary is supplied:

```bash
POSTGREST_TEST_BIN=/absolute/path/to/postgrest npm test -- --runInBand \
  __tests__/procurement/quotation-relations.test.ts
```

That suite never downloads binaries or connects to the configured Supabase
project. Without local PostgreSQL/PostgREST binaries it explicitly skips the
live cases; the source projection regression still runs. It checks all four
application projections, the original ambiguity and procurement-row isolation.
SQL fixtures use synthetic core tables/auth dependencies plus actual procurement
migrations. They do not replace authenticated browser acceptance or remote
schema/grant verification.

Validation on 2026-10-28: the combined procurement/licensing run passed all
540 tests across 52 suites, with the local PostgREST binary enabled. The expanded
commerce/buyer/quotation/catalog run passed 1,152 of 1,153 tests; the unchanged
quotation email locale expectation remains the sole failure. Module lint and
`git diff --check` passed. Global typecheck still reports the pre-existing
`manual-reservation-contract.test.ts:96` TS2454. The two legacy quotation action
files retain their pre-existing nine explicit-any lint errors; their relationship
changes introduced no new lint findings. No production build or remote write ran.

## Release prerequisites

- Review and apply all pending migrations in order with explicit target approval.
  The new repair migrations do not edit historical migration files.
- Roll out the single-job replenishment processor and the matching HTTP worker
  together. Older callers passing a batch limit are intentionally rejected.
- Review existing published-document provenance before rollout. Incomplete
  historical evidence must fail closed instead of guessing an approved binding.
- Configure the external worker separately; no scheduler is installed here.
- Complete authenticated visual checks in an approved disposable environment.
- Remaining AI, credential review, stock-posting receipt, direct-buy and bill
  reconciliation scope remains in the implementation guide.