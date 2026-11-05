# Buying, procurement, and inventory replenishment

Companion to [the module guide](MODULES.md). Reviewed against local source on
**2026-11-04**. These are implemented local capabilities, not a certification of
application deployment, migration coverage, or live supplier/payment delivery.

## Maturity and access

- **Implemented slice:** persisted functionality and authorization exist, but the
  broader end-to-end product remains incomplete.
- **Configuration only:** a saved option or simulation does not prove its worker,
  notification, scheduling, or AI outcome is operational.
- **Deployment-gated:** compatible application code, migrations and any required
  service/scheduler must be verified in the chosen environment.

Procurement is workspace-scoped and currently manager-led, not unrestricted
employee self-service. APIs/RPCs validate identity, capability, membership,
location scope and document state. Personal supplier participation has a separate
account boundary; discovering a publication is not authorization to submit.

## Suppliers — `/suppliers`, `/suppliers/[id]`

- **Purpose/capabilities:** Maintain private supplier relationships with company or
  professional identity, contacts, categories, commercial terms, notes and activity.
  Search/filter the directory and manage Prospect, Under review, Approved, Blocked
  and Archived states. Revision checks protect concurrent edits.
- **Use:** Establish the supplier relationship, maintain its commercial information,
  and grant/revoke representation for an existing verified account when needed.
- **Limits:** Contact records and company links do not verify legal authority or
  deliver invitations. The detail currently edits existing contacts without an
  Add contact action. Directory search matches supplier names; primary-contact
  presentation is incomplete in the real list. Archival preserves history.
- **Maturity:** Implemented slice; organization credential authority, comprehensive
  related-document history and automatic supplier communication remain incomplete.
- **Source:** [List](../app/suppliers/components/supplier-list.tsx);
  [detail](../app/suppliers/components/supplier-detail.tsx);
  [API](../app/api/procurement/suppliers/route.ts).

## Purchase Requests — `/purchases/requests`

- **Purpose/capabilities:** Create, edit and submit requisitions; inspect line
  revisions, approval plans and history. Catalog costs/taxes are resolved on the
  server; services support explicit internal estimates. Submission pins the
  request and policy revisions. Returned requests can be corrected.
- **Use:** Prepare the required items/services, resolve missing cost/tax information,
  submit against the current policy and follow the human approval stages.
- **Limits:** Estimates are neither supplier offers nor payable totals. Missing
  financial inputs can block submission. Requisition approval does not authorize
  tender publication, award, purchase order, stock receipt or payment automatically.
- **Maturity:** Implemented slice; ordinary employee requester coverage and direct
  sourcing from an approved request are not complete.
- **Source:** [Detail](../app/purchases/requests/request-detail.tsx);
  [submission](../app/api/procurement/requests/[id]/submit/route.ts);
  [decisions](../app/api/procurement/requests/[id]/decisions/route.ts).

## Approvals — `/purchases/procurement/approvals`

- **Purpose/capabilities:** Paginated requisition and publication/award/order inbox
  with type/status filters, document review and reasoned human decisions.
  Backend rules enforce eligible actors, quorum, self-approval restrictions and
  saved document/policy revisions.
- **Use:** Open the document, verify the current revision and cast an eligible
  decision. Deprecated approvals are historical/read-only; request a new approval
  for the current revision instead of voting on the obsolete one.
- **Limits:** Accessible inbox rows are not necessarily actionable by the viewer.
  An unconfirmed timeout does not prove rollback. Event review dialogs block further
  writes until reload after ambiguous/conflicting results; do not blindly repeat votes.
- **Maturity:** Human decisions are an implemented, deployment-gated slice. AI
  modes are configuration only; delegation and escalation workers are absent.
- **Source:** [Page](../app/purchases/procurement/approvals/page.tsx);
  [inbox](../app/api/procurement/approvals/inbox/route.ts);
  [event decisions](../app/api/procurement/approvals/[id]/decisions/route.ts).

## Tenders — `/purchases/tenders`

- **Purpose/capabilities:** Create/edit internal tenders and requirements, link
  requests, register/withdraw supplier invitations and request independent
  publication approval. Inspect immutable publication versions and receipt activity;
  review available quotations and initiate separate award/order approval flows.
