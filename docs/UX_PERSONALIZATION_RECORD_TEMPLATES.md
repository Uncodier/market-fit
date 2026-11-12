# UX personalization: business Record templates, fields, and relations

**Status:** Proposed schema catalog for review; not implemented or approved for installation.
**Parent:** [UI personalization plan](UX_PERSONALIZATION_DESIGN.md).
**Related:** [Business selection catalog](UX_PERSONALIZATION_BUSINESS_CATALOG.md) ·
[Execution rules](UX_PERSONALIZATION_EXECUTION_RULES.md) ·
[Installation and privacy contract](UX_PERSONALIZATION_TEMPLATES_AND_DECISIONS.md) ·
[Agency and Creator modes](UX_PERSONALIZATION_AGENCY_AND_CREATOR_MODES.md).
**Expanded coverage:** [Verticals, specializations, and operational packs](UX_PERSONALIZATION_RECORD_VERTICALS.md) ·
[Additional operational schemas](UX_PERSONALIZATION_RECORD_EXTENSIONS.md).
**Technical review:** [Fields, internal relations, and live DB target audit](UX_PERSONALIZATION_RECORD_SCHEMA_REVIEW.md)
identifies blocking mismatches and proposed v1 deltas. Its verified target findings
supersede the earlier `person`/same-site-company assumptions in companion summaries.
**Implementation follow-up:** [Records repair](RECORD_SCHEMA_REPAIR.md) documents
the implemented form/target/action guards and Records migrations applied to linked Makinari.
The schema inventory and business-specific extensions below remain proposals.

## 1. Purpose and review findings

This subdocument owns the proposed Record schema inventory: which collections each
business needs, their fields, relation keys, cardinality, dependencies, and release
prerequisites. Navigation, roles, CTAs, and copy remain in the related UX documents.
It retains the baseline 52 templates across 29 canonical business leaves and adds
40 proposed operational schemas in the extension catalog: **92 templates in total**.
Marketing Agency and Content Creator remain first-class aliases, not extra schemas.
The vertical catalog adds explicit specializations without changing the 12 existing
onboarding industries or claiming new runtime business leaves.

### 1.1 Expanded business coverage

The baseline was complete only for its launch taxonomy, not for practical industry
coverage. Repair shops and technical trades shared one generic field-service leaf;
construction, logistics, agriculture, animal care, recruitment, and care services
lacked distinct operational models. Broad labels also obscured meaningful differences
between legal/accounting practices, clinical specialties, retail and production trades.

Read the catalog in three layers:

| Layer | Owned here / companion | Scope |
| --- | --- | --- |
| Shared baseline | Sections 3–7 below | 52 original schemas, relation notation, 29 parent business mappings and shared gates |
| Business specializations | [Vertical catalog](UX_PERSONALIZATION_RECORD_VERTICALS.md) | Explicit specialization IDs, workshop/trade distinctions, recommended packs, field-extension proposals, workflows and module handoffs |
| Additional entities | [Extension schemas](UX_PERSONALIZATION_RECORD_EXTENSIONS.md) | 40 new definitions with fields, requiredness, typed relations, dependencies and domain constraints |

For workshops, start with assets, intake and repair jobs, then optionally add
diagnostics, planned materials, handover checks, warranties and maintenance plans.
Other additions cover site progress/defects, delivery/storage observations, crops and
harvests, animal care, legal matters, hiring, care visits, grants, returns and process
quality. Packs reuse schemas rather than creating one duplicate template per trade.
The extension tables are part of this proposed inventory, not an implemented registry.

The earlier documents contain four schema ambiguities resolved or tracked here:

- Use the shared unprefixed IDs (`academic_courses`, `grades`, etc.). Earlier
  `school.*` wording denotes pack grouping, not additional template IDs. There is
  no installed registry to migrate as part of this documentation change.
- `person`, `staff`, and `item` were shorthand targets, not explicit field keys.
  The tables below propose stable relation keys and requiredness for review.
- Alternative targets such as engagement/production brief need separate optional
  typed relations; do not put unrelated categories into one unchecked UUID field.
