# Procurement Settings and Rules

**Status:** design extension, 2026-10-27; configuration/simulation first slice is
implemented locally, not deployed. See [implementation boundaries](PROCUREMENT_IMPLEMENTATION.md).
Companion to [the procurement design](PROCUREMENT_AND_TENDERS_DESIGN.md).

## 1. Confirmed direction and open decisions

Visibility and explicit approval are configurable, not universal fixed policies.
Workspace defaults and authorized purchase/tender-specific settings are required.
Direct purchases use the same policy engine; a tender is not required for every purchase.
Approval rules support category, product, responsible person, amount and currency,
approval counts, and deadlines. General defaults belong in **Settings > Procurement**.
Specific parametrization belongs in a separate **Procurement Rules** screen under
Buying, including product/category requirements, not only approval rules.
Operational approvals remain in document details and assigned work queues.

The existing tenant boundary is a site/workspace. Do not store private policies in
the shared `companies` registry. Cross-workspace company policy inheritance would
require a separately authorized organization model; it is not implied here.

Confirmed clarification: a **50,000 MXN requisition** can require a configured number
of approvers; an **offer above a configured amount** can independently require its
own approval. This example concerns approval counts, not minimum supplier offers.
Named approvers are supported but Juan Perez is an example, not a fixed requirement.
Threshold operators remain explicit. Requisition approval does not automatically
approve an offer, and receiving an offer is distinct from authorizing its selection.

Amounts are always net of tax. Applicable rules accumulate approval and certification
requirements. When none match, use purchase/tender configuration, inheriting general
workspace configuration where not overridden. Human, AI-assisted and delegated AI
decisions are supported. Exceptions have AI recommendations and supervisor decisions.
Neither a first supplier response nor elapsed time authorizes a downstream operation.
Section 9 separates remaining decisions from these confirmed product directions.

## 2. Visibility and publication configuration

Configure each dimension independently:

| Dimension | Workspace policy | Tender configuration |
| --- | --- | --- |
| Portal | Enabled state, stable slug, branding and approved legal versions | Use the authorized workspace portal |
| Visibility | Default and allowed public/unlisted/private values | Inherit or explicitly select an allowed value |
| Global directory | Whether listing is allowed and a suggested default | Explicit effective listing choice confirmed at publication |
| Participation | Default and permitted open/invitation-only/approved-supplier modes | Published participation mode |
| Offer opening | Default and permitted on-receipt/after-close modes | Published opening policy |
| Approval | Applicable rules and authorized exception controls | Resolved approval plan, not an unrestricted bypass switch |

Show **Inherited**, **Overridden**, and **Locked by workspace policy** distinctly.
Only authorized policy managers can change defaults, constraints, or exceptions.
A tender editor cannot weaken a locked policy by sending a different payload.

Public visibility does not imply global listing or open participation. Unlisted
means accessible by link, not confidential. Private tenders never appear in public
directories, counts, metadata, or public caches. Global exposure requires a live
portal, an active site, a published public tender and explicit listing opt-in.

Changing defaults must not silently republish existing tenders or rewrite their
bases. Disabling public access or removing listing permission must restrict live
exposure immediately. Re-enabling must not resurrect a revoked publication.
Changes to published participation/opening rules require versioned amendments,
authorization and participant notification; they must not silently reveal sealed
offers already received under an after-close policy.

## 3. Two configuration surfaces

### General settings: `/settings?tab=procurement`

Keep this section for workspace-wide defaults and restrictions:

- Portal enabled state, stable slug, branding and legal versions.
- Default visibility, permitted overrides, and global-directory listing permission.
- Default participation and offer-opening modes.
- Base periods for tender responses, clarification, offer validity and approval stages.
- Time zone and calendar/business-day interpretation for those periods.
- General approval fallback and who may administer policies or grant exceptions.
- General supervisor, authorized substitutes, escalation and decision modes.
- Rejection notification preferences and configurable exception/urgent-purchase presets.

Timing supports durations in hours, days or weeks, or a specific date and time.
Resolve durations from an explicit event, such as publication or stage activation,
and save explicit deadlines on the document. Fixed dates also require a time zone.
Changing defaults does not move deadlines on existing published tenders.
Business-day periods require a defined business calendar; never infer holidays.
Provide a **Manage procurement rules** link, not a second embedded rules editor.

