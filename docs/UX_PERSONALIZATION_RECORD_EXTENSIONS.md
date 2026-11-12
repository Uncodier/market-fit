# Record templates: additional operational schemas

**Status:** 40 proposed additional definitions; not installed or runtime-validated.
**Parent:** [Baseline schemas and shared contract](UX_PERSONALIZATION_RECORD_TEMPLATES.md).
**Selection:** [Vertical and specialization packs](UX_PERSONALIZATION_RECORD_VERTICALS.md).
**Current implementation:** [Records repair and remaining gates](RECORD_SCHEMA_REPAIR.md).

## 1. Schema contract

These 40 IDs extend the 52-template baseline to **92 proposed templates**. They do
not replace existing IDs or silently add fields to populated categories. All
definitions inherit canonical title, description, status, trusted site/category
scope, and the parent installation/privacy contract. `field*:type` is required
for a complete non-draft record; draft saves may omit required values but never
bypass validation of supplied values. Unmarked fields are optional.

Relations are single-valued: `key* -> template` requires exactly one readable
record in the installed target category; an unmarked relation permits zero or one.
Reverse lists are derived. `lead`, `team_member`, and `catalog_item` refer to the
existing supported entity contracts, not newly created Records collections.
Required internal relations create installation dependencies; optional ones do not.
Resolve template IDs to trusted category IDs in the proposed installer; names and
client-provided category mappings are not identity or authorization.

Use existing field types only. Scalar values go in `data`, relations in `relations`;
storage keys are immutable English identifiers with separate display labels. Dates
are calendar dates, not appointment timestamps. Explicit business-state selects
are descriptive observations, not canonical status values, approvals, entitlements,
legal signatures, inventory movements or module commands. Defaults remain empty.
Exact string limits and jurisdiction-specific retention must be approved before
release. Referenced documents are not file uploads or externally fetched URLs.

## 2. Assets, workshops, repair, and rental (9)

| Template ID / collection | Fields beyond canonical title/description | Relation fields |
| --- | --- | --- |
| service_assets / Service assets | asset_ref*:text, asset_kind*:select(vehicle/device/machine/equipment/other), make:text, model:text, serial_ref:text, asset_notes:description | customer -> lead; custodian -> team_member |
| repair_intakes / Repair intakes | intake_ref*:text, received_on*:date, reported_issue*:description, received_condition:description, requested_by_on:date, service_mode:select(workshop/on_site) | asset* -> service_assets; customer -> lead; received_by -> team_member |
| diagnostic_reports / Diagnostic reports | diagnosed_on*:date, observations*:description, proposed_work:description, diagnostic_method:text | intake* -> repair_intakes; technician -> team_member |
| repair_jobs / Repair jobs | job_ref*:text, scope*:description, opened_on*:date, due_on:date, completed_on:date, work_state:select(planned/in_progress/waiting_parts/completed/cancelled), work_notes:description | intake* -> repair_intakes; diagnosis -> diagnostic_reports; technician -> team_member |
| material_requirements / Material requirements | material_ref*:text, quantity*:number, unit*:text, needed_on:date, purpose:description | repair_job -> repair_jobs; work_package -> work_packages; item -> catalog_item |
| handover_checks / Repair handover checks | checked_on*:date, result*:select(pass/fail/review), delivered_on:date, condition_notes*:description | repair_job* -> repair_jobs; checked_by -> team_member |
| warranty_cases / Warranty follow-up cases | case_ref*:text, reported_on*:date, reported_issue*:description, review_state:select(open/under_review/resolved/declined), resolution_notes:description | original_job* -> repair_jobs; assignee -> team_member |
| maintenance_plans / Maintenance plans | plan_ref*:text, procedure*:description, start_on:date, next_due_on:date, interval_value:number, interval_unit:select(days/months/km/mi/hours) | asset* -> service_assets; responsible -> team_member; service_item -> catalog_item |
| rental_handovers / Rental condition handovers | rental_ref*:text, direction*:select(outbound/return), checked_on*:date, condition_notes*:description, expected_return_on:date | asset* -> service_assets; customer -> lead; outbound_handover -> rental_handovers; checked_by -> team_member |

`service_assets` tracks maintainable/custodied objects, not sellable stock. A serial
number is optional and never a global unique key by assumption. Existing
`equipment_checks.equipment_ref` remains text; do not imply it gained an asset
relation. `maintenance_requests` and `work_packages` retain their baseline schemas.

Workshop rules to approve and enforce:

- Diagnosis selected on a job must reference the same intake. The asset comes
  from that intake; do not duplicate a mutable asset relation on the job.
