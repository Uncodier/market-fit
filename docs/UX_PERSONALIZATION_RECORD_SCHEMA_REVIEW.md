# Record template review: fields, internal relations, and database targets

**Status:** Review findings and proposed corrections; no runtime or database changes.
**Reviewed:** 2026-11-10, against local source and read-only metadata from the
Makinari Supabase project matched to this workspace's configured hostname.
**Catalog:** [52 templates and 29 business mappings](UX_PERSONALIZATION_RECORD_TEMPLATES.md).
**Follow-up:** [Implemented repair and remaining release gates](RECORD_SCHEMA_REPAIR.md).
The findings below describe the pre-repair audit; use the follow-up for current
local implementation status. The migration remains unapplied remotely.

Only schema metadata, constraints, policies, and function/trigger definitions were
queried. No customer records were read or modified. Metadata inspection is not an
authenticated end-to-end authorization test or a compliance certification.

## 1. Verdict

The 52-template inventory is useful as a documentation starter, but **not ready for
installation as a relational business model**. Several external targets are wrong,
internal target categories are unenforced, and some useful workflows remain linked
only by text. Separate these three release statuses:

- **Schema draft:** all 52 definitions still need stable keys and typed validation.
- **Operational candidate:** non-sensitive templates after core relation fixes.
- **Blocked:** clinical/academic identity, confidential processing, and restricted
  location/assignment scenarios until their authorization contracts are implemented.

## 2. Verified database target map

The picker and preview resolver are independent implementations; both must match
the approved target registry. A table's existence does not make it a supported UI target.

| Logical target | Verified database identity | Finding and proposed contract |
| --- | --- | --- |
| record | `public.records.id`, scoped by `site_id` and `category_id` | Existing target, but picker does not filter expected category. Bind internal links to installed template category IDs |
| record_category | `public.record_categories.id`, scoped by `site_id` | Collection identity only; never use it where a student, event, or encounter record is required |
| lead | `public.leads.id`, scoped by `site_id` | Use for an existing CRM customer/contact; preserve `company_id`, `person_id`, and `buyer_user_id` semantics rather than copying identity |
| person | Resolver queries `public.users`, which is absent | Broken mapping. Do not install `person` fields or silently reinterpret old UUIDs as Leads |
| persons (not a supported replacement) | `public.persons.id`; `full_name`, `role_query_id`, external identity fields; no `site_id` | Prospect/research identity, not a generic site contact; `leads.person_id` references it. Requires its own ownership contract, not a `users` table rename |
| profile/auth identity | `public.profiles.id` / `auth.users.id` | Application account, not CRM customer or student/patient identity; never substitute for `person` |
| team_member | `(site_members.site_id, site_members.user_id)` unique; separate row PK `site_members.id` | Picker stores `user_id`, not membership row ID. Require active, unsuspended, enabled membership; clinical/teaching capability is an additional check |
| company | `public.companies.id`; no `site_id` | Generic picker adds nonexistent `site_id` filter. Shared company readability does not prove a business relationship to this site |
| supplier (new target) | `public.suppliers.id`, scoped by `site_id`; optional `company_id` | Correct procurement identity. Add a typed picker/preview/write contract before linking; a company is not a supplier |
| catalog_item | `public.catalog_items.id`, scoped by `site_id` | Existing target. Validate kind/subtype per field; do not infer sellability/reservability from an arbitrary item |
| campaign | `public.campaigns.id`, scoped by `site_id` | Existing target; optional editorial/campaign context only |
| deal | `public.deals.id`, scoped by `site_id`, plus location access | Existing target; optional sponsorship commercial context, not payment evidence |
| content / task | `public.content.id` / `public.tasks.id`, scoped by `site_id` | Existing targets omitted from most baseline templates; useful explicit execution links, not copied execution states |
| sales_order | Resolver queries absent `public.orders`; actual table is `public.sale_orders` | Broken existing target outside baseline; repair and test before adding order links to requests/delivery |
| reservation (new target) | `public.reservations.id`, including `site_id`, `owner_site_id`, location and lead/item links | DB exists, Records target does not. Seller/buyer ownership and access need explicit review; do not blindly apply one site filter |
| location (new Records target) | `public.locations.id`; Records already has canonical `location_id` | Location scope is canonical authorization metadata, not a free-text field or a second JSON location reference |
| asset (new target) | `public.assets.id`, scoped by `site_id`, private/public file metadata | File/media asset, not a physical machine. A relation must not expose a public URL or bypass file authorization |