### Specific rules: `/purchases/rules`

Add **Procurement Rules** as a separate Buying screen. Use Subscriptions as the
primary list reference, consistent with Requirements' shared document-table styling:

- Sticky header, **New rule** action, search, sorting and responsive filter drawer.
- Status tabs: **All**, **Draft**, **Active**, **Archived**.
- Filters for rule type, category, product, responsible person and trigger event.
- Table columns: rule name/type, product/category scope, condition summary,
  required outcome, responsible person, status, effective period and row actions.
- Row actions: open, duplicate as draft, publish a version, archive and view history.
- Detail/editor at `/purchases/rules/[id]` with **Scope**, **Conditions**,
  **Requirements / Approval**, **Timing**, **Simulation**, and **History** sections.

Reuse presentation from `app/subscriptions/page.tsx`,
`app/subscriptions/components/SubscriptionsList.tsx`,
`app/requirements/RequirementsTable.tsx` and
`app/components/documents/document-list.tsx`. Reuse `DocumentListRow`, `EntityCell`,
`StatusDot`, skeletons, empty/error states, keyboard navigation and theme behavior.
Do not reuse subscription billing actions or the automation Requirements data model.
Avoid a single wide form inside Settings or a raw-JSON policy editor.

Rules support these distinct outcomes:

| Type | Specific configuration |
| --- | --- |
| Approval | Named approvers, quorum, human/AI mode, stages, deadlines and escalation |
| Product/category requirements | Technical specifications, documents and credential requirements for the matched items |
| Supplier participation | Supplier eligibility, minimum valid proposals and exception gates |

Requirement rules specify the required type, scope, mandatory/scored classification,
and enforcement milestone. Credential requirements also specify holder, validity,
accepted equivalents and evidence/review semantics from the
[certification design](PROCUREMENT_CERTIFICATIONS_DESIGN.md). A product rule may
require certification evidence; it cannot declare a supplier credential verified.
Examples include insurance for an installation service, a technical sheet for an
equipment category, or an additional named approver above an amount threshold.
These are configurable examples, not automatically enabled workspace policies.

Resolve applicable requirements when preparing a purchase or tender; show their source
rule and whether they are mandatory or overridable. Pin them to the relevant document
revision. New rule versions cannot silently add requirements to a live competition;
use an authorized amendment. Multiple matched product/category rules must not drop
requirements, and contradictory requirements must block publication with an explanation.

Use existing relation selectors, dialogs and permission patterns. Resolve people,
products and categories from the authorized workspace; never use a display name
such as Juan Perez as an authorization identifier. Show a human-readable summary,
affected scope and simulation errors before activating a rule version.

## 4. Approval rule conditions

Each versioned approval rule identifies its event: requisition approval, offer
approval, publication, award approval, or order authorization. Offer approval gates
selection/progression, not receipt of the offer. Payment permissions remain independent.

Supported conditions:

- Amount operator and threshold/range, with exact currency and a fixed net-of-tax basis.
- Scope of the amount: document net total or matching line net subtotal.
- Catalog category and/or product; define whether any or all lines must match.
- Requester, responsible person, or authorized team scope.
- Effective period and enabled state.

For the example, `amount > 50000` in MXN does not include exactly 50,000 MXN.
Offer an explicit `>=` operator rather than silently changing the comparison.
There is no gross/net toggle: all thresholds use net amounts. Derive taxes from the
product configuration and snapshot the applied tax values in the document revision.
Display net, tax and gross totals separately; later catalog edits do not rewrite them.
Evaluate server-calculated values with decimal-safe currency precision.
Foreign-currency comparisons require an explicit dated conversion policy; missing
rates or unclassified required inputs produce a blocked evaluation, not a bypass.

