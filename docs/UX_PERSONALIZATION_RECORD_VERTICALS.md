# Record templates: verticals, specializations, and operational packs

**Status:** Proposed catalog expansion; no onboarding, registry, or runtime changes.
**Parent:** [Record schema catalog](UX_PERSONALIZATION_RECORD_TEMPLATES.md).
**Schemas:** [40 additional template definitions](UX_PERSONALIZATION_RECORD_EXTENSIONS.md).
**Baseline:** [29 business leaves](UX_PERSONALIZATION_BUSINESS_CATALOG.md).

## 1. Coverage review and selection model

The baseline's 52 templates cover broad business models, not enough real-world
specializations. Repair shops were flattened into `services.field`; construction,
agriculture, logistics, animal care, recruitment, and care services had no explicit
operational packs. Legal, accounting, salons, and manufacturing also need more than
different labels on generic notes. This expansion adds 40 reusable definitions,
bringing the proposed schema inventory to **92**, without cloning a schema for
every trade or claiming that all of them are ready to install.

Keep these concepts distinct:

1. **Industry:** the 12 existing onboarding values; unchanged by this proposal.
2. **Business leaf:** one of the 29 baseline UX mappings; retained for compatibility.
3. **Specialization:** one of 163 proposed stable IDs below, selected explicitly by the user.
4. **Pack:** selected reusable templates plus reviewed, versioned field extensions.

The parent leaf in each table is a compatibility mapping, not a claim that an auto
shop and a cleaning company have the same needs. Construction, logistics, agriculture,
animal services, recruitment, and care are first-class discovery families here even
where the baseline fallback is broad. Promoting them to onboarding industries or
new UX leaves requires a separate taxonomy and navigation decision.

Each comma-separated suffix below is a distinct proposed specialization ID joined
to its family with a dot: `repair.auto_mechanical`, for example. These IDs are not
installed template IDs, routes, database tables, or new permissions. Reuse schemas
by ID across all selections. Labels and search synonyms do not create more IDs.

Ask, in order: "What kind of business do you run?", "What work do you need to
track?", and "Do you handle restricted information?" Show a short recommended
starter and optional add-ons, not all 92 collections. A business may explicitly
combine packs, such as auto repair + spare-parts retail, or veterinary + pet retail.
Skipping specialization preserves the baseline/general path; never infer it from
customer data or change the site's industry silently.

## 2. Repair shops and technical trades

### 2.1 Reusable repair pack

**Parent leaf:** `services.field`. **Starter:** `service_assets`, `repair_intakes`,
`repair_jobs`. **Optional:** `diagnostic_reports`, `material_requirements`,
`handover_checks`, `warranty_cases`, `maintenance_plans`, `equipment_checks`.
Required upstream categories are included in the installation preview. This starter
applies to the `repair` family; `trades` rows specify their own recommendations.

| Family | Specialization suffixes | Work-specific distinction / proposed field extension |
| --- | --- | --- |
| repair | auto_mechanical | Vehicle reference; optional `odometer_value:number`, `odometer_unit:select(km/mi)` on intake; engine and mechanical symptoms in diagnosis |
| repair | auto_electrical | Electrical symptom and diagnostic method; no immobilizer codes, credentials, or remote vehicle access |
| repair | body_paint | Optional `affected_area:text`, `finish_reference:text` on repair job; damage inspection and finish checks, not insurance settlement |
| repair | tires_alignment | Optional `wheel_position:text`, `tire_specification:text` on repair job; measurements need explicit units and approved limits |
| repair | motorcycle, bicycle | Asset model and frame reference when necessary; no assumed car-specific odometer or VIN requirement |
| repair | diesel_heavy, agricultural_machinery | Optional `operating_hours:number` on intake; heavy equipment servicing, no certified roadworthiness |
| repair | electronics_mobile, computers | Optional `accessories_received:description` on intake; exclude passwords, unlock PINs, device contents, and customer backups |
| repair | home_appliances | Appliance model, failure description, workshop vs on-site intake; no inferred warranty entitlement |
| repair | industrial_machinery | Failure and preventive maintenance observations; no machine control, telemetry, or safety release |
| repair | furniture_restoration, upholstery | Optional `material_reference:text`, `finish_reference:text` on repair job; approved scope and handover condition |
| repair | jewelry_watches, musical_instruments | Minimal asset identifier and custody condition; no valuation certificate or insurance coverage |
| trades | hvac_refrigeration | `maintenance_requests`, `service_assets`, `maintenance_plans`, `repair_intakes`, `repair_jobs`; no refrigerant handling certification |
| trades | electrical, plumbing, solar_installation | `maintenance_requests`, `work_packages`, `equipment_checks`; add repair pack only when servicing identified assets |
| trades | locksmith, security_installation | `maintenance_requests`, `work_packages`, `equipment_checks`; add repair pack only for identified-asset repairs; no access codes, key patterns, or alarm credentials |
| trades | carpentry, metalwork, glass_aluminum | `customer_specifications`, `work_packages`, `quality_checks`; add `material_requirements` with a work-package link, not a duplicate repair job |