- Patient identity, academic scales, uniqueness scopes, and restricted access
  remain unresolved prerequisites, not invented defaults.

## 2. Existing Records boundary

The table below preserves the pre-repair source and read-only database review of
2026-11-10. [Records repair](RECORD_SCHEMA_REPAIR.md) supersedes the historical gaps
for stable names/labels, typed action validation, supported supplier/company targets
and category-constrained relations. Installation/provenance, domain rules and privacy
gates remain separate. No new database inspection was performed for this expansion.

| Source | Current contract | Missing prerequisite for this catalog |
| --- | --- | --- |
| [Actions](../app/records/actions.ts) | `record_categories.template_fields`; record `title`, `description`, `data`, `relations`, `status`; authenticated user-scoped client | Typed schema validation, pack provenance, installation transaction, expected-category checks |
| [Template editor](../app/records/components/CategoryTemplateEditor.tsx) | Field types, relation targets, category hierarchy | Stable keys separate from labels, registry preview, requiredness and validator contract |
| [Dynamic form](../app/records/[id]/components/RecordDynamicForm.tsx) | Values addressed by `field.name`; text, description, number, date, select, boolean, location, relation, file, table | Compatibility mapping for old names, conditional validation, reviewed relation cardinality |
| [Embedding worker](../app/records/lib/record-embedding-worker.ts) | External processing path | Deny-by-default sensitive-data admission and retrieval enforcement |

Collections use Records; products/services use Catalog; appointments use
Reservations; tasks, payments, orders, inventory, content, and campaign execution
stay in their existing modules. A Record relation never executes those workflows.
Category parenting is presentation grouping, not a business relation or an ACL.
Important: current assignment-restricted access searches actor IDs in relation JSON,
and location policies block some relational journeys. The intended separation of
context links and access is not implemented; do not infer privacy from this catalog.

## 3. Shared schema notation and storage proposal

- Every template has required canonical `title`, optional canonical `description`,
  trusted site/category IDs, timestamps, and existing canonical `status`.
  Canonical `location_id` also exists in the database; the reviewed create/update
  action schemas do not expose it. Location scope needs a separate authorized contract.
- `field_key*:type` means required; unmarked fields are optional. `description`
  denotes a long-text field type, not an extra lifecycle or document engine.
- Scalar values belong in `data[field_key]`; relations in `relations[relation_key]`.
  Stable keys are English identifiers; labels use localization tokens. Existing
  `field.name` storage requires a separately reviewed compatibility implementation.
- All listed relation fields are single-valued: required = exactly one readable
  target; optional = zero or one. Reverse lookup is one-to-many, not a duplicated
  editable list. Multi-select relations are outside the initial contract.
- `key -> template` means `relationTarget=record` plus the proposed expected
  template/category constraint, not a table named after the template. That category
  constraint is missing from the current picker and write validation.
- `lead` targets existing site CRM contacts. The current `person` target queries
  absent `public.users`; it is blocked, not a usable generic contact. `persons` and
  `profiles` are different identities and cannot be substituted automatically.
- `team_member` stores `site_members.user_id` scoped by site, not membership row ID.
  `catalog_item`, `campaign`, and `deal` target site entities. `company` is global
  without `site_id`; it needs an approved site-association contract. Suppliers are
  distinct site-owned entities and need a new supported Records target.
- Required relations require installed dependencies and valid targets before save.
  Optional relations do not force installation; omit/disable their field until the
  target is available. Never create a placeholder foreign record automatically.
- Reuse one template per site across packs; business-specific labels do not create
  different schemas. Distinct access scopes need explicit controls or separate sites.
- All defaults are empty except existing record `status` behavior. No automatic
  current date, staff assignment, grade scale, approval, or completion value.

## 4. Baseline business-to-template matrix

These are recommendations, not mandatory installation lists. Managers select
templates based on explicit needs; dependencies are reviewed before installation.
The schema tables in section 5 define the fields and relations for every ID here.
Use the [vertical catalog](UX_PERSONALIZATION_RECORD_VERTICALS.md) for more specific
businesses and the [extension schemas](UX_PERSONALIZATION_RECORD_EXTENSIONS.md) for
their additional entities. These 29 rows are compatibility parents, not the full
specialization inventory.