Confirmed conflict behavior: all applicable mandatory rules contribute requirements.
Accumulate required approvers, certifications and other evidence without duplicating
identical requirements. Never discard a named mandatory approver. Cross-rule quorum
counting still needs the explicit decision recorded in section 9.
A product-specific rule cannot silently erase a category or workspace requirement.
If override rules are needed, record an explicit authorized replacement relation;
do not infer "last rule wins" from storage order. When no rule matches, resolve the
purchase/tender configuration and then its inherited general settings. A resolved
policy may explicitly require no approval; a missing policy is not such a decision.
Incomplete or invalid configuration blocks the protected transition.

## 5. Approval plans and deadlines

Rules generate ordered stages. Each stage defines:

- Decision mode, eligible distinct approvers and any named mandatory human approver.
- All-of, first-valid-response, or N-of-M approval semantics.
- Sequential or parallel execution and rejection behavior.
- Duration/event or fixed deadline, time zone, and calendar/business-day basis.
- Reminder and escalation recipients, and explicit timeout behavior.
- Requester self-approval restrictions and authorized delegation rules.

An eligible first approval can complete a first-response stage, but not an unrelated
mandatory Juan Perez stage. Repeated actions by one person never increase quorum.
Reject impossible configurations such as a quorum larger than the eligible pool.
Deactivated or unauthorized approvers cannot cast decisions; reassignment is audited.
Notifications do not grant permission and their delivery is not an approval record.
Rejection notifications to participants are configurable, including recipients;
internal assessment notes are not automatically shared externally. Notification
preferences do not change the rejection's lifecycle effect. Rejecting one offer
does not itself cancel other offers. Quorum rejection semantics remain in section 9.

Proposed safe timeout choices are reminder, escalation, expiry or continued blocking.
Do not implement approval by silence without a separate explicit business decision.
Race handling uses database time and atomic transitions: late or duplicate decisions
cannot reopen a completed stage or create duplicate downstream documents.

### Decision authority and general supervisor

- **Human:** configured people decide.
- **AI-assisted:** AI documents an assessment and recommendation; authorized humans decide.
- **Automatic AI:** an explicitly authorized agent can approve or reject within the
  policy's scope. Cases outside that authority route to the general supervisor.

Do not impose a universal human-approval requirement. Conversely, an AI decision
cannot substitute for a mandatory human approval imposed by another matching rule.
Repeated agent runs cannot manufacture multiple independent quorum votes. Record
human/agent identity, delegated authority, policy/document versions, evidence and
reasons. Server-side policy checks, not model output, authorize state transitions.
Missing evidence, evaluation failure or insufficient authority must not silently approve.

The requested product reference is AI decision-making in Leads. The exact reusable
backend mechanism has not been verified locally; do not claim an existing procurement
approval engine or copy unrelated lead-analysis behavior as its implementation.

### Configurable exceptions and urgency

The general supervisor is responsible for exception decisions, with authorized
substitution and escalation. AI continues to recommend; the supervisor decides the
exception. This is separate from ordinary approvals delegated entirely to AI.

| Case | Configuration and suggested actions |
| --- | --- |
| Absent approver | Authorized substitute, substitution period and escalation to supervisor |
| Urgent purchase | A preset of timings, recipients, offer requirements and approval mode, not an unrestricted bypass |
| Insufficient offers | Required count and supervisor decision to continue, extend or invite more suppliers |
| Inadequate price | Reference/tolerance and recommendation to negotiate, solicit alternatives or accept with justification |
| Inadequate certifications | Request missing evidence, review permitted equivalents or authorize a dispensable requirement exception |

Urgency may preselect notification to previous suppliers for the product/category.
Restrict recipients to authorized, eligible relationships; previous business does
not override blocks or confidentiality. Published deadline changes need amendments.
Price references may include budget, comparable historical prices or current offers;
the choice and tolerance are configuration, not hardcoded values. AI must disclose
missing/unreliable comparisons. Evidence gaps and suspected alterations remain visible
even when a supervisor grants an exception. There is no generic "ignore all rules" action.
Each exception records scope, authorizer, reason, supporting evidence and affected revision.

## 6. Supplier participation gates are not approval quorums

An independently configured sourcing gate may require a minimum number of distinct
eligible suppliers with valid, non-withdrawn proposals before evaluation or award.
Multiple revisions from the same supplier do not count as additional participants.
Publish the applicable count/deadline rules in the bases without exposing competitor
identities or sealed proposal contents.