These field extensions are optional versioned schema proposals, not dynamic fields
generated from a specialization label. Retain one installed schema per template;
merge only explicitly approved compatible fields and show conflicts before upgrades.
Numeric meter values are nonnegative; odometer value/unit must be paired and
`operating_hours` has the fixed unit hours. Do not
assume worldwide VIN formats, plate formats, mileage thresholds, or warranty periods.

### 2.2 Workshop journey and boundaries

1. **Receive:** select/create an authorized asset record and log intake condition,
   symptoms, accessories, and an existing CRM contact only if applicable.
2. **Diagnose:** record observations and proposed work against that intake.
3. **Quote and obtain approval:** use existing authorized commercial workflows.
   A quoted amount or `approved` note in Records is not customer authorization.
4. **Perform work:** create repair jobs, optionally reference diagnosis, and record
   planned materials; actual purchases, stock consumption, labor billing, and
   payments remain in their existing modules.
5. **Inspect and hand over:** record checks and a dated condition summary. This
   does not create a legal signature, close a sales order, or release payment.
6. **Follow up:** relate a warranty case to the original job or schedule a reviewed
   maintenance plan. Neither creates automatic warranty eligibility or reminders.

One intake can have several diagnoses/jobs, and one asset can return many times.
Do not overwrite past intake observations with a current asset condition. Staff
attribution is not technician authorization, dispatch, or immutable audit evidence.

## 3. Construction, facilities, transport, and rental

Each recommendation is a menu. Resolve required dependencies from the schema
catalog and include them before presenting an installable selection.

| Family | Specialization suffixes | Baseline parent | Recommended templates / meaningful workflow |
| --- | --- | --- | --- |
| construction | general_contractor, residential_remodeling, commercial_fitout | manufacturing.custom | site_projects, site_diaries, work_measurements, snag_items, customer_specifications, work_packages; site -> progress -> defects |
| construction | civil_works, specialist_subcontractor | manufacturing.custom | site_projects, site_diaries, work_measurements, material_requirements, compliance_evidence; progress is not certified billing |
| property | condominium_management, commercial_facilities, vacation_rental_management | real_estate.management | property_references, property_inspections, maintenance_requests, cleaning_visits; no tenancy or access-control engine |
| facilities | residential_cleaning, commercial_cleaning, industrial_cleaning | services.field | cleaning_visits, store_checklists, maintenance_requests; recurring-service evidence, not staff dispatch |
| facilities | pest_control, landscaping, pool_maintenance | services.field | pest_service_logs for pest control; cleaning_visits for pool routines; work_packages and equipment_checks for all; no pesticide or water-safety certification |
| logistics | courier_last_mile, freight_road, moving_services | other.b2b_supplier | dispatch_briefs, delivery_observations, service_assets; planned load -> delivery observations, not carrier tracking |
| logistics | warehousing_fulfillment, cold_chain | other.b2b_supplier | storage_checks, dispatch_briefs, delivery_observations, compliance_evidence; observations do not move inventory or certify temperature compliance |
| rental | tools_equipment, vehicles, event_equipment | retail.store | service_assets, rental_handovers, equipment_checks, maintenance_plans; handover/return condition, not live availability or deposits |

## 4. Agriculture, animal services, and environmental operations

| Family | Specialization suffixes | Baseline parent | Recommended templates / meaningful workflow |
| --- | --- | --- | --- |
| agriculture | field_crops, greenhouse, orchard, nursery | other.b2b_supplier | growing_units, crop_cycles, field_observations, harvest_lots; growing unit -> cycle -> observations/harvest |
| agriculture | livestock, dairy, poultry, aquaculture, beekeeping | other.b2b_supplier | animal_profiles, animal_care_logs, production_batches, equipment_checks; individual/group identity must be explicit; no disease surveillance or feed dosing |
| animal | veterinary_general, veterinary_specialist | healthcare.clinic | animal_profiles, veterinary_encounters, administrative_followups; separate animal identity from human patient_index; veterinary release gate |
| animal | grooming, boarding_daycare, training | healthcare.wellness | animal_profiles, animal_care_logs, service_protocols; pet care is not human clinical care or veterinary prescribing |
| environment | recycling_collection, waste_services, water_services | services.field | dispatch_briefs, delivery_observations, storage_checks, compliance_evidence, equipment_checks; no hazardous-waste manifest or environmental certification |

