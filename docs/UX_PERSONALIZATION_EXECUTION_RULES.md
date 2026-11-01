# UX personalization: shared execution-ready decision rules

**Status:** Proposed specification; implementation and migrations remain separate.
**Date:** 2026-10-31.
**Read with:** [Business catalog](UX_PERSONALIZATION_BUSINESS_CATALOG.md),
[main plan](UX_PERSONALIZATION_DESIGN.md), and
[template installation/security contract](UX_PERSONALIZATION_TEMPLATES_AND_DECISIONS.md).

## 1. Deterministic resolution order

First-class usage aliases: `marketing_agency` maps to `services.agency`;
`content_creator` maps to `entertainment.creator`. See the
[priority ICP modes](UX_PERSONALIZATION_AGENCY_AND_CREATOR_MODES.md) for required
entry cards, questions, copy and client-account boundaries. Site selection resolves
the canonical business leaf; personal selection resolves the presentation lens
only. Industry facts and Focused/Standard/Complete remain independent.

```text
Authenticate -> trusted active site membership -> read minimal permitted settings
`-- Site business leaf from the 29-leaf catalog (unknown -> other.general)
    |-- Resolve selected needs; skipped -> leaf's default primary modules
    |-- Resolve operating/size guidance; never change access or stored data
    |-- Recommend template definitions; install only after authorized selection
    `-- Resolve each presentation field independently:
        per-site personal > account personal > assigned UX role
        > explicit site override > business/needs preset > general defaults
        |-- site-only intent -> skip assigned UX-role layer
        |-- inherit -> no value; explicit empty array -> intentionally empty
        `-- Intersect trusted authorization, location, licenses and availability
            -> mode -> installed collections -> personal shortcut intent
            -> real state/action -> semantic labels/icons -> locale -> assistance