Catalog constraints currently admit `kind=product/service/digital_asset` and
`digital_subtype=ticket/course/file/pass/license`. A recorded academic course's
commercial link should explicitly permit `digital_asset + course` and separately
approved teaching services. Batch/recipe product links should not accept arbitrary
services. `is_reservation` and normal commerce checks remain authoritative.

The checked-in `lib/types/database.types.ts` still declares `users` and narrows
Catalog kind to product/service. These types are not evidence of the live schema.
Do not regenerate or change application types as part of this documentation review.

## 3. Blocking implementation mismatches

| Priority | Evidence | Required correction before template rollout |
| --- | --- | --- |
| P0 | `person`/`sales_order` table mismatch; `company.site_id` absent | Correct shared target registry, picker, preview, validation and existing-data compatibility together |
| P0 | `can_access_record_values` checks whether the actor UUID occurs anywhere in `relations::text` for assignment-restricted members | Contextual author/reviewer links can affect access today. Replace ambiguous string matching with a reviewed explicit assignment contract; do not claim relations are presentation-only |
| P0 | Live restrictive location policies deny categories for location-restricted users and require empty relations/null source for non-owner/admin record access | Current relational packs are incompatible with these restricted journeys. Preserve deny behavior until a reviewed location-aware relation policy exists |
| P0 | Record field data and relations accept arbitrary nested JSON; no inspected FK/trigger validates JSON targets | Enforce schema/category/type/site/readability on every writer and direct Data API path; client dropdown filtering is insufficient |
| P1 | Picker keys options by target only; all internal links share `record` | Key options/requests by site + field + expected category + access generation; clear stale site state and revalidate selected IDs |
| P1 | Preview queries use entity IDs without originating site/category context and key responses only by UUID | Carry trusted source context; use composite target keys. RLS readability in another authorized site is not same-site integrity |
| P1 | `field.name` is used in forms, graph and relation history | Separate immutable storage keys from localized labels, including readers/graphs/history/export and legacy mappings |
| P1 | Number input renders `0` as empty; date picker writes ISO timestamps; empty boolean renders false; select permits new values | Preserve zero; define date-only conversion; distinguish unset/false or approve defaults; disable custom values for closed enums |
| P1 | Relation form offers create for every target, but `resolveRelationId` supports only a subset and cannot create a valid category-bound Record | Existing-only selection by default; separate authorized entity creation with full required fields, not name-only placeholders |
| P1 | Category FK uses `ON DELETE CASCADE`; category has no archive column | Proposed safe removal/archive workflow does not exist. Review actual impact before category deletion; do not promise reference-safe uninstall |

These findings establish design/code/schema mismatches, not a demonstrated exploit.
Do not relax RLS or use service-role fallbacks to make template links work.

## 4. Field and internal relation review by template family

The baseline catalog remains an inventory, not an approved complete workflow.
The additions below are **proposed v1 deltas**, not already installed fields.
Keep 52 IDs; extend definitions before approval rather than invent duplicate templates.

