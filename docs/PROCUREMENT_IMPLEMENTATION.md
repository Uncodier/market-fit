# Procurement Implementation and Remaining Scope

**Status:** local branch implementation, 2026-10-27. Not deployed. The full buying
workflow remains described in [the main design](PROCUREMENT_AND_TENDERS_DESIGN.md).
The [delivery checklist](PROCUREMENT_DELIVERY_CHECKLIST.md) tracks completion rather
than treating a route or configuration toggle as an implemented workflow.

The 2026-10-28 [repair validation guide](PROCUREMENT_REPAIR_VALIDATION.md) records
the follow-up fixes to legacy quotation relationships, inherited requirements,
publication provenance, request revalidation and the replenishment worker. Its
new forward migrations and matching application changes are not deployed.

## Approval decision replay repair

`20261030160000_procurement_decision_replay.sql` is a forward correction prepared
locally, not applied remotely. It keeps tenant, capability, location and approver
checks, locks the approval and stage, and acknowledges an exact same-actor,
same-decision, same-trimmed-reason replay without inserting another vote or
repeating publication/order finalization. Changed votes and closed stages return
`PT409` (HTTP 409), not the retryable-looking `40001` serialization code.
Existing revision triggers and quorum rules remain intact.

The decision API rejects already-closed approvals before calling the RPC. Both
event approval dialogs synchronously guard duplicate submissions and block further
writes after a conflict or unconfirmed timeout until the approval is reloaded.
No automatic write retries are introduced. Deploy the application and apply the
forward migration only after explicit target approval; this local repair does not
stop an independently running external caller or change production by itself.

Regression coverage: `decision-diagnostics.test.ts`, `event-approval-review.test.tsx`
and `event-approvals-postgres.test.ts` under `__tests__/procurement/`. The PostgreSQL
suite uses a disposable socket-only cluster, never a configured remote database.

## Available surfaces

### Sealed quotation receipt visibility

`20261030200000_procurement_quotation_envelopes.sql` adds an authenticated,
manager-authorized receipt-count projection. It groups unopened supplier submissions
by immutable publication, without the opened quotation list's 100-row limit, and
returns only tender/publication identity, published title, opening date and count.
Supplier identity, quotation reference, amounts, lines and attachments remain hidden.
The existing opening/RLS gates are unchanged. Buyer-recorded and on-receipt quotes
remain in the normal list; envelopes disappear from the summary after opening.

The received-quotation API returns `envelopes` alongside its existing `data` array.
Both the standalone list and embedded tender tab show receipt cards even when no
quotation can be opened. Review/search filters do not hide this receipt summary.
The tender Refresh action also reloads its quotations. Failed receipt queries
return an error, not a misleading zero count.

The migration was applied to the explicitly approved Makinari database and recorded
once in migration history. The canonical SQL copy is also in `makinari-db-scheme`.
Post-application verification used the authenticated owner role and confirmed the
reported sealed receipt is visible through the metadata-only projection; anonymous
and service-role execution remain revoked. No application deployment was performed.
Other environments must apply this migration **before** deploying the API change. Regression
coverage is in `quotation-envelopes-{api,ui,postgres}.test.ts(x)` under
`__tests__/procurement/`; PostgreSQL tests use only a disposable local cluster.

Receipt rows now reuse the document-list shell, with a compact count, sealed badge,
responsive opening date and one shared privacy notice. The Activity timeline merges
publication snapshots with individual receipt events, ordered by their real timestamps.
`20261030210000_procurement_receipt_activity.sql` derives these events from immutable
supplier-submitted quotations: existing receipts appear without a backfill, retries
do not create duplicate events, and history remains visible after opening. Its DTO
contains only the tender-local receipt number, receipt time, publication ID and version;
it never returns quotation IDs, supplier identity, reference, amounts or attachments.
Buyer-recorded quotations are excluded. Manager, tenant, capability and location gates
remain enforced in PostgreSQL. The detail endpoint fails closed if the RPC is unavailable.
This additional migration was applied to Makinari with explicit approval and recorded
once; an identical copy is stored in `makinari-db-scheme`. Authenticated-owner validation
confirmed the existing submission appears exactly once and its contents remain sealed.
Other environments must install it before running the updated tender-detail endpoint.