| Business leaf / label | Recommended templates | Main relation pattern / release review |
| --- | --- | --- |
| technology.saas / SaaS | client_onboarding, support_cases, release_notes | Customer and owner links; no provisioning or SLA execution |
| technology.software_services / Software services | service_engagements, deliverables, support_cases | Engagement -> deliverables; customer confidentiality |
| healthcare.clinic / Clinic | service_protocols, administrative_followups; gated patient_index, medical_history, encounter_notes, follow_up_plans | Separate operational and clinical tiers; clinical graph below |
| healthcare.wellness / Wellness, salon, fitness | service_sessions, service_protocols, equipment_checks | Contact + sellable service + practitioner; no clinical notes |
| healthcare.supplier / Healthcare supplier | compliance_evidence, account_plans, quality_checks | Catalog item and customer; evidence is not verification |
| finance.advisory / Accounting and advisory | service_engagements, compliance_tasks, document_register | Client engagement; financial confidentiality gate |
| finance.operations / Internal finance | review_notes, document_register, compliance_tasks | Staff and review context; no bank/payment state storage |
| education.school / School | academic_courses, groups, student_profiles, enrollments, grades, attendance | Course + student -> enrollment -> assessment/attendance; academic privacy gate |
| education.course_business / Courses and coaching | cohorts, session_plans, feedback_register | Cohort -> plans/feedback; Catalog holds sellable courses |
| retail.store / Physical retail | store_checklists, customer_requests, equipment_checks | Customer requests may reference catalog items |
| retail.ecommerce / E-commerce | product_content, customer_requests, quality_checks | Product content requires a Catalog item; no automatic publication |
| retail.wholesale / Wholesale | account_plans, compliance_evidence, customer_requests | Customers and item references; pricing remains in commerce |
| manufacturing.production / Repeat production | production_batches, quality_checks, equipment_checks, compliance_evidence | Batch -> quality checks; no stock postings |
| manufacturing.custom / Made-to-order production | customer_specifications, work_packages, quality_checks | Specification -> work package -> quality check |
| entertainment.events / Events | event_plans, event_checklists, supplier_briefs | Event -> checklist; no attendance entitlement |
| entertainment.creator / Content Creator | editorial_briefs, production_briefs, sponsorship_briefs, deliverables, review_notes | Production brief -> deliverables; sponsor/deal links optional |
| entertainment.studio / Media studio | production_briefs, deliverables, document_register | Client brief -> deliverables; private evidence storage review |
| food.restaurant / Restaurant and cafe | recipe_reference, food_safety_checks, store_checklists, supplier_briefs | Recipe/item references; no safety certification or stock depletion |
| food.production / Packaged food | production_batches, recipe_reference, food_safety_checks, compliance_evidence | Batch -> safety observation; approved food-safety scope |
| travel.lodging / Lodging | housekeeping_checks, equipment_checks, customer_requests | Space/equipment text references; no room availability changes |
| travel.tours / Tours and travel services | itinerary_plans, departure_checklists, supplier_briefs | Itinerary -> departure checklist; exclude passport/ticket data |
| real_estate.brokerage / Property brokerage | property_references, viewing_notes, document_register | Property -> viewing; minimal customer/location data |
| real_estate.management / Property management | property_references, maintenance_requests, property_inspections, document_register | Property -> requests/inspections; private property evidence review |
| services.consulting / Consulting, legal, design | service_engagements, deliverables, document_register | Engagement -> deliverables; confidential-document gate |
| services.agency / Marketing Agency | editorial_briefs, production_briefs, deliverables, account_plans, review_notes | Client + brief -> deliverables; grouping clients is not client ACLs |
| services.field / Field service and repair | maintenance_requests, work_packages, equipment_checks | Request -> work package; assignment is not dispatch |
| other.b2b_supplier / B2B supplier or buyer | account_plans, supplier_briefs, compliance_evidence, review_notes | Company/customer/item references; procurement stays separate |
| other.organization / Nonprofit or member organization | program_plans, member_register, event_plans, review_notes | Approved contact for member administration; no application membership |
| other.general / General or mixed business | general_notes, store_checklists, review_notes | Optional staff; no inferred or automatically generated schema |