| Templates reviewed | Field/relation recommendation |
| --- | --- |
| general_notes, review_notes | Keep generic notes optional. Add optional `deliverable -> deliverables` and `engagement -> service_engagements` to review notes for structured review context; retain scope text. No approval effect |
| store_checklists, equipment_checks | Clarify one row per check/run, not the reusable checklist definition. Keep `checked_on` and result; optional execution task link. `equipment_ref` is text until a physical equipment model is approved |
| client_onboarding, support_cases, release_notes | Require `client/customer -> lead` for client-bound entries, but allow explicit internal support cases. Add optional `execution_task -> task` for actionable work. Release version/date remain documentary; no deployment state |
| service_engagements, account_plans | Add `client_company -> company` only with verified site association; keep `client -> lead` as contact. Require at least one approved account anchor for client engagements/plans; do not require a natural-person Lead for every B2B organization |
| deliverables | Add optional `editorial_brief -> editorial_briefs`, `sponsorship -> sponsorship_briefs`, and `content_item -> content`. For client deliverables require engagement or production brief; own-brand deliverables may stand alone. Multiple outputs are multiple deliverable records |
| service_protocols, administrative_followups, service_sessions | Enforce service-item kind. Operational contact may use an existing approved Lead, never patient identity by inference. Add reservation/task links only after their supported-target contracts; do not duplicate appointment time/status |
| patient_index, medical_history, encounter_notes, follow_up_plans | Keep clinical gate. Patient has many dated histories/encounters; linked history must match patient. Encounter clinician must have approved capability. Derive follow-up patient from encounter or enforce equality atomically if retained; author field is not immutable audit |
| compliance_evidence, compliance_tasks, document_register | Define issue/review/expiry meaning; issuer text is not verification. Add optional `execution_task -> task`; private evidence reference requires authorized storage/asset contract. Supplier evidence must link supplier, not just catalog product |
| quality_checks | Add `checked_by -> team_member`; preserve the actual immutable actor separately. Require at least one inspected subject (batch/work package/item) when an inspection is recorded. If multiple links exist they must identify compatible subjects |
| academic_courses, groups | Keep course/group codes and approved level. Add explicit academic term model or controlled term key before school reporting; free-text terms will drift. Capacity is nonnegative integer; no booking capacity enforcement implied |
| student_profiles, enrollments | Do not require CRM conversion or account creation for students. Enrollment is the student-group join entity. Decide uniqueness for student + group + term, including withdrawal/re-enrollment; avoid duplicating the group's term unless snapshot semantics are explicit |
| grades, attendance | Grade needs an assessment identity/attempt policy, not only an assessment label. Attendance date alone cannot distinguish multiple sessions/day: require a session identifier (or approved session model). Define uniqueness and corrections; do not add guessed scoring scales |
| cohorts, session_plans, feedback_register | Require cohort for cohort-specific sessions/feedback; standalone coaching remains explicit. If feedback concerns a specific session add `session_plan -> session_plans`. Course-item links must agree with cohort; minimize participant identity |
| customer_requests, product_content | Keep required Catalog link on product content and closed request state. Customer request may link repaired sales_order/reservation targets if relevant; no copying payment/refund state. Add optional `content_item -> content` for produced copy |
| production_batches, customer_specifications, work_packages | Quantity is meaningless without product/UOM semantics: bind to approved item and unit when quantity is present. Add optional `recipe -> recipe_reference` to batches. Require specification or maintenance request for scoped work; standalone work remains explicit |
| event_plans, event_checklists, supplier_briefs | Event date is planning only, not precise scheduling. Required event link is correct. Replace supplier company identity with a new typed supplier relation; keep supplier_ref only as external/reference text, not a second identity source |
| editorial_briefs, production_briefs, sponsorship_briefs | Add optional editorial/sponsorship links on production briefs, keeping graph direction toward deliverables. Sponsorship needs approved sponsor/company/contact context, not sponsor_ref alone. Content format can be a reviewed closed enum; publishing destination stays in execution settings |
| recipe_reference, food_safety_checks | Ingredients/method text is acceptable for reference, not formula/BOM execution. Link safety checks to batch or approved subject when relevant; standalone kitchen observations need explicit subject text. No certification claim |
| housekeeping_checks, itinerary_plans, departure_checklists | Space/service refs remain text until a supported room/service model exists. Multiple departures/day need departure identity/time in Reservations or reviewed scheduling extension; date-only checklist is insufficient for departure-level uniqueness |
| property_references, viewing_notes, maintenance_requests, property_inspections | Remove duplicate data.description in favor of canonical description. Require property for property-management requests, while equipment repairs may use asset_ref. Property is not an Inventory location; inspection remains non-certified |
| program_plans, member_register | Membership register is personal administration, not platform access. Program participation is many-to-many: if needed propose a dedicated participation/join template with dates/status rather than a multi-value text field; not part of the 52 baseline |

