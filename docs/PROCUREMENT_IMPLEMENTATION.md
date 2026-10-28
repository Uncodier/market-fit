# Procurement Implementation and Remaining Scope

**Status:** local branch implementation, 2026-10-27. Not deployed. The full buying
workflow remains described in [the main design](PROCUREMENT_AND_TENDERS_DESIGN.md).
The [delivery checklist](PROCUREMENT_DELIVERY_CHECKLIST.md) tracks completion rather
than treating a route or configuration toggle as an implemented workflow.

## Available surfaces

- **Settings > Procurement** (`/settings/procurement`): general policy configuration.
- **Buying > Procurement Rules** (`/purchases/rules`): scoped rule editing and simulation.
- `GET /api/procurement/policy?site_id=<uuid>` returns the latest policy revision.
- `PUT` on the same route accepts `{ expected_revision, document }` and appends a revision.
- `GET /api/procurement/references?site_id=<uuid>&kind=people|products|categories|agents&q=`
  searches workspace references. Results are limited to 50 with `has_more`.

These two screens remain configuration tools. The operational routes below now consume
saved policy snapshots for request submission, tender publication, awards and orders.
They do not retroactively enforce rules on legacy commerce orders, Bills or payments.

## Operational surfaces added

- `/suppliers` and `/suppliers/[id]`: private relationships, lifecycle, contacts,
  categories, terms, notes, activity and verified-account representation management.
- `/purchases/requests` (including create/detail): catalog-cost or explicit manager
  service estimates, tax snapshots, revisions, submission and human approval stages.
- `/purchases/procurement/approvals`: visible request and event approval queues.
- `/purchases/tenders`: draft editing, immutable publication history, independent
  publication approval, portal activation, invitation register and lifecycle controls.
- `/tenders`, site and tender detail: public/unlisted minimal publication projections,
  global opt-in/revocation, independent participation/opening settings and account CTA.
- Existing `/purchases/quotes` and `/purchases/orders`: procurement panels alongside
  legacy commerce views. Quotes reuse `quotations`/`quotation_items`, with separate
  buyer custody and seller/public-token isolation. Awards and orders have separate
  policy approvals. Non-stock acceptance is partial and idempotent; no stock is posted.
- `/home`: additive account portal using BuyerShell, existing buying views, personal
  credentials and supplier activity. `/buyer` remains supported, not yet fully migrated.
- `/catalog/[id]` Procurement tab: independent capability and append-only dated supplier
  sourcing offers, units/conversion, minimums and terms. Sales-only filtering is pending.

External proposals require an explicit verified-account supplier grant, eligible
participation and an open publication. Submission stores the exact quotation/publication
and selected personal-evidence revisions. Buyer access honors the published opening gate.
See [evidence implementation](../app/purchases/procurement/evidence/README.md).

## Policy model

The versioned document contains `version: 1`, `settings`, and `rules`. Zod schemas
and a deterministic simulator live under `app/purchases/procurement/domain/`.

- Requisition, offer, publication, award and order events are distinct.
- Thresholds use integer net minor units and explicit currency/operators. Product
  tax calculation belongs to future document creation, not the policy simulator.
- Matching rules accumulate approval stages, requirements and supplier minimums.
- No-match resolution uses the supplied document fallback, then general fallback.
- Unconfigured fallback blocks. A manager must explicitly choose no approval or stages.
- Quorum, rejection behavior, cross-rule counting, self-approval and deadlines are visible
  configuration. Initial form values are editable starting values, not mandatory policy.
- Human, AI-assisted and automatic-AI authority are represented, but no model executes.
- Human approvals are operational. AI-assisted/automatic stages remain pending and
  cannot be completed by a human masquerading as an agent; the external worker is absent.
- Exceptions retain supervisor authority; urgency is a configurable preset, not a bypass.
- Every simulation returns `simulationOnly: true` and `authorized: false`, including
  when policy resolution succeeds. Its input is hypothetical, not trusted financial data.

Currency conversion and business calendars are not implemented. Missing FX, needed
classification/actors or timing anchors block simulation instead of inventing values.
Calendar durations currently represent elapsed hours (one day = 24 hours, one week =
168 hours); local business-day and daylight-saving-aware wall-clock scheduling is not
an implemented scheduler. Shared/independent counting is carried into the plan; this
slice does not cast votes or execute quorum decisions.

## Security and persistence

Policy configuration access requires an active, authorized owner/admin and an unrestricted
workspace scope. Demo configuration is unavailable. Every API authenticates and
authorizes independently. Policy storage uses the user-scoped client. Operational plan
submission uses a service-only RPC only after explicit user-scoped authorization and
resource/policy validation, with a database actor/revision recheck. Human votes are user-scoped.
Configuration access is intentionally narrower than future operational approval access.

The API validates the complete schema and same-workspace people, agents, products and
categories before saving. Supervisor/approver references use user IDs, not membership IDs.
Archiving an existing rule without changing its definition preserves historical references,
even if they are no longer eligible. Unchanged archived rules can remain in later snapshots.
New/edited archived definitions and reactivated rules undergo reference validation again.
Old snapshots remain untouched.

`20261027160000_procurement_policy_versions.sql` creates immutable policy history and
the `save_procurement_policy` RPC. RLS permits manager reads; authenticated clients
cannot insert/update/delete/truncate the table directly. The RPC checks authorization,
derives actor/time on the server and serializes expected-revision checks, including the
first save. Stale writes return `409`; the editor must reload instead of overwriting.