## 5. Baseline field and relation catalog (52)

These scalar fields retain the earlier registry's proposed keys and requiredness.
Relation keys/cardinality and corrected CRM targets below are proposals to approve.
Optional staff relations are intended as context, not immutable authorship or legal
signatures. Current assignment RLS can nevertheless treat any such UUID as access
evidence; the technical review records this blocking mismatch.

### 5.1 Shared operations, clients, and delivery (9)

| Template ID / collection | Fields beyond canonical title/description | Relation fields |
| --- | --- | --- |
| general_notes / General notes | note:description, recorded_on:date | author -> team_member |
| review_notes / Review notes | scope*:text, reviewed_on:date, summary:description, next_step:text | reviewer -> team_member |
| store_checklists / Operational checklists | routine*:text, checked_on*:date, completed:boolean, notes:description | checked_by -> team_member |
| equipment_checks / Equipment checks | equipment_ref*:text, checked_on*:date, result*:select(pass/fail/review), notes:description | checked_by -> team_member |
| client_onboarding / Client onboarding | started_on:date, checklist:description, owner_notes:description | client -> lead; owner -> team_member |
| support_cases / Support cases | opened_on*:date, priority:select(low/normal/high), issue*:description, resolution:description | customer -> lead; assignee -> team_member |
| release_notes / Release notes | version*:text, released_on:date, changes*:description | author -> team_member |
| service_engagements / Service engagements | reference*:text, scope*:description, start_on:date, due_on:date | client -> lead; owner -> team_member |
| deliverables / Deliverables | due_on:date, brief*:description, delivery_notes:description | engagement -> service_engagements; production_brief -> production_briefs; assignee -> team_member |

`deliverables.brief` is scalar brief text; `production_brief` is a relation.
Both engagement and production-brief links can be present if explicitly relevant;
neither is required. Reverse engagement/brief lookup can contain many deliverables.
Reviews currently relate only to a reviewer; `scope` is text, not a structured
deliverable link. Adding a review-to-deliverable relation requires a versioned extension.

### 5.2 Healthcare operations and clinical tier (7)

| Template ID / collection | Fields | Relation fields / release prerequisite |
| --- | --- | --- |
| service_protocols / Service protocols | service_code:text, procedure*:description, revision_on:date | service_item -> catalog_item; non-patient operational reference |
| administrative_followups / Administrative follow-ups | reference*:text, due_on:date, task_state:select(open/done), notes:description | contact -> lead only for an approved existing administrative CRM contact; not patient identity |
| patient_index / Patient index | patient_reference*:text; additional minimal identity fields remain blocked pending approval | No identity relation assumed; approved patient identity and record-access model required |
| medical_history / Medical history | recorded_on*:date, history:description, allergies:description | patient* -> patient_index; author -> team_member; clinical gate |
| encounter_notes / Encounter notes | encounter_on*:date, reason:description, findings:description, plan:description | patient* -> patient_index; clinician* -> team_member; history -> medical_history; clinical gate |
| follow_up_plans / Clinical follow-up plans | due_on*:date, instructions:description, followup_state:select(open/done) | patient* -> patient_index; encounter* -> encounter_notes; clinical gate |
| service_sessions / Non-clinical service sessions | session_on*:date, service_notes:description | contact -> lead under non-clinical privacy review; service_item -> catalog_item; practitioner -> team_member |

Do not introduce a Reservation relation until that target is separately supported
and authorized. Operational clinic/wellness data still requires privacy review.
Medical templates remain unavailable until every gate in the installation contract
passes; the incomplete patient identity definition is a blocking decision.

### 5.3 Compliance, account planning, and documents (5)