- **Settings > Tenders** (`/settings?tab=tenders`): workspace-wide procurement policy
  and tender portal configuration. The design URL `/settings?tab=procurement` is an
  alias of the same tab; `/settings/tenders` redirects there, and the existing
  `/settings/procurement` screen remains available.
  Portal enabled state and its stable, read-only URL have their own save action,
  backed by the existing authenticated portal RPC. Visibility, global-directory
  permission, participation, opening, fallback and timings use versioned policy saves.
  These controls do not silently publish drafts or replace pending approval plans.
  Branding, editable portal slugs, approved legal versions, and per-field locked
  override controls from the design remain unimplemented; this screen does not claim
  to persist or enforce those unsupported settings. Settings are scoped to the active
  workspace, not globally shared across all workspaces in a user's account.
- **Buying > Procurement Rules** (`/purchases/rules`): scoped rule editing and simulation.
- `GET /api/procurement/policy?site_id=<uuid>` returns the latest policy revision.
- `PUT` on the same route accepts `{ expected_revision, document }` and appends a revision.
- `GET /api/procurement/references?site_id=<uuid>&kind=people|products|categories|agents&q=`
  searches workspace references. Results are limited to 50 with `has_more`.

These two screens remain configuration tools. The operational routes below now consume
saved policy snapshots for request submission, tender publication, awards and orders.
They do not retroactively enforce rules on legacy commerce orders, Bills or payments.

## Operational surfaces added

- **Inventory minimums** in Procurement rules: versioned per-SKU/location rules,
  recorded-stock checks, draft requisitions or persisted alerts, duplicate guards
  and a durable queue with a deployment-gated worker. See
  [Inventory replenishment](PROCUREMENT_REPLENISHMENT.md) for limits and rollout.

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
  Exception: the first tender publication request in a workspace with no saved policy
  persists a minimal owner-or-admin approval fallback through the user-scoped policy RPC.
  The owner is read from `sites.user_id`; admins are read from active, non-disabled,
  non-license-suspended `site_members` in the same workspace, never from the client.
  Publication remains pending until one eligible owner or admin explicitly approves
  (first-response quorum, no mandatory owner vote, self-approval permitted).
  Approvers are pinned when this fallback is saved; later membership changes do not
  rewrite saved policies or pending plans. After applying
  `20261028200000_procurement_default_manager_decisions.sql`, the decision RPC resolves
  current owner/admin authority for the exact generated baseline, including the legacy
  `workspace-owner` default. One explicit manager vote is sufficient without rewriting
  the historical stage, and its actual actor is recorded. Current role, capabilities,
  location restrictions, pending state and finalization revision checks still apply.
  Customized policies and explicit rules retain their original assignment/quorum.
  Until this migration is applied, previously saved owner-only defaults still deny admins.
  Public/unlisted publication also requires an enabled workspace tender portal.
  A disabled portal rolls back the final vote atomically; decision screens report
  this blocker explicitly. Enable the portal from tender details before retrying;
  approval never silently enables public exposure.
  Event approval reads compare the saved workspace policy revision and, for
  publication, the working tender version. Mismatches retain their historical status
  but display a Deprecated badge in the inbox and document/review screens; review
  controls are read-only. Managers must request a new approval for current revisions.
  Apply `20261029120000_procurement_deprecated_approvals.sql` after the existing chain:
  its decision-insert trigger locks/rechecks policy and target revisions before every
  approval vote, including partial quorum votes and concurrent changes. API preflight
  is not a substitute for this database guard. Decision transport has a 20-second client deadline;
  timeout is an unconfirmed result, not rollback evidence. It never automatically
  retries and disables further votes in that dialog until status is reloaded.
  Explicit API rejection can close an obsolete publication approval without publishing
  the edited tender. Failures remain visible in the dialog footer with a tender-detail
  link, and successful responses must confirm the expected approval ID before closing.
  A failed approval is never automatically converted into rejection or correction.
  This saved general fallback also applies to subsequent procurement events.
  Existing policies, including blocking fallbacks and invalid snapshots, are never
  replaced. Concurrent first saves use the winning policy revision; lookup or save
  failures never authorize release. Bootstrap can persist even if later validation
  blocks publication; it does not change the tender's visibility or listing choices.
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