- Material requirement must have **exactly one** of `repair_job` or `work_package`.
  Quantity is positive and finite; unit is explicit. This is planned need, not
  parts reservation, consumption, a bill of materials, or authoritative pricing.
- Intake customer is the requesting contact, not necessarily the asset's current
  owner; do not enforce equality or infer legal ownership from either relation.
- `requested_by_on >= received_on`; job `due_on >= opened_on` and
  `completed_on >= opened_on` when supplied. A completed job requires completed_on;
  date ordering between related records needs domain-approved correction handling.
- Maintenance interval value/unit are either both absent or both present. Value
  is positive; `next_due_on >= start_on` when both exist. Meter-based intervals
  never generate a guessed calendar date or automatically schedule a Reservation.
- A rental return requires `outbound_handover` targeting an outbound record with
  the same asset/rental reference and no later check date. Outbound rows cannot
  link another outbound. Disallow self-reference; multiple condition checks do
  not establish partial-return accounting. Availability and deposits stay separate.
- `delivered_on >= checked_on` when present. A pass value and completed job do
  not authorize physical release, a warranty, a roadworthiness certificate or payment.
- Warranty cases link original work, not newly inferred sales orders. Eligibility,
  warranty duration, refunds, and manufacturer claims remain external decisions.

Asset identifiers, custody notes, vehicle plates and contact links require data
minimization. Photos/files, device credentials, GPS routes, signatures, insurance
documents and biometric data are not included in this starter.

## 3. Construction and facilities (6)

| Template ID / collection | Fields | Relation fields |
| --- | --- | --- |
| site_projects / Site projects | project_ref*:text, scope*:description, site_reference:text, start_on:date, target_on:date | client -> lead; property -> property_references; owner -> team_member |
| site_diaries / Site diaries | recorded_on*:date, work_summary*:description, blockers:description, weather_notes:text | project* -> site_projects; recorded_by -> team_member |
| work_measurements / Work measurements | measured_on*:date, work_ref*:text, quantity*:number, unit*:text, measurement_notes:description | project* -> site_projects; work_package -> work_packages; measured_by -> team_member |
| snag_items / Defects and punch-list items | observed_on*:date, issue*:description, severity:select(low/normal/high), due_on:date, resolution_notes:description | project* -> site_projects; work_package -> work_packages; assignee -> team_member |
| cleaning_visits / Cleaning and routine visits | visited_on*:date, area_ref*:text, scope*:description, result:select(completed/partial/not_performed), findings:description | property -> property_references; customer -> lead; performed_by -> team_member |
| pest_service_logs / Pest-service observations | serviced_on*:date, area_ref*:text, observed_issue*:description, work_summary:description, next_review_on:date | property -> property_references; customer -> lead; technician -> team_member |

Project target is not before start; work quantities are finite and nonnegative
with explicit units. Quantities are observations, never percentage-complete
certification or payment applications. Work-package/project association is not
currently stored on `work_packages`; do not claim that consistency can be checked
without a separately reviewed extension. Diaries and snag items are not permits,
safety sign-offs, incident investigations, or contractual change approvals.
Chemical names/doses and exact sensitive addresses require additional review.

## 4. Logistics and storage (3)

| Template ID / collection | Fields | Relation fields |
| --- | --- | --- |
| dispatch_briefs / Dispatch briefs | dispatch_ref*:text, planned_on*:date, origin_ref*:text, destination_ref*:text, load_summary:description, handling_notes:description | customer -> lead; vehicle -> service_assets; coordinator -> team_member |
| delivery_observations / Delivery observations | observed_on*:date, outcome*:select(delivered/partial/failed), exception_notes:description, recipient_reference:text | dispatch* -> dispatch_briefs; recorded_by -> team_member |
| storage_checks / Storage condition checks | area_ref*:text, checked_on*:date, result*:select(pass/fail/review), measured_value:number, measurement_unit:text, findings:description | batch -> production_batches; checked_by -> team_member |

Measured value/unit must be paired; measurements may be negative (for example,
cold-storage temperatures), so do not apply the quantity nonnegative rule to them.
No route optimization, live carrier event, customs declaration, legal proof of
delivery, recipient signature, stock posting, or telemetry is generated. A dispatch
vehicle reference must be reviewed as an eligible vehicle asset, not any readable
asset. Address details and recipient identity require separate minimization review.

## 5. Agriculture (4)