Requiredness that varies by use case must be a reviewed site-installed schema
variant or explicit conditional field contract, **never the current user's UX
persona**. For example, internal support and client support need distinguishable
context before different customer requirements can be enforced. Context values and
conditions must be approved before these deltas can be called executable schemas.

## 5. Recommended internal graph and persistence contract

```text
CRM lead / approved company association -> engagement / account plan
editorial brief --+-> production brief -> deliverable -> review note
sponsorship -----+           |               |
                             +-----> existing content (optional execution link)
specification / maintenance request -> work package -> quality check
recipe -> production batch -> quality / food-safety check
academic course -> group <- enrollment -> student
                           enrollment <- grade / attendance
patient <- history / encounter <- follow-up
property <- viewing / inspection / maintenance request
event <- checklist; itinerary <- departure checklist
```

Arrows in this diagram describe business connections, not automatic writes. Each
relation is stored on the dependent record; reverse lists are derived. Many-to-many
academic enrollment already has a proper join record. Do not store duplicate
bidirectional arrays. Add join templates only where the relationship itself has
fields (membership dates, participation state, assignment periods).

For internal fields, the proposed registry must distinguish:

- `relationTarget=record` (existing UI target), `targetTemplateId` (registry ID),
  installed `targetCategoryId`, immutable field key, requiredness and cardinality.
- Stored value is the target **record ID**, not the template/category ID. Names
  must not resolve identity. A readable category does not imply readable records.
- Template dependencies may form a DAG while arbitrary data links can form cycles;
  reject self/cycles only where business semantics require them. Bound traversal.

Existing JSON relations are not PostgreSQL foreign keys or automatically joinable
PostgREST relationships. Proposed persistence decision: retain the scalar JSON
contract for compatibility, but choose either database-enforced validation on all
write paths or reviewed normalized typed link tables with real constraints. Do not
maintain an independently writable JSON copy and link table; any projection must
have one atomic writer/source of truth. Direct Data API writes must not bypass it.

Validate target changes and deletes as well as source writes. Restrict deletion
when required references exist; optional unlinking needs explicit retention/audit
policy. Add bounded reverse queries/indexes for field + target lookups after the
storage decision. RLS and composite site constraints remain independent requirements.

See [Supabase tables and relationships](https://supabase.com/docs/guides/database/tables)
for the distinction between JSON columns and relational foreign keys.

## 6. Evidence and validation

Source anchors:

- [Target configuration](../app/records/lib/relation-target.ts),
  [picker](../app/records/hooks/useRelationOptions.ts),
  [preview resolver](../app/records/entity-preview-actions.ts).
- [Form](../app/records/[id]/components/RecordDynamicForm.tsx),
  [actions](../app/records/actions.ts),
  [inline entity creation](../app/commerce/resolve-relation.ts),
  [graph reader](../app/records/components/records-graph-model.ts).
- [Record access and category FK](../supabase/migrations/20260916020700_records_access_hardening.sql),
  [location enforcement](../supabase/migrations/20261020030002_location_enforcement_policies.sql),
  [location insert grant](../supabase/migrations/20261021010004_location_records_insert_and_readiness.sql).

Executed existing Jest suites: relation-target, employee-relation-options, and
record-actions-security: **3 suites, 12 tests passed**. These mocks confirm existing
helper behavior, not the target mappings against live DB or the proposed validators.
No browser test, production build, remote write, or migration was run.

Before implementation acceptance, add regression cases for missing table mappings,
company/supplier association, target-category separation, multi-site membership IDs,
zero/date/enum/unset values, direct writes, source/target reclassification, referenced
deletion, concurrent edits, location restriction, assignment-link effects, preview
context and privacy admission. Do not declare the catalog production-ready from
these three existing suites.