### Company submissions in Quotations

`20261030150000_workspace_quotation_reads.sql` follows open business participation
(`20261030140000`). It adds two authenticated, read-only RPCs used by the existing
`/quotations` list and `/quotations/[id]` detail, not a separate proposal API:

- `list_workspace_quotations(p_site, p_status='all', p_search='', p_page=1,
  p_page_size=50, p_sort='newest')` returns `{data, count}`. The **security-invoker**
  union retains existing sales quotation and lead RLS. Search, status, count,
  deterministic sorting and pagination apply to the complete union. Page size is
  1–100, page is 1–100000, search is at most 200 characters; sort is `newest`,
  `oldest`, or `updated_at`. Search is a case-insensitive literal substring over
  ID, tender title/reference and visible lead name/email.
- `get_business_procurement_quotation(p_site, p_id)` returns a safe invoice DTO,
  or null for non-company, sales or unknown IDs. Sales detail falls back to the
  existing user-scoped quotation read. Company items expose only ID, name,
  quantity, unit price and subtotal; totals use stored minor units divided by 100.

List rows contain only `id`, `purpose`, `status`, `total`, `currency`, `created_at`,
`updated_at`, `valid_until`, `lead:{name,email}`, `title`, `reference`, and
`tender_url`. Company status is the display value `sent`, not the protected stored
`draft`; this does not enable sales actions. Detail additionally exposes
`site:{name}`, `items`, `subtotal`, and `tax_total`, without buyer email. Tender
links use the stored public portal slug and tender slug; the existing route
redirects the portal slug to the current name-derived URL. Public tender
visibility/portal enablement still governs the destination independently.

Both RPCs require effective business membership/license, `user_can(site,'select')`
and Quotations screen access. Owners/admins retain the existing screen exemption.
Location-restricted or unknown location scope yields **no company rows**, while
the sales branch still uses its existing location RLS. Company attribution uses
only the immutable registration's publication, buyer site, supplier and acting
site; it never infers company identity from email, lead, name or submitter's
current membership. Historical company submissions remain after the submitter
leaves. Revoking the viewer's membership/license stops access. Personal and
unlinked supplier submissions remain outside this company projection.

No quotation/line RLS, private evidence/attachment grants, writes, checkout or
sales actions are expanded. Private-schema projection helpers authorize direct
calls too; only the two public RPCs are intended for the Data API. Keep the private
schema out of exposed PostgREST schemas. Deploy the forward migration before the
frontend RPC consumers, with the approval and schema checks below.

The existing quotations table displays a Tender badge linking to that tender;
normal row navigation still opens `/quotations/[id]`. Company details reuse
`QuotationInvoice` without sales mutation callbacks. Account and workspace changes
remount the list/detail to discard the previous scope's visible data. Personal
`/home/submissions` receipts are unchanged. The new forward migration has only
been validated in isolated local PostgreSQL, not applied to a remote target.

Regression: `npm test -- --runInBand __tests__/procurement/workspace-quotations-postgres.test.ts`.
This starts a disposable socket-only PostgreSQL cluster, using the business
participation fixture and real license functions, and never reads a configured
database URL. It covers member/revocation/screen/location boundaries, private
personal submissions, unchanged raw reads, invoker sales/lead RLS, and global
pagination beyond 100 company proposals. Local binaries use `SECURITY_TEST_PG_BIN`
or `/opt/homebrew/opt/postgresql@17/bin`; absent binaries explicitly skip the suite.

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