| Template ID / collection | Fields | Relation fields |
| --- | --- | --- |
| growing_units / Growing units | unit_ref*:text, unit_kind*:select(field/greenhouse/bed/orchard/other), area:number, area_unit:text | manager -> team_member |
| crop_cycles / Crop cycles | cycle_ref*:text, crop*:text, variety:text, started_on*:date, expected_harvest_on:date, closed_on:date | growing_unit* -> growing_units; owner -> team_member |
| field_observations / Field observations | observed_on*:date, observation*:description, action_notes:description | crop_cycle* -> crop_cycles; recorded_by -> team_member |
| harvest_lots / Harvest lot notes | lot_ref*:text, harvested_on*:date, quantity*:number, unit*:text, quality_notes:description | crop_cycle* -> crop_cycles; item -> catalog_item; recorded_by -> team_member |

Area/unit are paired with positive area; harvest quantity is positive. Cycle dates
and harvest date cannot precede cycle start when linked. Overlapping crop cycles
can be legitimate; do not invent a global exclusivity rule. Chemical application,
land title, certified organic status, and regulated traceability are outside this
schema. Harvest notes do not create stock or automatically become production batches.

## 6. Animal services (3)

| Template ID / collection | Fields | Relation fields |
| --- | --- | --- |
| animal_profiles / Animal profiles | animal_ref*:text, subject_kind*:select(individual/group), species*:text, name:text, breed:text, birth_on:date, care_notes:description | keeper -> lead |
| animal_care_logs / Animal care logs | cared_on*:date, service_summary*:description, observations:description, next_review_on:date | animal* -> animal_profiles; practitioner -> team_member; service_item -> catalog_item |
| veterinary_encounters / Veterinary encounter notes | encountered_on*:date, reason*:description, findings:description, plan_notes:description | animal* -> animal_profiles; clinician* -> team_member |

Keeper denotes a permitted CRM contact, not verified ownership. Individual/group
identity cannot change on a populated animal profile without a reviewed migration.
Veterinary encounters require an individual subject in this proposal; herd-health
records need a separate model. Human patient schemas must never be reused for pets.
Veterinary clinical authorization, consent, prescribing, vaccine certificates,
controlled substances, file access and retention require independent approval.
Non-clinical grooming/boarding packs do not install veterinary encounters.

## 7. Legal, financial, and recruitment services (5)

| Template ID / collection | Fields | Relation fields |
| --- | --- | --- |
| legal_matters / Legal matter register | matter_ref*:text, matter_type*:text, opened_on*:date, jurisdiction:text, scope_summary:description | client -> lead; responsible -> team_member |
| matter_milestones / Matter milestones | milestone_ref*:text, due_on*:date, basis_reference:text, summary*:description, completed_on:date | matter* -> legal_matters; owner -> team_member |
| filing_checklists / Period filing checklists | checklist_ref*:text, period_start*:date, period_end*:date, due_on:date, requirements*:description, evidence_reference:text | engagement* -> service_engagements; owner -> team_member |
| job_openings / Job openings | opening_ref*:text, role_title*:text, opened_on:date, requirements*:description, hiring_state:select(draft/open/paused/closed) | client -> lead; hiring_owner -> team_member |
| candidate_applications / Candidate applications | application_ref*:text, candidate_ref*:text, received_on*:date, application_state:select(received/review/interview/withdrawn/closed), review_notes:description | opening* -> job_openings; reviewer -> team_member |

Legal and financial records require client-confidentiality and privilege review;
matter deadlines are manually verified, not jurisdiction-calculated. Filing period
end is not before start. Neither document references nor completion dates prove a
filing was accepted, a tax obligation was met, or a payroll payment was executed.

Candidate identity is an approved pseudonymous reference pending a dedicated
identity/retention contract, not an inferred Lead, user account, or employee. Do
not put resumes, protected characteristics, background checks or scoring into
review_notes as a workaround. One candidate can apply to several openings;
duplicate policy must be reviewed rather than enforcing global uniqueness.
No hiring decision, automatic ranking, payroll or account provisioning is added.

## 8. Care, grants, and volunteering (5)

| Template ID / collection | Fields | Relation fields |
| --- | --- | --- |
| care_plans / Support-care plans | plan_ref*:text, recipient_ref*:text, support_scope*:description, start_on:date, review_on:date | coordinator -> team_member |
| care_visits / Support-care visit notes | visited_on*:date, support_summary*:description, followup_notes:description | plan* -> care_plans; caregiver* -> team_member |
| grant_projects / Grant projects | grant_ref*:text, objective*:description, start_on:date, end_on:date, funder_reference:text | program -> program_plans; owner -> team_member |
| grant_milestones / Grant milestones | milestone_ref*:text, due_on*:date, deliverable*:description, evidence_reference:text, completed_on:date | grant* -> grant_projects; owner -> team_member |
| volunteer_assignments / Volunteer participation | assignment_ref*:text, volunteer_ref*:text, role_summary*:description, start_on:date, end_on:date | program* -> program_plans; coordinator -> team_member |