If the minimum is not met, keep the transition blocked or route an explicitly
configured exception to an authorized approver. Extending the closing deadline
requires an amendment. A first-proposal selection rule, if desired, needs separate
eligibility, opening, evaluation and award semantics; it is not implicit approval.

## 7. Persistence and enforcement contract

Physical table names must be checked against the target schema before migrations.
The model needs general policy versions, typed rule conditions/outcomes, requirement
templates, rule provenance on published requirements, approval stages/instances,
assignments, append-only decisions, and idempotent reminder/escalation events.

Pin document revision, monetary basis, applicable rule versions, resolved approvers
and stage deadlines when requesting approval. Changing an amount, currency, product,
category, supplier, or other approval-relevant input requires reevaluation and a new
approval revision. Preserve old decisions without treating them as approval of edits.
New policy versions do not silently rewrite pending approval history; any required
reassessment of pending documents is explicit and audited.

Enforce tenant access, capability, assignment, current authorization and lifecycle
at each API/action/RPC boundary and through RLS. Atomic protected transitions must
verify the exact approved document revision or a recorded policy-based exemption.
Client checkboxes, notification links and stale simulations are not authority.
Approval never independently triggers payment, stock receipt or accounting posting.

## 8. Acceptance checks

- General settings and the separate Rules list have distinct responsibilities and navigation.
- Rules reuse the Subscriptions/Requirements table patterns without their domain side effects.
- Product/category rules resolve typed requirements with traceable source versions.
- Credential rules retain holder, validity and review boundaries; they do not verify evidence.
- Rule amendments cannot silently alter requirements or deadlines on published tenders.
- Workspace defaults, permitted tender overrides and locked restrictions work independently.
- Public/private/unlisted, participation and global listing combinations do not leak data.
- Portal/listing revocation takes effect without changing historical published bases.
- Test 49,999.99, 50,000 and 50,000.01 MXN, tax bases, mixed lines and unavailable FX rates.
- Multiple matching rules cannot weaken mandatory approval requirements.
- Simulations explain matched rules, amount basis, stages, deadlines and missing inputs.
- Test named approver, all-of, first-response and N-of-M with distinct authorized users.
- Reject duplicate votes, cross-site approvers, forbidden self-approval and impossible quorums.
- Document edits invalidate approval applicability; policy changes preserve decision history.
- Distinguish minimum supplier proposals from minimum internal approvals.
- Test exact deadlines, concurrent approval/rejection, escalation retries and revoked access.
- No timeout, missing rule or failed lookup silently approves or awards a purchase.
- Direct purchases resolve the same rules and general fallback without a tender.
- Net thresholds ignore tax changes; document tax snapshots survive product edits.
- AI decisions require delegated authority and cannot satisfy mandatory human votes.
- AI failures, repeated runs and injected document instructions cannot grant approval.
- Exceptions preserve AI recommendations and the supervisor's separate decision.
- Urgent presets respect supplier eligibility, notification scope and locked requirements.
- Rejection notification preferences do not alter approval state or expose internal notes.

## 9. Remaining decisions and implementation design

Do not present these as approved defaults:

- Cross-rule counts: whether the same eligible person can satisfy two matching groups
  (for example, two and three approvals), or whether independent approvals are required.
- Rejection within N-of-M: veto, failed vote, or return for correction; resubmission semantics.
- Exact default self-approval restrictions, AI delegation limits and timeout action.
  Reminder/escalation/blocking are proposed; approval by silence has not been authorized.
- Net amount scope for mixed lines, FX source/date and taxes for lines without a product.
  Explicit tax selection for free-text lines is a proposal, not a confirmed default.
- Offer withdrawal/replacement/opening behavior and amendment effects.
- Physical schema, approval/receipt/order state machines, role/location matrix,
  representation onboarding and receipt/bill discrepancy tolerances.
- Makinari's retention periods, deletion obligations, upload limits and public legal terms;
  these are platform policy, not a per-buyer retention setting.

Add domain, API and isolated PostgreSQL tests before claiming these controls work.
No remote migration, deployment, production build or scheduled agent task is authorized
by this design. Approval timers are application behavior, not developer task schedules.