```

Output contract: business ID; ordered module IDs; ordered installed category IDs;
suggestions/blocked prerequisites; typed shortcuts; allowed action IDs; resolved
token IDs; field provenance; loading/error state. Do not flatten inherited intent
into persisted values or use this output as authorization.

## 2. All size and operating-model branches

| Input | Guidance/output | Never do |
| --- | --- | --- |
| Solo indicator | Concise setup; offer self-assignment and optional team setup | Assume low expertise, change employee band or force Focused |
| 1-10 | Simple team/role guidance; Standard fallback | Auto-install team roles or grant manager access |
| 11-50 | Recommend functional roles and assignment review | Hide cross-functional tools automatically |
| 51-200 | Recommend department-level UX roles and access review | Invent department ACL support |
| 201-500 | Same as 51-200, emphasize governed template changes | Automatically enable approvals |
| 501-1000 | Version/conflict guidance and opt-in staged adoption | Change licensing or implementation mode |
| 1001+ | Governed rollout guidance; explicit role/access ownership | Infer enterprise entitlement |
| Unknown/skipped | Standard/general size guidance | Guess from budget, domain or user identity |
| Physical | Recommend applicable POS/location/reservation needs | Create locations/registers without explicit setup |
| Online | Recommend applicable catalog/orders/content needs | Activate public store or payment methods |
| Hybrid | Union approved physical/online needs; deduplicate IDs | Install two packs or replace prices/delivery settings |
| Multiple locations | Show location access/setup guidance | Use a client filter as location authorization |

## 3. Every daily-need branch

These additions apply to all business leaves. Optional means selected, not inferred.

| Need ID | Module keys in priority order | Template recommendation | CTA semantic action |
| --- | --- | --- | --- |
| sell_counter | pos, catalog, sales, orders | store_checklists | Open POS / add catalog item |
| sell_online | catalog, orders, shipments, promotions | product_content, customer_requests | Add catalog item / open orders |
| sell_b2b | leads, deals, quotations, priceLists, orders | account_plans, customer_specifications | Create quotation / add account plan |
| customers | leads, chat, controlCenter | customer_requests | Add contact / add request |
| appointments | reservations, catalog | service_sessions only for non-sensitive service context | Open reservations / add service |
| recurring_sales | subscriptions, catalog, accountsReceivable | account_plans | Open subscriptions |
| fulfill | orders, orderLines, shipments, inventory | quality_checks | Open orders / add quality check |
| inventory | inventory, inventoryMinimums, catalog | equipment_checks | Open inventory |
| purchasing | suppliers, purchaseRequests, purchasesOrders, bills | supplier_briefs | Create purchase request |
| approvals | procurementApprovals, procurementRules | review_notes | Open approvals; no authorization by selection |
| tenders_internal | procurementTenders, suppliers | compliance_evidence | Open internal tenders |
| marketing | campaigns, segments, promotions, content, contentCreator, assets | editorial_briefs | Create campaign / add brief |
| automation | workflows, activities, skills, channels | general_notes | Open workflows; never execute on setup |
| software_tools | applicationsDatabase, applicationsRepositories, agentsConfiguration | release_notes | Open tools; no provisioning |
| finance | accountsReceivable, bills, transactions, payments, financeReports, journalEntries, chartOfAccounts | review_notes, document_register | Open financial module |
| reporting | reportOverview, reportPerformance, reportSales, reportCosts, financeReports | review_notes | View report; never create invented KPI |
| documentation | records, controlCenter | general_notes, document_register | Add note / open work |
| academic | records | academic_courses, groups, student_profiles, enrollments, grades, attendance | Review academic templates; privacy gates apply |
| clinical | records, reservations | patient_index, medical_history, encounter_notes, follow_up_plans | Review clinical requirements before any install |

Merge rule: leaf primary modules + explicit need modules + role recommendations;
deduplicate by canonical ID. Need order follows the chosen primary need, then the
table order. Explicit presentation overrides replace only their declared field.
Non-applicable capability stays canonical-only or blocked, never renamed into a
specialized feature. No need changes business identity or membership rights.

## 4. Every functional-role branch

These are UX IDs, not authentication or membership roles. User-chosen personas
follow the same module recommendations; trusted record assignment still owns access.
Collection recommendations always intersect installed/readable collections.

| UX role ID | Prioritized modules | Collection emphasis / CTA context |
| --- | --- | --- |
| owner | reportOverview, controlCenter, records | Leaf's collections; review templates if actually authorized |
| general | Leaf primary modules | Leaf defaults; no forced special terminology |
| sales | leads, deals, quotations, catalog | account_plans, customer_specifications; commercial follow-up |
| marketing | campaigns, segments, contentCreator, content | editorial_briefs, account_plans |
| operations | controlCenter, records, orders | Operational checklists, requests, work_packages |
| purchasing | suppliers, purchaseRequests, purchasesOrders | supplier_briefs, compliance_evidence |
| approver | procurementApprovals, procurementRules | review_notes; approved operation permissions required |
| finance | accountsReceivable, bills, transactions, financeReports | review_notes, document_register; no grade/clinical access |
| cashier | pos, orders, catalog | store_checklists; no back-office access implied |
| store_manager | pos, inventory, orders, controlCenter | store_checklists, equipment_checks |
| warehouse | inventory, shipments, orders | quality_checks, production_batches where authorized |
| ecommerce_manager | catalog, orders, shipments, promotions | product_content, customer_requests |
| support | chat, leads, controlCenter | support_cases, customer_requests |
| product | records, controlCenter, catalog | release_notes, service_engagements, deliverables |
| developer | records, workflows, applicationsRepositories | release_notes, deliverables, support_cases |
| designer | assets, records, content | production_briefs, deliverables |
| content_creator | contentCreator, content, assets | editorial_briefs, sponsorship_briefs, deliverables |
| quality | records, inventory | quality_checks, compliance_evidence, food_safety_checks |
| production | records, inventory, controlCenter | production_batches, work_packages, recipe_reference |
| kitchen | orders, records, inventory | recipe_reference, food_safety_checks |
| reception | reservations, leads, chat | Approved administrative collections; no sensitive history |
| clinician | reservations, records | Authorized encounter_notes, medical_history, follow_up_plans |
| practitioner | reservations, records, catalog | Non-clinical service_sessions, service_protocols |
| teacher | records, controlCenter | Assigned groups, grades, attendance |
| academic_admin | records, controlCenter | academic_courses, groups, enrollments within scope |
| instructor | catalog, reservations, records | cohorts, session_plans; no school grades by default |
| advisor | records, quotations, controlCenter | service_engagements, compliance_tasks |
| event_coordinator | records, reservations, controlCenter | event_plans, event_checklists |
| housekeeping | records, controlCenter | housekeeping_checks, approved maintenance requests |
| guide | reservations, records | itinerary_plans, departure_checklists |
| agent | leads, deals, records | property_references, viewing_notes; real-estate function only |
| property_manager | records, controlCenter, accountsReceivable | property_inspections, maintenance_requests |
| field_technician | records, controlCenter, reservations | Assigned work_packages, equipment_checks |
| program_coordinator | records, controlCenter | program_plans, event_plans; approved member_register |

Unassigned/archived role -> site recommendation; unknown role -> general. Multiple
positions do not merge roles: one assigned UX role in MVP. A personally selected
clinician/teacher persona can suggest tools, never access private clinical/student data.

## 5. Complete shared template schema registry

All catalog template IDs resolve here. Each also has record title*, optional generic
description, site/category identity, timestamps, and canonical record state.
Field IDs equal stable keys listed below; display labels are separate locale tokens.
Enums below are **field values**, not new backend lifecycle/approval states.

`person` means an approved same-site contact relation, not an auth account. `staff`
means an authorized `team_member`; `item` means `catalog_item`. Other relations
target the named installed Record category and a readable same-site record.
Attachments are omitted by default; references do not become public download links.

| Template ID | Proposed fields beyond title | Relation dependencies / limits |
| --- | --- | --- |
| general_notes | note:description, recorded_on:date | Optional staff; no secrets in notes |
| review_notes | scope*:text, reviewed_on:date, summary:description, next_step:text | Optional staff; no payment state override |
| store_checklists | routine*:text, checked_on*:date, completed:boolean, notes:description | Optional staff; completion is recorded intent, not proof of compliance |
| equipment_checks | equipment_ref*:text, checked_on*:date, result*:select(pass/fail/review), notes:description | staff; no certification claim |
| client_onboarding | started_on:date, checklist:description, owner_notes:description | person, staff; no provisioning action |
| support_cases | opened_on*:date, priority:select(low/normal/high), issue*:description, resolution:description | person, staff; no SLA engine |
| release_notes | version*:text, released_on:date, changes*:description | staff; release date is documentation, not deployment |
| service_engagements | reference*:text, scope*:description, start_on:date, due_on:date | person, staff; scope does not authorize work |
| deliverables | due_on:date, brief*:description, delivery_notes:description | Optional service_engagements or production_briefs, staff |
| service_protocols | service_code:text, procedure*:description, revision_on:date | Optional item; exclude patient information |
| administrative_followups | reference*:text, due_on:date, task_state:select(open/done), notes:description | Approved person; no clinical content or invented reservation target |
| patient_index | patient_reference*:text, approved minimal identity | Clinical gate; final identity fields require legal/privacy approval |
| medical_history | recorded_on*:date, history:description, allergies:description | patient_index*, staff; clinical gate and amendment policy |
| encounter_notes | encounter_on*:date, reason:description, findings:description, plan:description | patient_index*, staff*, optional medical_history; clinical gate |
| follow_up_plans | due_on*:date, instructions:description, followup_state:select(open/done) | patient_index*, encounter_notes*; clinical gate |
| service_sessions | session_on*:date, service_notes:description | person, item, staff; non-clinical minimal information only |
| compliance_evidence | evidence_ref*:text, issuer:text, expiry_on:date, scope:description | Optional item; no acceptance/verification implied |
| account_plans | objective*:description, next_review_on:date, next_step:text | person, staff; no automatic outreach |
| quality_checks | checked_on*:date, result*:select(pass/fail/review), findings:description | Optional production_batches/work_packages or item; no stock mutation |
| compliance_tasks | obligation_ref*:text, due_on*:date, task_state:select(open/done), notes:description | staff; no automatic regulatory approval |
| document_register | document_ref*:text, purpose:description, review_on:date | person/staff optional; approved storage required for evidence, no arbitrary URL |
| academic_courses | course_code*:text, academic_level:select(approved levels), hours:number | Optional item; no automatic commercial course |
| groups | group_code*:text, term*:text, capacity:number | academic_courses*, staff; privacy and approved uniqueness scope |
| student_profiles | student_reference*:text, enrolled_on:date, admin_notes:description | Optional approved person; academic personal-data gate |
| enrollments | enrolled_on*:date, term*:text, enrollment_state:select(pending/active/withdrawn/completed) | student_profiles*, groups* |
| grades | assessment*:text, assessed_on*:date, score:number, scale:select(approved scales), result_text:text, feedback:description | enrollments*, staff; numeric/qualitative mutually validated |
| attendance | session_on*:date, attendance_state*:select(present/absent/late/excused), notes:description | enrollments*, staff; academic privacy gate |
| cohorts | cohort_code*:text, start_on:date, end_on:date | Optional item, staff; not student access provisioning |
| session_plans | session_on:date, agenda*:description, preparation:description | Optional cohorts, item, staff |
| feedback_register | received_on*:date, feedback*:description, followup:text | Optional cohorts/person; minimize personal data |
| customer_requests | received_on*:date, request*:description, request_state:select(open/done) | person, optional item, staff; refund remains financial workflow |
| product_content | product_summary*:description, copy_brief:description, review_on:date | item*; not automatic catalog publishing |
| production_batches | batch_ref*:text, produced_on:date, quantity:number, notes:description | item optional, staff; no inventory posting/traceability certification |
| customer_specifications | specification_ref*:text, requirements*:description, reviewed_on:date | person, optional item; no automatic quote/contract |
| work_packages | scope*:description, due_on:date, work_notes:description | Optional customer_specifications/maintenance_requests, staff |
| event_plans | event_on:date, purpose*:description, venue_ref:text | staff; no attendee entitlement or capacity guarantee |
| event_checklists | routine*:description, due_on:date, completed:boolean | event_plans*, staff |
| supplier_briefs | supplier_ref*:text, requirements*:description, review_on:date | Approved company relation if compatible; not supplier identity provisioning |
| editorial_briefs | objective*:description, audience:text, due_on:date | staff; optional campaign relation; no publishing action |
| sponsorship_briefs | sponsor_ref*:text, commitments*:description, due_on:date | Optional person/deal relation; no legal contract or automatic invoicing |
| production_briefs | scope*:description, production_on:date, delivery_notes:description | person, staff; no media licensing assertion |
| recipe_reference | recipe_code*:text, ingredients:description, method:description, revision_on:date | Optional item; no ingredient depletion or safety certification |
| food_safety_checks | check_ref*:text, checked_on*:date, result*:select(pass/fail/review), observation:description | Optional production_batches, staff; approved safety scope |
| housekeeping_checks | space_ref*:text, checked_on*:date, completed:boolean, notes:description | staff; no room availability mutation |
| itinerary_plans | departure_on:date, itinerary*:description, service_ref:text | Optional item, staff; no ticketing/passport data |
| departure_checklists | departure_on*:date, checklist*:description, completed:boolean | itinerary_plans*, staff |
| property_references | property_ref*:text, general_location:text, description:description | staff; no deeds, exact sensitive addresses or public listing by default |
| viewing_notes | viewed_on:date, notes*:description, next_step:text | property_references*, person, staff |
| maintenance_requests | asset_ref*:text, requested_on*:date, issue*:description, priority:select(low/normal/high) | Optional property_references, person, staff |
| property_inspections | inspected_on*:date, findings*:description, next_review_on:date | property_references*, staff; no certified inspection claim |
| program_plans | objective*:description, start_on:date, review_on:date | staff; no grant-compliance inference |
| member_register | member_ref*:text, joined_on:date, admin_state:select(active/inactive) | Approved person; personal-data gate; unrelated to site membership |

Global proposed constraints: bounded text/list sizes; valid dates; nonnegative
hours/capacity/quantity; start <= end where both exist; server-enforced enum values;
grade scale/range rules; unique identifiers only in explicitly approved scopes.
Do not fabricate clinical identity, grade-scale, or jurisdiction defaults when
approval is absent: mark the affected template blocked with a named prerequisite.
Optional relations do not force dependency installation; selected required relations
do. Template graph is validated before install; record state retains canonical behavior.

## 6. All module IDs: selection, action, and semantic preservation

Every navigation item falls under a rule below; none is globally renamed to fit a
business. Keys/URLs remain those in [navigation areas](../app/config/navigation-areas.ts).
Create/send/pay/execute actions are exposed only where an existing authorized form
or handler supports them. “Open” is the safe module-level default CTA.

| Module family | Complete key coverage | Primary-action and copy rule |
| --- | --- | --- |
| Marketing | campaigns, segments, promotions, content, contentCreator, assets | Open module; supported create labels retain campaign/audience/content semantics |
| Sales | salesHome, pos, catalog, priceLists, subscriptions, accountsReceivable, sales, leads, deals, quotations, people | Catalog contextual product/service/menu/plan; leads context-specific contacts; all money terms canonical; People never becomes team/patient directory |
| Operations | chat, records, orders, orderLines, shipments, controlCenter, reservations, visits, checkIn, inventory, inventoryMinimums, printers | Collections may have distinct titles inside Records; no claim of clinical/academic modules; bookings/check-in only if existing semantics match |
| Buying | suppliers, purchaseRequests, procurementApprovals, procurementTenders, procurementRules, bills, transactions, purchasesOrders, purchasesSubscriptions, purchasesQuotes, purchasesLibrary | Canonical procurement/financial actions; internal tenders never renamed public supplier participation |
| Automation | context, agentsConfiguration, requirements, channels, activities, skills, workflows, aiWorkspace | Open/configure; AI execution requires separate explicit authorized action; templates do not activate agents |
| Applications | applicationsDatabase, applicationsRepositories, applicationsSecrets | Open existing tools; no inferred provisioning/access from developer role |
| Finance | payments, financeReports, journalEntries, chartOfAccounts | Canonical balances/payment states and actions; do not turn Records into accounting |
| Reports | reportPerformance, reportOverview, reportAnalytics, reportTraffic, reportCosts, reportSales, reportSocial | View existing reports with truthful data scope; no invented grade/clinical/production metrics |
| Settings | settingsGeneral, procurementSettings, company, marketplace, settingsVisits, team, calendar, social, integrations, billing, security | Always use actual configuration meaning; no UX hiding of accessible recovery/configuration in Complete |

Items originally hidden (for example salesHome) retain registry-level hidden status;
Complete removes **personalization** omissions, not intentional retired/internal
registry entries. Configuration destinations follow existing pin eligibility.
When navigation gains a key, the registry contract test must fail until a rule
classifies it; wildcard Settings covers presentation only, not authorization.

## 7. Every collection/action-state branch

| State | Navigation/collection output | Allowed CTA | Helper/copy outcome |
| --- | --- | --- | --- |
| Identity/site loading | Scoped skeleton | None | Accessible loading announcement |
| No authenticated membership | Existing sign-in/access flow | Sign in / safe account navigation | No site names or metadata disclosure |
| Site read denied | Safe denied state | Safe navigation | Access unavailable; no private entity name |
| Data request failed | Error, not empty | Retry | Could not load this collection; no zero-count claim |
| Template absent, installer permitted, gates passed | Gallery suggestion | Review templates -> Install selected | Explain fields/dependencies before mutation |
| Template absent, no installer permission | No active collection tile | General guidance where allowed | No misleading create-record action |
| Template privacy/capability blocked | Manager setup card if authorized | Review requirements | Named safe prerequisite; no bypass/install |
| Install in progress | Scoped progress | No repeated submit | Installing selected templates; not yet saved |
| Install failed/conflict | Error/review | Retry idempotently / review conflicts | Never claim completion or recreate site |
| Installed and empty, can create | Collection tile + empty list | Semantic Add <entity> | Short purpose and necessary first field |
| Installed and empty, read-only | Collection tile + empty list | None | No entries available; no promise of editing |
| Installed with data | Authorized list | Open; Add/Edit only if permitted | Entity-specific helper, no sensitive previews in launcher |
| Filter matches none | Same collection, visible filter chips | Clear filters | No entries match current filters |
| Archived | Explicit archived state if readable | Restore only with supported permission | Records retained; do not auto-reinstall |
| Deleted/invalid shortcut target | Safe unavailable or omitted target | Remove own shortcut | Do not reveal forbidden prior titles or substitute IDs |
| Access/license revoked | Omit destination and stale metadata | Safe navigation | Revalidate, never rely on personal pins |
| Sensitive finalized entry | Approved revision UI only | View / Add amendment if implemented | Never silently edit finalized content |

Destructive actions always require actual permission, reference/retention review,
confirmation and stored result. Never execute mutation from a navigation GET.

## 8. Copy, icon, and view contracts for all leaves

For every catalog entity, define tokens `ux.<leaf>.collection.<template>.title`,
`.create`, `.helper.guided`, `.helper.concise`, `.empty`, `.iconLabel`. For modules
use `ux.<leaf>.module.<key>.*` only when semantics permit a business alias.
Registry entries inherit common tokens when no alias is declared; missing approved
translations use contextual -> canonical locale -> canonical English fallback.
All five locales require translation review; do not translate stored keys or user data.

Title is the catalog's collection label. Create is its declared CTA, else “Add
<singular entity>”. Guided helper is the catalog text plus required field/relation
instructions. Concise helper retains the first actionable sentence and all mandatory
privacy warnings. Empty copy is “No <plural entity> yet” only after successful read;
errors/denial use section 7. Save success appears only after confirmed persistence.

Approved icon/emoji families: software, care, education, store, package, factory,
food, media, event, lodging, travel, property, tools, briefcase, community, checklist,
ledger, shield, handshake, folder, pencil, calendar, map. Resolve to existing shared
icons or allowed category emoji; canonical icon is fallback. Never fetch external icons.
Accessible icon labels equal the resolved destination label, not a raw icon name.

View contracts: `my_work` uses trusted authorized staff assignment; `due` uses a
declared due/review field and selected timezone; default collection view = table,
no implicit 30-day creation filter. Unsupported field/view pairing falls back to
the authorized collection table and explains reset, never arbitrary client filters.
User pins > user dismissals > recommendations for ordering; none beats access.

## 9. Combinations, collisions, and test fixtures

- Multiple needs: deterministic union by primary-need order, no duplicate category
  installs, modules or typed shortcut targets. Template IDs may be shared across packs.
- Conflicting meaning: label Academic courses versus Course catalog; Service protocol
  versus sellable Service; member administration versus Team membership. Never globally
  rename Records, Leads, People or Catalog to one specialist noun.
- Different personal lens: keep site business schemas, apply functional emphasis
  to readable tools only. Complete reveals all authorized installed collections.
- Missing answers: general leaf; retained industry/size; Standard; Guided; no implicit
  sensitive install. Explicit empty recommendations remain empty except recovery tools.
- Sensitive answer in non-sensitive leaf: block affected template, offer reviewed
  specialized setup; do not store the answer in free-text operational notes.

Fixture gate: every one of 29 leaves x all three modes must resolve without an
undefined branch. Parameterized tests cover all 34 role IDs, all 19 needs, all
size rows, operating models, every module key and every section-7 state. Pairwise
tests cover leaf/role/need interactions; targeted cross-product tests cover privacy,
authorization, personal/site precedence and Complete. Snapshot semantic IDs plus
behavior assertions; translated display snapshots alone do not prove authorization.

Each template fixture includes valid payload, invalid type/range, wrong relation
category, cross-site ID, absent dependency, repeat install, conflict and upgrade.
No implementation is accepted while a catalog template/module/role reference is
unresolved. Validate in Jest and an approved disposable database/browser target.
Real clinical or student data, remote migrations and deployment are not authorized.