- **Use:** Prepare the draft, choose visibility/participation/opening rules, enable
  the portal for public/unlisted exposure, then request publication approval.
  Inspect the actual published snapshot before sharing its link.
- **Limits:** Approval never silently enables the portal. Editing a draft does not
  rewrite published requirements or pending approval revisions. An invitation
  register is not proof of email delivery. Sealed receipt activity exposes receipt
  metadata, not supplier identity, prices or attachments before opening.
- **Maturity:** Implemented slice; full clarification/amendment workflows, legal
  version acceptance, split awards and advanced evaluations are not complete.
- **Source:** [Tender routes](../app/purchases/tenders);
  [implementation and receipt contracts](PROCUREMENT_IMPLEMENTATION.md).

Public discovery and account submission are described in the
[account/commerce guide](MODULES_COMMERCE_AND_ACCOUNT.md#public-tenders).

## Procurement Rules — `/purchases/rules`

- **Purpose/capabilities:** Edit named Draft/Active/Archived rules by event and
  scope, net thresholds, cumulative conditions, approvers, quorum and timing;
  search/filter rules and simulate policy resolution with workspace references.
  Saves append policy revisions with optimistic conflict checks.
- **Use:** Define the rule, save it explicitly and inspect a hypothetical resolution
  before submitting a real requisition or requesting an event approval.
- **Limits:** Simulation always returns `simulationOnly: true` and `authorized: false`.
  It cannot authorize purchases or cast votes. Missing FX/classification/actors or
  timing anchors block resolution; no currency conversion or business-day scheduler
  is supplied. AI authority and urgency presets do not establish operational workers.
- **Maturity:** Configuration plus selected operational human-approval enforcement;
  not every configured deadline, exception or notification is executed.
- **Source:** [Page](../app/purchases/rules/page.tsx);
  [editor/simulator host](../app/purchases/procurement/components/procurement-page.tsx);
  [policy contracts](PROCUREMENT_IMPLEMENTATION.md#policy-model).

## Inventory Minimums — `/inventory/minimums`, `/inventory/minimums/[id]`

- **Purpose/capabilities:** Maintain versioned SKU/location minimum and target rules,
  run recorded-stock checks, create draft requisitions or persist alerts, and inspect
  queued evaluations/results. Conflicting open demand is guarded against duplication.
- **Use:** Define the branch/item threshold and replenishment action, check stock,
  then review any generated draft through Purchase Requests.
- **Limits:** Uses recorded on-hand stock, not projected/reserved availability.
  Generates drafts, never automatic submission, tender, purchase order or payment.
  Resolving an alert does not cancel related demand. Search/status filtering applies
  to the loaded rule page, not necessarily the whole directory.
- **Maturity:** Manual evaluation is an implemented slice; automatic processing is
  deployment-gated on migrations, compatible application code, a server-only
  `PROCUREMENT_REPLENISHMENT_WORKER_SECRET` and an approved external scheduler.
- **Source:** [Page](../app/inventory/minimums/page.tsx);
  [rule UI](../app/purchases/procurement/replenishment/rules.tsx);
  [rollout](PROCUREMENT_REPLENISHMENT.md).

## Catalog sourcing — `/catalog/[id]`

- **Purpose/capabilities:** The Procurement tab maintains independent procurement
  capability and append-only supplier offers with dated validity, units/conversion,
  minimum quantities and commercial terms.
- **Use:** Record sourcing information separately from sales-channel prices and
  public catalog visibility; inspect validity before preparing a requisition.
- **Limits:** Procurement capability is not a universal exclusion from POS/public
  sales. Sales/procurement filtering and complete sourcing-history/request-launch
  workflows remain incomplete.
- **Maturity:** Implemented slice, not a full supplier-price optimization system.
- **Source:** [Catalog detail](../app/catalog/[id]/page.tsx);
  [scope](PROCUREMENT_IMPLEMENTATION.md#operational-surfaces-added).

## Received Quotations — `/purchases/quotes`

- **Purpose/capabilities:** Workspace procurement/received-quotation view, also
  embedded in tender details. Review opened offers and eligible buyer-recorded
  supplier quotations; sealed envelopes show publication, opening date and count
  without leaking proposal contents. Workspace-associated seller offers remain
  distinct from tender procurement proposals.
- **Use:** Select the tender and eligible supplier when recording a procurement
  quotation; review the offer at its authorized opening time before award approval.
- **Limits:** Personal quotations without buyer-site association do not belong in
  this workspace list; use `/home/quotes` or `/buyer/quotes`. Procurement proposals
  reuse quotation records but are isolated from legacy public tokens/Stripe checkout.
  Recording a quote is not award approval or payment. Freeform direct procurement
  and complete seller-issued quote integration remain incomplete.
- **Maturity:** Implemented, migration-gated slice. Missing envelope RPCs report a
  load failure, not a fabricated zero-receipt state.
- **Source:** [Page](../app/purchases/quotes/page.tsx);
  [panel](../app/purchases/procurement/commerce/ProcurementQuotesPanel.tsx);
  [receipt projections](PROCUREMENT_IMPLEMENTATION.md#sealed-quotation-receipt-visibility).

## Purchased Orders — `/purchases/orders`

- **Purpose/capabilities:** Defaults to procurement orders; the source selector
  opens commerce purchases with `/purchases/orders?source=online`. Procurement
  orders follow separate award/order approvals and expose partial non-stock
  acceptance. Online purchases reuse buyer-facing order/payment/shipment details.
- **Use:** Choose the origin, inspect the supplier/order and record only supported
  acceptance quantities with their evidence note. Use the online view for purchases
  made from another seller through commerce.
- **Limits:** Non-stock acceptance is not inventory receipt or stock posting.
  Full SKU/location receipt, bill allocation, discrepancies and reconciliation are
  not implemented. Procurement cannot yet create a direct order without a tender.
  Online purchasing-site ownership differs from the seller's `site_id` and does not
  grant unrestricted entitlement redemption.
- **Maturity:** Implemented slice with incomplete receiving-to-payment completion.
- **Source:** [Source selector](../app/purchases/orders/page.tsx);
  [procurement acceptance](../app/purchases/procurement/commerce/ProcurementOrdersPanel.tsx);
  [buyer queries](../app/buyer/actions.ts).

## Procurement / Tender Settings

Routes: `/settings/procurement`, `/settings?tab=tenders` and the
`/settings?tab=procurement` alias; `/settings/tenders` redirects to the tender tab.

- **Purpose/capabilities:** Maintain versioned workspace defaults for visibility,
  participation/opening, global listing, fallback approvals, timings, supervisors,
  exceptions, urgency and notification preferences. Portal activation/URL has its
  own explicit save, separate from policy saves.
- **Use:** Select the correct workspace, save defaults and separately enable the
  portal if public/unlisted publication is intended. Define event rules in Rules.
- **Limits:** These routes share the procurement settings editor, not independent
  policy systems. Activation does not publish tenders. Branding, editable portal
  slugs and approved legal versions remain incomplete; configured notifications,
  exceptions and AI modes are not proof of execution.
- **Maturity:** Configuration with selected operational enforcement; deployment-gated.
- **Source:** [Settings host](../app/purchases/procurement/components/procurement-page.tsx);
  [redirect](../app/settings/tenders/page.tsx);
  [policy API](../app/api/procurement/policy/route.ts).

## End-to-end boundaries and verification

| Goal | Current path | Completion boundary |
| --- | --- | --- |
| Replenish low stock | Minimums → draft Request → human approval | Approved demand; not an automatic purchase or stock receipt |
| Obtain supplier proposals | Suppliers + Request → Tender → publication approval → account submission | Immutable receipt and authorized opening, not supplier acceptance |
| Select a supplier | Opened quotation → award approval → order approval → procurement Order | Approved generated order, not paid/received goods |
| Record acceptance | Procurement Order → partial non-stock acceptance | Recorded accepted quantities; no inventory or bill allocation guarantee |

Verify the migration chain and compatible application in the chosen environment,
RLS/grants with allowed and cross-tenant identities, and actual Storage behavior.
Recorded application of individual receipt migrations in an implementation note
does not establish rollout of the whole suite. Do not treat demo rows or isolated
Jest/PostgreSQL fixtures as live acceptance.

The [delivery checklist](PROCUREMENT_DELIVERY_CHECKLIST.md) tracks broader agreed
scope, but some unchecked items and older implementation prose lag newer source.
Use the current pages/actions/migrations to resolve conflicts. Organization
credential authority, AI/issuer verification, operational escalation, complete
receiving/bill allocation and the full `/buyer` URL migration remain unfinished.