| Template ID / collection | Fields | Relation fields |
| --- | --- | --- |
| compliance_evidence / Compliance evidence | evidence_ref*:text, issuer:text, expiry_on:date, scope:description | item -> catalog_item |
| account_plans / Account plans | objective*:description, next_review_on:date, next_step:text | client -> lead; owner -> team_member |
| quality_checks / Quality checks | checked_on*:date, result*:select(pass/fail/review), findings:description | batch -> production_batches; work_package -> work_packages; item -> catalog_item |
| compliance_tasks / Compliance tasks | obligation_ref*:text, due_on*:date, task_state:select(open/done), notes:description | owner -> team_member |
| document_register / Document register | document_ref*:text, purpose:description, review_on:date | contact -> lead for CRM context only; owner -> team_member |

Quality checks retain the existing optional batch/work-package/item targets;
additional staff attribution would be a reviewed extension, not a silent new field.
Document/evidence references are not file attachments, signed approvals, arbitrary
fetch URLs, or regulatory acceptance. Private files need their own storage contract.

### 5.4 Schools, academic administration, and course businesses (9)

| Template ID / collection | Fields | Relation fields |
| --- | --- | --- |
| academic_courses / Academic courses | course_code*:text, academic_level:select(approved levels), hours:number | commercial_course -> catalog_item |
| groups / Groups and classes | group_code*:text, term*:text, capacity:number | course* -> academic_courses; teacher -> team_member |
| student_profiles / Student profiles | student_reference*:text, enrolled_on:date, admin_notes:description | No contact relation until student/contact identity model is approved; never infer a Lead or account |
| enrollments / Enrollments | enrolled_on*:date, term*:text, enrollment_state:select(pending/active/withdrawn/completed) | student* -> student_profiles; group* -> groups |
| grades / Grades | assessment*:text, assessed_on*:date, score:number, scale:select(approved scales), result_text:text, feedback:description | enrollment* -> enrollments; assessor -> team_member |
| attendance / Attendance | session_on*:date, attendance_state*:select(present/absent/late/excused), notes:description | enrollment* -> enrollments; recorded_by -> team_member |
| cohorts / Course cohorts | cohort_code*:text, start_on:date, end_on:date | course_item -> catalog_item; instructor -> team_member |
| session_plans / Session plans | session_on:date, agenda*:description, preparation:description | cohort -> cohorts; course_item -> catalog_item; instructor -> team_member |
| feedback_register / Feedback register | received_on*:date, feedback*:description, followup:text | cohort -> cohorts; contact -> lead only for approved CRM feedback, not academic identity |

Student entries are individual records, not a shared class-wide grade table.
Academic levels/scales are approved configuration, never fabricated options. For
numeric assessment use a valid numeric score within the chosen scale; for
qualitative assessment use the approved result text and no numeric score. Final
conditional requiredness of scale/result must be approved and server-enforced.
Selling courses does not install student profiles, grades, or academic permissions.

### 5.5 Retail and manufacturing (5)

| Template ID / collection | Fields | Relation fields |
| --- | --- | --- |
| customer_requests / Customer requests | received_on*:date, request*:description, request_state:select(open/done) | customer -> lead; item -> catalog_item; assignee -> team_member |
| product_content / Product content briefs | product_summary*:description, copy_brief:description, review_on:date | item* -> catalog_item |
| production_batches / Production batch notes | batch_ref*:text, produced_on:date, quantity:number, notes:description | item -> catalog_item; owner -> team_member |
| customer_specifications / Customer specifications | specification_ref*:text, requirements*:description, reviewed_on:date | customer -> lead; item -> catalog_item |
| work_packages / Work packages | scope*:description, due_on:date, work_notes:description | specification -> customer_specifications; maintenance_request -> maintenance_requests; assignee -> team_member |

Batch quantities are recorded observations, not inventory movements. Equipment
and batch references do not establish a certified traceability system. Work-package
specification/request links are optional and independently typed.

### 5.6 Events, agency, creator, and studio (6)