Farm and animal data can reveal owner/location information. Use minimal references;
precise land coordinates, chemical applications, animal medication, and regulated
chain-of-custody evidence require separately approved fields and domain review.

## 5. Professional, financial, and organization services

| Family | Specialization suffixes | Baseline parent | Recommended templates / meaningful workflow |
| --- | --- | --- | --- |
| professional | legal_advisory, litigation, immigration | services.consulting | legal_matters, matter_milestones, document_register; matter -> manually verified milestone; confidentiality/privilege gate |
| professional | architecture_design, engineering_consulting | services.consulting | service_engagements, deliverables, customer_specifications, site_projects; no professional sign-off or permitting |
| finance | bookkeeping, tax_practice, payroll_advisory, audit_practice | finance.advisory | service_engagements, filing_checklists, document_register, compliance_tasks; period-based evidence, not tax filing, payroll, or accounting entries |
| finance | insurance_broker, mortgage_advisory | finance.advisory | account_plans, document_register, administrative_followups; exclude underwriting, credit decisions, policy issuance and claims settlement |
| people | recruitment_agency, staffing_agency, internal_hiring | services.consulting | job_openings, candidate_applications, service_engagements; opening -> application; candidate privacy gate, no automatic ranking |
| organization | grant_funded_nonprofit, foundation, community_program | other.organization | grant_projects, grant_milestones, program_plans, review_notes; award reference -> milestone evidence, not fund accounting |
| organization | professional_association, sports_club, volunteer_network | other.organization | member_register, volunteer_assignments, program_plans, event_plans; member/volunteer privacy gates; no screening or access grants |

## 6. Health, personal services, education, and care

| Family | Specialization suffixes | Baseline parent | Recommended templates / meaningful workflow |
| --- | --- | --- | --- |
| clinical | dental, physiotherapy, mental_health, nutrition_clinical, outpatient_specialist | healthcare.clinic | Existing patient_index, medical_history, encounter_notes, follow_up_plans; domain-specific clinical content remains blocked pending specialty approval |
| wellness | hair_salon, barber, nails_lashes, nonclinical_spa | healthcare.wellness | service_preferences, service_sessions, service_protocols; optional `style_reference:text` on preferences; no diagnoses or medical history |
| wellness | fitness_studio, personal_training, nonclinical_coaching | healthcare.wellness | service_sessions, service_protocols, equipment_checks; health assessments are not a non-clinical extension |
| personal | tattoo_piercing, aesthetic_medical | healthcare.wellness | service_protocols, equipment_checks for operations only; invasive-procedure, consent and treatment schemas require separate sensitive/regulatory approval |
| care | home_support, elder_support, disability_support | services.field | care_plans, care_visits; restricted identity, safeguarding and assignment gate; no medication administration or emergency monitoring |
| education | preschool, primary_secondary, higher_education, vocational_school | education.school | Existing academic_courses, groups, student_profiles, enrollments, grades, attendance; children/special-needs data require additional review |
| education | language_center, tutoring, driving_school, arts_music_school, corporate_training | education.course_business | cohorts, session_plans, feedback_register; academic pack only by explicit need and approval; no licensing or certificate issuance |

Do not duplicate generic clinical templates into nominally complete dental charts,
therapy records, or laboratory results. Those need approved specialty schemas,
identity, instruments/scales, amendment rules, and professional authorization. A
visible specialization can recommend safe operational templates while clearly
marking the clinical pack unavailable; it must not hide restrictions in free text.

## 7. Retail, manufacturing, food, hospitality, and creative businesses