The database validates the document envelope and a 256 KiB canonical JSON size limit.
The API also caps streamed request bytes. Nested semantic/reference validation is at
the API boundary in this slice: a manager calling the RPC directly can bypass it.
Stored configuration is **not execution authority**. Future consumers must validate
the full schema, reference eligibility, permissions and exact document revision again.
Invalid stored documents cause a read error, never a silent default or approval.
Recovery of a malformed snapshot written through a direct RPC requires an authorized
corrective revision through database tooling; the editor does not overwrite unreadable
history. Policy snapshot revision is authoritative. API saves also assign per-rule
versions (new rule = 1, changed rule = previous + 1, unchanged rule = previous).
Agent/catalog reference checks establish workspace ownership, not operational eligibility;
those statuses and membership must be checked again at workflow execution time.

## Migration and deployment

The target schema was inspected read-only on Makinari; no procurement tables existed.
No remote migration has been applied. Until the migration is approved and applied,
policy reads/writes report storage unavailable rather than use mock persistence.

Operational migrations follow in timestamp order: suppliers `170000`, requests `171000`,
tenders/publications/events `172000`–`172002`, quotation/order boundaries `173000`–`173005`,
representation/credentials `174000`–`174001`, submission evidence `174200`, and catalog
procurement `175000`, all prefixed `20261027`. Existing core tables are not bootstrapped.
Apply the forward correction `20261028001000_procurement_approval_revalidation.sql`
after that chain. It prevents publication approval using stale policy revisions,
excludes withdrawn required invitations from proposal minimums, and restricts request
visibility to approvers assigned to the current revision. Earlier migrations are unchanged.

Follow [the migration guide](DATABASE_MIGRATIONS.md). Confirm the target project and
authorization before applying. Dependencies include `sites`, `auth.uid()`,
`current_user_site_role(uuid)` and `current_user_has_site_location_restrictions(uuid)`.
The last two must retain the active membership/license/archival and location boundaries.
After application, verify grants/RLS and run allowed/denied smoke tests on an approved
disposable target. Do not use production buying data for validation.

## Validation

```sh
npm test -- --runInBand __tests__/procurement __tests__/config/navigation-areas.test.ts __tests__/auth/screen-access.test.ts
npm run typecheck
```

Storage tests execute the actual migration in an isolated local PostgreSQL cluster;
existing identity/permission functions are fixture implementations. They do not prove
the remote project's permission functions behave identically. Tests skip explicitly
if PostgreSQL binaries cannot be found. API tests exercise the real authorization
helper with mocked session/database boundaries. UI tests do not replace authenticated E2E.

Operational branch review validation: all 368 tests across 35 selected suites passed,
including a combined migration chain from real supplier/grant/evidence through external
quotation, award and purchase order. Existing core tables/identity functions remain
fixture implementations. Targeted ESLint and `git diff --check` passed.
Global typecheck generated Next.js route types but failed on the pre-existing
`__tests__/e2e/manual-reservation-contract.test.ts:96` TS2454 (variable `row` used before
assignment). No procurement type errors were reported. Authenticated browser testing
was not performed: no disposable application target/credentials were configured and
the remote migration remains unapplied. No production build was run.
An expanded legacy buyer/quotation/commerce run passed 848 of 849 tests: the unchanged
`__tests__/quotations/send-quotation-email.test.ts:36` expects English greeting text from
a Spanish template. That pre-existing localization expectation was not changed here.
Local `/auth` and public `/tenders` respond HTTP 200; protected workspace pages redirect
anonymous requests to sign-in. This is not authenticated browser acceptance evidence.

The review corrected standalone Settings route matching, decimal entry/precision,
obsolete-reference archival, requester exclusion in resolved approval stages and
inconsistent revision/document API responses. Regression tests cover these cases.

The operational security review added three actual PostgreSQL regression cases for
the forward correction above. Final publication failures roll back the last vote and
publication atomically; no history is rewritten. Historical request assignments no
longer confer access to new unassigned revisions. This correction must be deployed
before treating these controls as active in a connected environment.

## Still to implement

This is **not complete implementation of the entire design**. Missing supported paths:

- AI assessment/recommendation/decision worker, certificate findings and issuer verification.
- Organization credential authority; mandatory taxonomy/scope/expiry acceptance gates.
  Unresolved evidence requirements block awards/orders rather than silently pass.
- Direct procurement order without a tender; freeform supplier quote capture; replacement
  and withdrawal of submitted quotations; linking an existing seller-issued quote.
- Full receipt with actual SKU/location stock movement, bill allocation and discrepancy
  handling, reconciliation and independent receipt/order evidence milestones.
- Operational urgent notifications, approval delegation/exceptions, escalation scheduling,
  business calendars and sequential relative deadline activation.
- Public self-registration without pre-authorized supplier representation, invitation email,
  clarification Q&A, bespoke legal version acceptance, branding and taxonomy browsing.
- Full `/buyer` URL migration, procurement-only catalog sales exclusion, supplier owner
  reassignment/filtering and expanded ordinary requester role support.

Current quote/PO capture requires catalog-matched lines and tender context. Approved
requisition does not approve publication/award/order. Public snapshots never include
internal estimates, catalog IDs, evaluations or competitor proposals. Pending/archived
credential files count against a 128 MiB account reservation cap; cleanup is not automated.
Live Supabase Storage metadata behavior must be verified before rollout.