| Template ID / collection | Fields | Relation fields |
| --- | --- | --- |
| event_plans / Event plans | event_on:date, purpose*:description, venue_ref:text | coordinator -> team_member |
| event_checklists / Event checklists | routine*:description, due_on:date, completed:boolean | event* -> event_plans; owner -> team_member |
| supplier_briefs / Supplier briefs | supplier_ref*:text, requirements*:description, review_on:date | supplier -> suppliers.id is a proposed new target, blocked until supported; company is not supplier identity |
| editorial_briefs / Editorial briefs, Ideas and scripts | objective*:description, audience:text, due_on:date | owner -> team_member; campaign -> campaign |
| sponsorship_briefs / Sponsorship briefs | sponsor_ref*:text, commitments*:description, due_on:date | sponsor_contact -> lead; commercial_deal -> deal |
| production_briefs / Production briefs, Client creative briefs | scope*:description, production_on:date, delivery_notes:description | client -> lead; owner -> team_member |

Agency uses these plus account_plans, deliverables, and review_notes. Creator uses
editorial_briefs, production_briefs, sponsorship_briefs, deliverables, review_notes.
Client grouping is not isolation; separate authorized sites remain necessary where
existing controls cannot enforce client confidentiality. A campaign/deal reference
does not authorize publishing, spend, signatures, invoicing, or external routing.
Editorial/sponsorship-to-production links are not in the baseline; review separately
if a structured end-to-end content graph is needed rather than free-text context.

### 5.7 Food, lodging, and travel (5)

| Template ID / collection | Fields | Relation fields |
| --- | --- | --- |
| recipe_reference / Recipe references | recipe_code*:text, ingredients:description, method:description, revision_on:date | item -> catalog_item |
| food_safety_checks / Food-safety observations | check_ref*:text, checked_on*:date, result*:select(pass/fail/review), observation:description | batch -> production_batches; checked_by -> team_member |
| housekeeping_checks / Housekeeping checks | space_ref*:text, checked_on*:date, completed:boolean, notes:description | checked_by -> team_member |
| itinerary_plans / Itinerary plans | departure_on:date, itinerary*:description, service_ref:text | service_item -> catalog_item; coordinator -> team_member |
| departure_checklists / Departure checklists | departure_on*:date, checklist*:description, completed:boolean | itinerary* -> itinerary_plans; owner -> team_member |

No room registry, recipe-to-batch relation, booking relation, capacity engine,
ticketing, or food-safety certification is introduced by these fields.

### 5.8 Property and organizations (6)

| Template ID / collection | Fields | Relation fields |
| --- | --- | --- |
| property_references / Property references | property_ref*:text, general_location:text; use canonical description | owner -> team_member |
| viewing_notes / Viewing notes | viewed_on:date, notes*:description, next_step:text | property* -> property_references; contact -> lead; agent -> team_member |
| maintenance_requests / Maintenance requests | asset_ref*:text, requested_on*:date, issue*:description, priority:select(low/normal/high) | property -> property_references; requester -> lead; assignee -> team_member |
| property_inspections / Property inspection notes | inspected_on*:date, findings*:description, next_review_on:date | property* -> property_references; inspector -> team_member |
| program_plans / Program plans | objective*:description, start_on:date, review_on:date | coordinator -> team_member |
| member_register / Member administration | member_ref*:text, joined_on:date, admin_state:select(active/inactive) | Contact relation blocked pending member identity/privacy contract; no implicit CRM or account creation |

The reviewed proposal removes duplicate `property_references.data.description` and
uses canonical `records.description`. No existing stored category/value is changed;
any existing custom data needs an explicit conflict-aware compatibility mapping.
Member administration is unrelated to `team_member`, access roles, or subscriptions.
Avoid deeds, identity documents, exact sensitive addresses, or screening data here.

## 6. Dependency and consistency rules

Required dependency graph (arrows point from prerequisite to dependent):

```text
academic_courses -> groups --+
student_profiles -----------+-> enrollments -> grades, attendance
patient_index -> medical_history
patient_index -> encounter_notes -> follow_up_plans
patient_index --------------------> follow_up_plans
event_plans -> event_checklists
itinerary_plans -> departure_checklists
property_references -> viewing_notes, property_inspections
catalog_item [existing entity] -> product_content
```

Optional graph: service_engagements/production_briefs -> deliverables;
customer_specifications/maintenance_requests -> work_packages;
production_batches/work_packages/catalog_item -> quality_checks;
production_batches -> food_safety_checks; property_references -> maintenance_requests.
These arrows do not require installing every optional upstream template.