Care recipient and volunteer identity contracts remain blocked; references must
not become an unrestricted parallel identity register. Care requires safeguarding,
assignment-specific access, sensitive processing and retention approval. It is not
clinical treatment, medication administration, emergency response or proof a visit
occurred. Staff links confer neither professional authorization nor safe assignment
isolation. Grant/volunteer dates must be ordered; financial terms, donation receipts,
eligibility screening and fund accounting remain outside these templates.

## 9. Retail, production, and personal services (5)

| Template ID / collection | Fields | Relation fields |
| --- | --- | --- |
| return_assessments / Return assessments | return_ref*:text, received_on*:date, reason*:description, condition_notes:description, recommendation:select(review/repair/replace/decline) | item* -> catalog_item; customer -> lead; assessor -> team_member |
| alteration_jobs / Alteration jobs | job_ref*:text, requested_on*:date, due_on:date, alteration_scope*:description, fitting_notes:description | customer -> lead; item -> catalog_item; specification -> customer_specifications; assignee -> team_member |
| process_runs / Process run notes | run_ref*:text, operation*:text, started_on*:date, ended_on:date, quantity:number, unit:text, process_notes:description | batch -> production_batches; work_package -> work_packages; operator -> team_member |
| nonconformities / Nonconformity observations | issue_ref*:text, observed_on*:date, issue*:description, severity:select(low/normal/high), correction_notes:description, reviewed_on:date | process_run -> process_runs; batch -> production_batches; work_package -> work_packages; owner -> team_member |
| service_preferences / Non-clinical service preferences | preference_ref*:text, preferences*:description, reviewed_on:date | contact* -> lead; service_item -> catalog_item |

Return recommendations are not refund authorization or proof of purchase; sales
references, refunds and inventory disposition require existing commerce workflows.
Alteration notes exclude body photographs and sensitive measurements by default.
Process runs require exactly one of batch/work_package; quantity/unit are paired
with nonnegative quantity. Nonconformities require at least one of process_run,
batch or work_package; if multiple links are supplied, they must resolve to the
same production context. End/review/due dates cannot precede their corresponding
start/observation/request dates. No MRP, machine execution, quality certification,
recall management or automatic inventory calculation is introduced.

Service preferences are contact-linked personal data, not consent, allergy history
or medical recommendations. Access/deletion review applies even for a hair salon.
Specialization extensions such as style_reference remain opt-in versioned fields.

## 10. Dependency and release review

Required category edges (prerequisite -> dependent):

```text
service_assets -> repair_intakes -> diagnostic_reports
repair_intakes -> repair_jobs -> handover_checks, warranty_cases
service_assets -> maintenance_plans, rental_handovers
site_projects -> site_diaries, work_measurements, snag_items
dispatch_briefs -> delivery_observations
growing_units -> crop_cycles -> field_observations, harvest_lots
animal_profiles -> animal_care_logs, veterinary_encounters
legal_matters -> matter_milestones
service_engagements [baseline] -> filing_checklists
job_openings -> candidate_applications
care_plans -> care_visits
grant_projects -> grant_milestones
program_plans [baseline] -> volunteer_assignments
catalog_item [existing entity] -> return_assessments
lead [existing entity] -> service_preferences
```

Conditional dependencies: choose repair_jobs or work_packages for material_requirements;
production_batches or work_packages for process_runs; at least one production
context for nonconformities. The chosen route must be present in the installation
preview and enforced at completion. Do not install every alternative by default.
The rental return's same-category relation does not introduce a category install
cycle; its data-level direction and self-reference rules still need validation.

All extension templates remain blocked on the shared install/version/provenance
contract. Presently implemented scalar and relation guards are not evidence that
these new cross-record, conditional or domain-specific rules exist. In particular:

1. Review mandatory fields, exact bounds, reference uniqueness per site/category,
   archive/delete behavior and correction history with domain owners.
2. Validate full requiredness for non-drafts, conditional dependencies, explicit
   units, date order and related-record consistency on all authorized write paths.
3. Test cross-site/category denial, inaccessible targets, concurrent target changes,
   archived upstream records, install retries/rollback, and legacy schema conflicts.
4. Verify assignment/location restrictions, file/AI/search/export admission and
   retention before recommending any restricted operational or personal-data pack.
5. Keep clinical, veterinary, care, candidate, legal, financial and member information
   behind explicit gates; generic descriptions are not a way around them.
6. Install empty collections only. No fake business data, automatic CRM contacts,
   module mutations, inferred approvals or unsupported external fetches.

Runtime acceptance requires implementation-specific Jest coverage and an explicitly
approved disposable database/browser target. This documentation change authorizes
no migrations, remote data access, automatic installation, or deployment.