| Family | Specialization suffixes | Baseline parent | Recommended templates / meaningful workflow |
| --- | --- | --- | --- |
| retail | apparel, footwear, jewelry, furniture_home | retail.store | customer_requests, return_assessments, product_content; add alteration_jobs for tailoring/fitting and customer_specifications when needed |
| retail | hardware, auto_parts, electronics, pet_supplies | retail.store | customer_requests, product_content, return_assessments; optional repair pack for actual after-sales service |
| retail | grocery, specialty_food, pharmacy_medical_supply | retail.store | store_checklists, compliance_evidence, return_assessments; no dispensing, cold-chain certification, or controlled-product authorization |
| commerce | direct_to_consumer, marketplace_seller | retail.ecommerce | product_content, customer_requests, return_assessments; no platform settlement |
| commerce | b2b_distribution | retail.wholesale | account_plans, customer_requests, compliance_evidence, return_assessments; no platform settlement |
| manufacturing | textile_apparel, furniture_wood, metal_fabrication, plastics_packaging, electronics_assembly | manufacturing.production | production_batches, process_runs, nonconformities, quality_checks; optional customer_specifications/work_packages for custom production |
| manufacturing | printing_signage, custom_fabrication | manufacturing.custom | customer_specifications, work_packages, material_requirements, nonconformities; specification -> production work -> quality issue |
| food | restaurant, cafe, bar, bakery_pastry, catering, cloud_kitchen | food.restaurant | recipe_reference, food_safety_checks, store_checklists; catering adds event_plans/event_checklists; no allergen assurance or regulatory sign-off |
| food | packaged_food, beverage_production, meat_dairy_processing | food.production | production_batches, process_runs, food_safety_checks, nonconformities, compliance_evidence; no validated recall/traceability engine |
| hospitality | hotel_hostel, bed_breakfast, campground | travel.lodging | housekeeping_checks, cleaning_visits, equipment_checks, customer_requests; no guest identity/passport registry or room allocation |
| travel | tour_operator, travel_agency, adventure_operator | travel.tours | itinerary_plans, departure_checklists, supplier_briefs; no ticketing, passenger manifest, or safety accreditation |
| creative | marketing_agency, seo_performance_agency, branding_design | services.agency | editorial_briefs, production_briefs, deliverables, account_plans, review_notes; retain priority Marketing Agency alias |
| creative | photography, video_production, podcast_studio | entertainment.studio | production_briefs, deliverables, document_register; private media/release evidence needs approved handling |
| creative | independent_creator, educator_creator, streamer | entertainment.creator | editorial_briefs, sponsorship_briefs, production_briefs, deliverables; retain priority Content Creator alias |
| events | wedding_planner, corporate_events, venue_operations, live_production | entertainment.events | event_plans, event_checklists, supplier_briefs; rental equipment may add rental_handovers with dependencies |
| technology | saas | technology.saas | client_onboarding, support_cases, release_notes; no provisioning or automatic deployment |
| technology | managed_it, software_implementation, cybersecurity_consulting | technology.software_services | service_engagements, support_cases, deliverables; exclude secrets and exploit evidence |

## 8. Discovery, rollout, and measurable usefulness

- Gallery filtering should support specialization, tracked object (asset, job,
  site, cohort, matter), work stage, data sensitivity, and dependency count. Search
  aliases such as workshop/garage/auto repair resolve to reviewed IDs, not new schemas.
- Each pack preview explains "what you can track", core fields, required collections,
  optional add-ons, existing module handoffs, unavailable capabilities, and privacy.
- A small shop should be able to start with the three repair collections; a workshop
  chain may add diagnostics and maintenance without reinstalling assets per branch.
  Multi-location sharing remains blocked where access policies cannot enforce it.
- First candidate wave: repair, non-regulated trades, cleaning, rental condition,
  and generic custom-production records after core installation/access gates.
  Next: construction, logistics, agriculture and sector-specific domain validation.
  Restricted clinical, veterinary, care, legal, hiring, academic, member and financial
  data require their separate approvals regardless of business priority.
- Proposed usefulness measures: first completed workflow, optional-pack adoption,
  missing-field feedback, duplicate-collection rate, and intake-to-handover elapsed
  days. These are evaluation goals, not existing dashboards or a promise of ROI.

## 9. Acceptance checklist

1. Every specialization resolves to an existing baseline parent and defined template
   IDs; required dependency closure is complete and shared schemas deduplicate.
2. Workshop, furniture fabrication, school, veterinary, hiring, and hybrid retail +
   repair selections produce different useful starters, not renamed generic notes.
3. Validate optional specialization fields, key conflicts and schema upgrade plans;
   preserve local fields and do not tighten existing categories silently.
4. Test rejected cross-site/category links and cross-record contradictions described
   in the extension catalog. Optional fields must not install unwanted dependencies.
5. Preview and personal selection never create records, permissions or collections.
   Only an authorized, explicitly confirmed installation may create empty categories.
6. Show blocked packs and reasons honestly; no free-text workaround for restricted
   information. Do not claim onboarding/gallery support from this documentation.

This is a broader, extensible coverage proposal, not an exhaustive worldwide
industry classification. New specializations should reuse a schema unless they
introduce a distinct entity, meaningful relation, lifecycle, or access requirement.