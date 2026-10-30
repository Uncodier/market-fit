# Procurement Delivery Checklist

This checklist tracks the complete agreed design, not just route creation. A checked
item must include its backend, authorization and regression evidence. Local implementation
is not deployment: no remote migration or production build is authorized by this document.

## Existing foundation

- [x] General workspace policies and separate rule editor.
- [x] Versioned policy history, expected-revision saves and manager authorization.
- [x] Net thresholds, cumulative rules and explicit fallback simulation.
- [x] Human/AI mode configuration, supervisor exceptions and urgency presets.
- [ ] Every configured outcome enforced in operational transitions, not simulation only.
- [ ] Notifications, reminders, escalation and configured urgent supplier invitations.
- [ ] AI recommendations and delegated decisions through a verified backend contract.

## Supplier relationships

- [x] Workspace-private directory, detail, search/status filters and lifecycle.
- [x] Company or professional identity without fake CRM leads.
- [x] Contacts, categories, commercial terms, private notes and activity history.
- [x] Buyer-item/supplier mapping, units, conversion, dated price validity and lead time.
- [ ] Supplier-specific SKU and preferred-source semantics.
- [x] Verified-account supplier representation grants and revocation.
- [ ] Optional legal representation evidence evaluated as a configured requirement.
- [ ] Documents, related quotes/orders/Bills and authorized supplier invitations.

## Requests and approval execution

- [x] Request list/detail/create/edit with immutable submitted line revisions.
- [x] Catalog tax snapshots and explicit internal service estimates.
- [ ] Required date, requester, responsible person, destination and budget.
- [x] Rule resolution pinned to request and policy revisions.
- [x] Distinct eligible human approvers, quorum, rejection and self-approval controls.
- [ ] Sequential/parallel activation and real deadlines, delegation and exceptions.
- [ ] Direct sourcing and tender launch without conflating requisition/offer approval.

## Tenders and public publication

- [x] Internal list/detail/create/edit with request linkage and line requirements.
- [x] Independent visibility, participation, opening and global listing configuration.
- [ ] Immutable published bases, amendment/clarification history and closing controls.
- [ ] Portal activation, stable slugs, branding and approved legal versions.
- [x] Global directory and site/detail pages with minimal public projections.
- [ ] Registration/invitations and authenticated authorized external participation.
- [ ] Submission replacement/withdrawal deadlines and immutable receipt.
- [ ] Scoped evaluation, supervisor decisions and one-supplier tender award.

## Quotations, orders and completion

- [x] Extend existing quotations/quotation_items, never duplicate bids/quote documents.
- [x] Buyer custody and external supplier identity without fake sites/leads.
- [ ] Full dual-sided seller-issued quotation sharing and sent/received integration.
- [ ] Sent/received views and manual external quotations with buyer-private annotations.
- [x] Prevent legacy public token/checkout readers from exposing procurement documents.
- [x] Independent award/order approvals and idempotent purchase-order generation.
- [ ] Independent offer acceptance approval and direct sourcing workflow.
- [x] Keep procurement orders alongside existing online orders with explicit origin.
- [ ] Partial receipts and service acceptance, actual SKU/location validation.
- [ ] Atomic stock movement/retry protection and no duplicate legacy receipt effects.
- [ ] Bill line allocation, discrepancies, multiple receipts/Bills and payment separation.

## Unified account and evidence

- [x] `/home` account shell without forced workspace onboarding.
- [ ] Preserve buyer orders, subscriptions, entitlements, courses, downloads and booking.
- [ ] Legacy URL compatibility and canonical account navigation/auth return paths.
- [x] Supplier participation discoverable before the first submission.
- [ ] Person/organization credentials and separate uploader/holder authority.
- [x] Personal private immutable file revisions and selective submission evidence sharing.
- [ ] Provisional AI report with missing evidence, inconsistencies and suspected alterations.
- [ ] Separate report, authenticity verification, acceptance and supervisor exceptions.
- [ ] Opening-time controls for both humans and AI; no private leakage in tokens/caches.

## Catalog and rollout

- [x] Procurement capability independent of checkout/POS/public listing flags.
- [ ] Sales/procurement usage filtering and procurement-only sales exclusion.
- [ ] Procurement item tab with sourcing history and request/tender creation.
- [x] Forward-only migrations tested together on isolated PostgreSQL fixtures.
- [x] Cross-tenant, unauthenticated, revoked member and concurrency tests.
- [ ] Existing commerce, quotation, auth and navigation regression suites.
- [ ] Typecheck/lint and approved disposable-target authenticated browser tests.
- [ ] Approved remote migration and post-application RLS/grant verification.

Items explicitly deferred by the agreed main design (split awards, advanced weighted
evaluation, contracts/renewals, supplier performance and automated issuer verification)
remain later work, not silently included in the initial-release completion claim.