In addition to target existence, readability, expected category and same-site scope:

- Encounter history, when selected, must belong to the same patient as the encounter.
- Follow-up patient must match the referenced encounter's patient.
- Enrollment term must match the selected group's approved term semantics.
- Session/course links should agree with the selected cohort when both reference
  a course; item/batch links on quality checks must not contradict known batch items.
- Validate dependency cycles before installing; resolve template IDs to trusted
  site category IDs, not category names or client-provided mappings.
- Target archive/delete/category change needs an impact policy; never cascade
  delete dependent content automatically or fall back to a similarly named target.

Cross-record invariants require server/database enforcement and concurrent-write
tests before release. Some optional consistency rules need domain approval before
becoming enforced constraints; they are not current implementation guarantees.

## 7. Validation, privacy, and installation gates

1. Required title and fields; bounded strings; valid date-only values; finite numbers;
   nonnegative hours/capacity/quantity; start <= end/due where applicable. Exact text
   limits, integer capacity rules, and uniqueness scopes must be approved per field.
2. Reject unsupported fields/types, invalid enum values, wrong-category, unreadable,
   cross-site and missing required references. `open/done` and `pass/fail/review`
   are field values, never new backend approvals or payment states.
3. Preview the versioned schema, selected dependencies, access/processing policy,
   conflicts and mappings. Authorized installation is atomic and idempotent;
   personal UX changes and GET navigation never install or modify collections.
4. Preserve local customization and old values through reviewed upgrades. Changing
   keys/types, removing fields, or tightening requirements needs explicit migration
   planning; do not modify applied migrations or overwrite populated categories.
5. Academic, clinical, financial, member, confidential client, and private document
   content require explicit access/minimization review. No role name grants access.
6. Sensitive records require the full record/file/search/export/AI/embedding/agent
   and audit/retention gates in the installation contract. Block installation when
   controls are absent; a generic notes template is not a sensitive-data workaround.
7. Install empty collections only. No real or sample students, patients, grades,
   customer documents, publishing jobs, payments, or supplier identities.

## 8. Decisions to approve and delivery sequence

| Decision | Required outcome |
| --- | --- |
| Baseline scope | Review the 52 baseline templates and 29 compatibility mappings; preserve existing IDs |
| Expanded coverage | Review the 40 additional definitions (92 total), specialization IDs, conditional dependencies and optional field extensions in the companion catalogs |
| Relation keys | Approve explicit keys/cardinality above and contact/staff/company semantics; confirm optional alternative targets |
| Missing structured links | Decide whether review-to-deliverable, editorial/sponsorship-to-production, recipe-to-batch, or staff-on-quality need versioned extensions |
| School configuration | Approved levels/scales, conditional grading rules, uniqueness scopes, teacher assignment/access and student/contact identity |
| Clinic configuration | Approved patient identity fields, clinician authorization, jurisdiction, amendment/retention and sensitive processing controls |
| Scalar limits | Exact bounds, date/timezone interpretation, integer rules and scoped uniqueness; preserve existing custom property descriptions during compatibility work |
| Confidentiality | Approved access/AI/export/file policies for financial, member, client and document data |
| Unsupported targets | Omit Reservations/room/equipment-registry links until a separately verified target contract exists |

Recommended sequence: approve schemas -> stable storage-key compatibility and typed
validators -> mapping/install transaction -> low-risk pilot, including priority
Agency/Creator packs -> remaining non-sensitive packs -> separately gated academic
and clinical packs. UX personalization delivery remains governed by the parent plan.

Acceptance evidence must cover every template with valid/invalid payloads, required
fields, enums/ranges, absent dependencies, wrong categories, unreadable/cross-site
references, consistency rules, install retries/concurrency/rollback and upgrade
conflicts. Verify that all 29 business leaves and expanded specializations resolve,
all 92 proposed schema IDs have definitions, shared templates deduplicate,
personal changes do not install, and blocked data never enters AI/search/export paths.
Use Jest plus an explicitly approved disposable database/browser target for runtime
work. This document authorizes no implementation, remote migrations, or deployment.