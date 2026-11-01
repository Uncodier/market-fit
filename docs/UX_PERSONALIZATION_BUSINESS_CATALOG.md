# UX personalization: complete business decision catalog

**Status:** Proposed executable product specification, not implemented behavior.
**Date:** 2026-10-31.
**Plan:** [Main design](UX_PERSONALIZATION_DESIGN.md) ·
[Template lifecycle](UX_PERSONALIZATION_TEMPLATES_AND_DECISIONS.md) ·
[Shared execution rules](UX_PERSONALIZATION_EXECUTION_RULES.md).

## 1. What “complete” means

This catalog covers every value in the current [industry taxonomy](../app/components/onboarding/constants/onboarding-constants.ts):
technology, healthcare, finance, education, retail, manufacturing, entertainment,
food, travel, real_estate, professional_services, and other. It defines **29 business
leaves**, including B2B suppliers and general use. Each leaf defines questions,
templates, modules, shortcuts, CTA vocabulary, helper copy, and functional roles.
The shared rules cover every role, need, size, mode, and operational state.

This is exhaustive for the proposed launch taxonomy, not a claim to enumerate
every possible real-world industry. Unsupported specializations use the explicit
general path; never leave an “implementation decides” branch or guess a capability.
All leaves are specified now; sensitive and unsupported features retain release
gates. Staged implementation is not permission to omit a leaf from the registry.

Notation: `M(key)` = existing module destination; `C(template)` = installed Records
collection; `V(template, view)` = validated saved view; `*` = proposed required field.
Registry tokens and field constraints are proposals requiring implementation.
Template names below are display labels; IDs/storage keys never translate.
Icons are semantic families mapped to approved existing icons/emoji, not new imports.

## 2. Complete business selection tree

Before industry drill-down, offer **Marketing Agency** (`marketing_agency` ->
`services.agency`) and **Content Creator** (`content_creator` -> `entertainment.creator`)
as first-class priority ICP choices. These aliases retain 29 canonical leaves and
preserve industry facts. [Dedicated setup and UX contract](UX_PERSONALIZATION_AGENCY_AND_CREATOR_MODES.md).

```text
Industry + "What do you mainly do?" (explicit choice; retain industry as a fact)
|-- technology
|   |-- Sell subscription software -> technology.saas
|   `-- Build/implement software for clients -> technology.software_services
|-- healthcare
|   |-- Deliver clinical care -> healthcare.clinic [sensitive clinical gate]
|   |-- Non-clinical wellness/beauty/fitness services -> healthcare.wellness
|   `-- Sell/distribute healthcare supplies -> healthcare.supplier
|-- finance
|   |-- Advisory/accounting services -> finance.advisory [financial privacy gate]
|   `-- Internal financial operations -> finance.operations [no banking engine]
|-- education
|   |-- School/academic administration -> education.school [academic privacy gate]
|   `-- Sell courses/workshops/coaching -> education.course_business
|-- retail
|   |-- Primarily in-store sales -> retail.store
|   |-- Primarily online sales -> retail.ecommerce
|   `-- Bulk/distributor sales -> retail.wholesale
|-- manufacturing
|   |-- Repeat production -> manufacturing.production
|   `-- Made-to-order production -> manufacturing.custom
|-- entertainment
|   |-- Organize events -> entertainment.events
|   |-- Create/publish content -> entertainment.creator
|   `-- Produce media for clients -> entertainment.studio
|-- food
|   |-- Prepared food service -> food.restaurant
|   `-- Produce/distribute packaged food -> food.production
|-- travel
|   |-- Lodging/hospitality operations -> travel.lodging
|   `-- Tours/travel services -> travel.tours
|-- real_estate
|   |-- Brokerage/property sales -> real_estate.brokerage
|   `-- Manage properties -> real_estate.management
|-- professional_services
|   |-- Consulting/legal/design advice -> services.consulting
|   |-- Marketing/creative agency -> services.agency
|   `-- Repair/maintenance/field service -> services.field
`-- other
    |-- B2B supplier or buyer organization -> other.b2b_supplier
    |-- Nonprofit/member organization -> other.organization
    `-- Mixed/unknown/prefer not to say -> other.general
```

Users can explicitly choose another leaf regardless of industry; ask for confirmation
instead of silently rewriting the industry. A personal lens never changes this tree.
If the variant question is skipped, choose `other.general`, retain supplied facts,
and apply selected needs. “Hybrid” combines approved needs, not two competing presets.

## 3. Technology

### technology.saas — subscription software
- Ask: subscriptions, one-time licenses, or both? Need onboarding, support, releases?
- Tree: subscriptions -> M(subscriptions); onboarding -> C(client_onboarding);
  support -> M(chat)+C(support_cases); releases -> C(release_notes).
- Templates: `client_onboarding`, `support_cases`, `release_notes` selected by need.
- Primary modules: catalog, subscriptions, leads, chat, records; secondary: deals,
  quotations, controlCenter, reportOverview. Label catalog “Software plans”.
- Shortcuts: M(subscriptions), C(client_onboarding), C(support_cases), C(release_notes).
- CTA/copy: “Add software plan”; “Add onboarding checklist”; “Add support case”.
  Helper: “Track onboarding and support alongside your configured software plans.”
- Roles: owner, sales, support, product, developer; icon family: software/checklist.
- Boundary: Records cannot provision software licenses, deploy releases or run SLAs.

### technology.software_services — client software projects
- Ask: implementation projects, ongoing maintenance, or both? Commercial quotes?
- Tree: projects -> C(service_engagements)+C(deliverables); maintenance -> C(support_cases);
  quotes -> M(deals)+M(quotations). No project-management module is invented.
- Templates: `service_engagements`, `deliverables`, `support_cases`.
- Primary: records, controlCenter, deals, quotations, chat; secondary: catalog, sales.
- Shortcuts: C(service_engagements), V(deliverables,my_work), M(quotations).
- CTA/copy: “Add implementation engagement”; “Add deliverable”. Helper:
  “Link client work and deliverables to the authorized commercial context.”
- Roles: owner, product, developer, operations, sales; icon family: code/checklist.

## 4. Healthcare

### healthcare.clinic — clinical care
- Ask: appointments, clinical records, billing, or supplies? Clinical data jurisdiction?
- Tree: appointments -> M(reservations); protocols -> C(service_protocols);
  clinical -> patient_index -> medical_history/encounter_notes -> follow_up_plans,
  only after every clinical privacy/access/AI gate passes; billing -> existing finance.
- Templates: `service_protocols`, `administrative_followups`; sensitive:
  `patient_index`, `medical_history`, `encounter_notes`, `follow_up_plans`.
- Primary: reservations, records, chat; secondary: catalog, sales, suppliers, inventory.
- Shortcuts: M(reservations), C(service_protocols); authorized clinical collections only.
- CTA/copy: “Add service protocol”; gated “Add encounter note”. Helper:
  “Use approved operational references. Clinical information requires separate safeguards.”
- Roles: clinician, reception, operations, finance, owner; icon family: care/calendar.
- Full schemas/access gates: [clinical pack](UX_PERSONALIZATION_TEMPLATES_AND_DECISIONS.md#4-clinic-packs-operations-versus-clinical-information).

### healthcare.wellness — non-clinical wellness, salon, fitness
- Ask: individual appointments, classes, memberships, products? Any clinical treatment?
- Tree: individual/classes -> M(reservations); recurring membership -> M(subscriptions);
  non-sensitive service notes -> C(service_sessions); clinical answers -> clinic review.
- Templates: `service_sessions`, `service_protocols`, `equipment_checks`.
- Primary: reservations, catalog, leads, subscriptions; secondary: pos, records, promotions.
- Shortcuts: M(reservations), C(service_sessions), M(subscriptions).
- CTA/copy: “Add wellness service”; “Add service session”. Helper:
  “Organize non-clinical sessions and approved service guidance; exclude medical history.”
- Roles: practitioner, reception, cashier, operations, owner; icon family: calendar/care.
- Boundary: health questionnaires/treatment notes are not a safe general-template fallback.

### healthcare.supplier — medical supplies
- Ask: bulk quotes, stock, deliveries, tender participation? Regulated product evidence?
- Tree: quote/stock/delivery -> commercial modules; evidence -> C(compliance_evidence);
  sales follow-up -> C(account_plans); patient data -> reject this pack.
- Templates: `compliance_evidence`, `account_plans`, `quality_checks`.
- Primary: catalog, priceLists, quotations, inventory, orders, shipments;
  secondary: suppliers, purchaseRequests, records. “Medical supplies” is catalog context.
- Shortcuts: M(quotations), M(inventory), C(compliance_evidence).
- CTA/copy: “Add supply item”; “Add compliance evidence reference”. Helper:
  “Track supplies and evidence references without entering patient information.”
- Roles: sales, warehouse, purchasing, quality, owner; icon family: package/shield.
- Boundary: no certification verification or drug traceability is implied by a Record.

## 5. Finance

### finance.advisory — accounting/advisory services
- Ask: client engagements, recurring services, compliance deadlines? Sensitive client data?
- Tree: engagements -> C(service_engagements); deadlines -> C(compliance_tasks);
  recurring services -> M(subscriptions); financial identity -> privacy gate.
- Templates: `service_engagements`, `compliance_tasks`, `document_register`.
- Primary: records, controlCenter, leads, quotations; secondary: subscriptions, sales, chat.
- Shortcuts: C(service_engagements), V(compliance_tasks,due), M(quotations).
- CTA/copy: “Add advisory engagement”; “Add compliance task”. Helper:
  “Organize client work and deadlines; store confidential evidence only in approved scopes.”
- Roles: advisor, finance, operations, sales, owner; icon family: briefcase/checklist.
- Boundary: no automated tax filing, financial advice, KYC/AML, or compliance certification.

### finance.operations — internal financial administration
- Ask: receivables, payables, expenses, review notes, procurement approvals?
- Tree: money workflows -> existing finance/buying modules; review -> C(review_notes);
  document tracking -> C(document_register). Never mirror balances in editable Records.
- Templates: `review_notes`, `document_register`, `compliance_tasks`.
- Primary: accountsReceivable, bills, transactions, payments, financeReports; secondary: records,
  procurementApprovals, journalEntries, chartOfAccounts, reportCosts.
- Shortcuts: M(accountsReceivable), M(bills), V(compliance_tasks,due).
- CTA/copy: “Add financial review note”; module actions keep canonical financial labels.
  Helper: “Use financial modules for transactions; Records holds review context, not balances.”
- Roles: finance, approver, purchasing, owner; icon family: ledger/checklist.
- Boundary: not banking, portfolio management, accounting certification or ledger replacement.

## 6. Education

### education.school — school/academic administration
- Ask: courses/groups, enrollment, grades, attendance? Assigned teachers and privacy scope?
- Tree: academic_courses -> groups; student_profiles+groups -> enrollments;
  enrollments -> grades/attendance under academic privacy gates.
- Templates: `academic_courses`, `groups`, `student_profiles`, `enrollments`, `grades`, `attendance`.
- Primary: records, controlCenter; secondary: reservations, catalog, sales, accountsReceivable,
  chat according to selected needs. Keep fees separate from academic assessment.
- Shortcuts: C(academic_courses), C(groups), C(enrollments), C(grades), C(attendance), by role.
- CTA/copy: “Add academic course”; “Add grade”; “Record attendance”. Helper:
  “Create academic structure first, then record permitted enrollments and assessments.”
- Roles: teacher, academic_admin, reception, finance, owner; icon family: education/book.
- Full schema/dependencies: [school pack](UX_PERSONALIZATION_TEMPLATES_AND_DECISIONS.md#3-school-pack-proposed-definitions).

### education.course_business — courses, workshops, coaching
- Ask: recorded courses, scheduled workshops, coaching, or combinations? Cohort planning?
- Tree: sell learning content -> M(catalog); scheduled service -> M(reservations);
  cohorts -> C(cohorts)+C(session_plans); feedback -> C(feedback_register).
- Templates: `cohorts`, `session_plans`, `feedback_register`; academic grades require school gates.
- Primary: catalog, reservations, leads, sales; secondary: subscriptions, records, content.
- Shortcuts: M(catalog), C(cohorts), C(session_plans).
- CTA/copy: “Add course offering”; “Add session plan”. Helper:
  “Separate the sellable course from cohort and session planning records.”
- Roles: instructor, content_creator, sales, reception, owner; icon family: education/calendar.
- Boundary: cohort records are not automatic learner enrollment or certified completion.

## 7. Retail

### retail.store — physical retail
- Ask: counter sales, inventory, multiple stores, customer follow-up?
- Tree: counter -> M(pos); stock -> M(inventory); store routines -> C(store_checklists);
  customer requests -> C(customer_requests); product sales stay in Catalog/Orders.
- Templates: `store_checklists`, `customer_requests`, `equipment_checks`.
- Primary: pos, catalog, inventory, orders; secondary: sales, promotions, suppliers, records.
- Shortcuts: M(pos), M(inventory), C(store_checklists).
- CTA/copy: “Add product”; “Add store checklist”. Helper:
  “Manage sellable products and stock in their modules; use checklists for store routines.”
- Roles: cashier, store_manager, warehouse, purchasing, owner; icon family: store/package.

### retail.ecommerce — online retail
- Ask: shipping, pickup, product content, returns follow-up?
- Tree: shipping -> M(orders)+M(shipments); content -> C(product_content);
  after-sale requests -> C(customer_requests), not an automatic refund engine.
- Templates: `product_content`, `customer_requests`, `quality_checks`.
- Primary: catalog, orders, shipments, inventory; secondary: promotions, chat, content, records.
- Shortcuts: M(orders), M(shipments), C(product_content).
- CTA/copy: “Add product”; “Add product content brief”; “Add customer request”.
  Helper: “Prepare product information and follow-up context; fulfill and refund through authorized modules.”
- Roles: ecommerce_manager, warehouse, support, marketing, owner; icon family: cart/package.

### retail.wholesale — wholesale/distribution
- Ask: price lists, quotes, bulk orders, deliveries, repeat accounts?
- Tree: commercial terms -> M(priceLists)+M(quotations); accounts -> C(account_plans);
  supplier evidence -> C(compliance_evidence); delivery -> M(shipments).
- Templates: `account_plans`, `compliance_evidence`, `customer_requests`.
- Primary: catalog, priceLists, quotations, orders, inventory, shipments;
  secondary: deals, suppliers, purchaseRequests, records.
- Shortcuts: M(quotations), M(priceLists), C(account_plans).
- CTA/copy: “Add wholesale item”; “Add account plan”. Helper:
  “Use server-owned price lists and quotations for commercial terms; track account context here.”
- Roles: sales, warehouse, purchasing, finance, owner; icon family: package/briefcase.

## 8. Manufacturing

### manufacturing.production — repeat production
- Ask: batches, quality checks, maintenance, stock/replenishment?
- Tree: batches -> C(production_batches); quality -> C(quality_checks) referencing batches;
  equipment -> C(equipment_checks); stock/buying -> canonical inventory/procurement.
- Templates: `production_batches`, `quality_checks`, `equipment_checks`, `compliance_evidence`.
- Primary: records, inventory, suppliers, purchaseRequests, orders;
  secondary: inventoryMinimums, controlCenter, bills.
- Shortcuts: C(production_batches), C(quality_checks), M(inventory).
- CTA/copy: “Add production batch record”; “Add quality check”. Helper:
  “Record production context and reviewed checks; inventory changes use the inventory workflow.”
- Roles: production, quality, warehouse, purchasing, owner; icon family: factory/checklist.
- Boundary: no BOM, MRP, automatic consumption, production scheduling or stock posting.

### manufacturing.custom — made-to-order work
- Ask: customer specification, quotation, work tracking, delivery checks?
- Tree: specification -> C(customer_specifications); approved work -> C(work_packages);
  checks -> C(quality_checks); quote/order fulfillment remains canonical.
- Templates: `customer_specifications`, `work_packages`, `quality_checks`.
- Primary: quotations, deals, records, orders, inventory;
  secondary: controlCenter, suppliers, purchaseRequests, shipments.
- Shortcuts: M(quotations), C(customer_specifications), C(work_packages).
- CTA/copy: “Add customer specification”; “Add work package”. Helper:
  “Link specifications and work context without treating a Record as an approved production order.”
- Roles: sales, production, quality, operations, owner; icon family: factory/tools.

## 9. Entertainment

### entertainment.events — event organization
- Ask: planning, suppliers, scheduled booking, commercial tickets/services?
- Tree: planning -> C(event_plans); operational tasks -> C(event_checklists);
  bookable services -> M(reservations); sellable offerings -> M(catalog).
- Templates: `event_plans`, `event_checklists`, `supplier_briefs`.
- Primary: records, controlCenter, reservations, catalog; secondary: promotions, content, purchasesOrders.
- Shortcuts: C(event_plans), C(event_checklists), M(reservations).
- CTA/copy: “Add event plan”; “Add event checklist”. Helper:
  “Coordinate event plans and suppliers; supported bookings and sales stay in their modules.”
- Roles: event_coordinator, operations, marketing, purchasing, owner; icon family: event/calendar.
- Boundary: no ticket entitlement, venue-capacity, attendee portal or access-control promise.

### entertainment.creator — independent content creator
- First-class Content Creator usage mode; use its dedicated setup contract, not industry inference.
- Ask: content planning, sponsorships, digital sales, publishing destinations?
- Tree: planning -> C(editorial_briefs); sponsorship -> C(sponsorship_briefs)+M(deals);
  publishing -> M(contentCreator)+M(content); digital sales -> M(catalog).
- Templates: `editorial_briefs`, `production_briefs`, `sponsorship_briefs`, `deliverables`, `review_notes`.
- Primary: contentCreator, content, assets, records; secondary: campaigns, deals, catalog, sales.
- Shortcuts: M(contentCreator), C(editorial_briefs), C(sponsorship_briefs).
- CTA/copy: “Add editorial brief”; “Add sponsorship brief”. Helper:
  “Plan content and commitments; publishing requires configured destinations and explicit actions.”
- Roles: content_creator, marketing, sales, owner; icon family: media/pencil.

### entertainment.studio — client media production
- Ask: briefs, shoots/sessions, delivery, licensing references?
- Tree: client brief -> C(production_briefs); work -> C(deliverables);
  sessions -> M(reservations) if supported; evidence -> C(document_register).
- Templates: `production_briefs`, `deliverables`, `document_register`.
- Primary: records, assets, controlCenter, quotations; secondary: reservations, contentCreator, sales.
- Shortcuts: C(production_briefs), V(deliverables,my_work), M(assets).
- CTA/copy: “Add production brief”; “Add deliverable”. Helper:
  “Track production scope and delivery context without implying publication or rights verification.”
- Roles: content_creator, designer, operations, sales, owner; icon family: media/checklist.

## 10. Food and beverage

### food.restaurant — restaurant/cafe/prepared food
- Ask: counter sales, table bookings, delivery, recipes, safety routines?
- Tree: counter -> M(pos); bookings -> M(reservations); delivery -> M(orders);
  recipes -> C(recipe_reference); routines -> C(food_safety_checks)+C(store_checklists).
- Templates: `recipe_reference`, `food_safety_checks`, `store_checklists`, `supplier_briefs`.
- Primary: pos, catalog, orders, inventory; secondary: reservations, suppliers, purchaseRequests, records.
- Shortcuts: M(pos), M(orders), C(food_safety_checks); catalog label “Menu”.
- CTA/copy: “Add menu item”; “Add recipe reference”; “Record food safety check”.
  Helper: “Keep menu sales in Catalog and POS; document reviewed kitchen routines separately.”
- Roles: cashier, kitchen, store_manager, purchasing, owner; icon family: food/checklist.
- Boundary: recipe records do not decrement ingredients, certify safety or assign tables.

### food.production — packaged food production/distribution
- Ask: batches, quality evidence, distribution, commercial quotes?
- Tree: batches -> C(production_batches); recipes -> C(recipe_reference);
  food checks -> C(food_safety_checks); distribution -> M(inventory)+M(shipments).
- Templates: `production_batches`, `recipe_reference`, `food_safety_checks`, `compliance_evidence`.
- Primary: records, inventory, orders, shipments, suppliers; secondary: catalog, quotations, purchaseRequests.
- Shortcuts: C(production_batches), C(food_safety_checks), M(shipments).
- CTA/copy: “Add food batch record”; “Record food safety check”. Helper:
  “Track batch references and reviewed checks; Records does not provide regulated traceability.”
- Roles: production, quality, warehouse, purchasing, owner; icon family: food/package.

## 11. Travel and hospitality

### travel.lodging — lodging operations
- Ask: bookable services, housekeeping, maintenance, guest requests?
- Tree: supported bookings -> M(reservations); routines -> C(housekeeping_checks);
  maintenance -> C(equipment_checks); service requests -> C(customer_requests).
- Templates: `housekeeping_checks`, `equipment_checks`, `customer_requests`.
- Primary: reservations, records, controlCenter, catalog; secondary: sales, chat, inventory.
- Shortcuts: M(reservations), C(housekeeping_checks), C(customer_requests).
- CTA/copy: “Add housekeeping check”; “Add guest service request”. Helper:
  “Coordinate operational routines; use supported reservation capabilities for bookings.”
- Roles: reception, housekeeping, operations, finance, owner; icon family: lodging/calendar.
- Boundary: no room-night engine, occupancy inventory, channel manager or passport collection.

### travel.tours — tours/travel services
- Ask: itinerary planning, departure coordination, service bookings, suppliers?
- Tree: itineraries -> C(itinerary_plans); departures -> C(departure_checklists);
  services -> M(catalog)+M(reservations); suppliers -> C(supplier_briefs).
- Templates: `itinerary_plans`, `departure_checklists`, `supplier_briefs`.
- Primary: catalog, reservations, records, quotations; secondary: leads, sales, purchasesOrders.
- Shortcuts: C(itinerary_plans), C(departure_checklists), M(reservations).
- CTA/copy: “Add itinerary plan”; “Add departure checklist”. Helper:
  “Prepare travel-service plans; confirm bookings through configured supported workflows.”
- Roles: guide, reception, sales, operations, owner; icon family: travel/map.
- Boundary: no flight ticketing, traveler health/passport storage or automatic capacity planning.

## 12. Real estate

### real_estate.brokerage — property brokerage
- Ask: property references, prospect pipeline, viewings, document coordination?
- Tree: properties -> C(property_references); viewings -> C(viewing_notes);
  deals -> M(deals)+M(quotations); documents -> C(document_register).
- Templates: `property_references`, `viewing_notes`, `document_register`.
- Primary: records, leads, deals, quotations; secondary: reservations, chat, content.
- Shortcuts: C(property_references), C(viewing_notes), M(deals).
- CTA/copy: “Add property reference”; “Add viewing note”. Helper:
  “Link property context to authorized prospects without treating Records as a legal transaction.”
- Roles: agent, sales, operations, owner; icon family: property/map.
- Boundary: property references are not marketplace listings, escrow, deeds or valuation advice.

### real_estate.management — property management
- Ask: managed properties, maintenance, inspections, contract reminders?
- Tree: property_references -> C(maintenance_requests)+C(property_inspections);
  document dates -> C(document_register); actual rent collection -> existing finance.
- Templates: `property_references`, `maintenance_requests`, `property_inspections`, `document_register`.
- Primary: records, controlCenter, accountsReceivable; secondary: suppliers, purchasesOrders, chat.
- Shortcuts: C(maintenance_requests), C(property_inspections), M(accountsReceivable).
- CTA/copy: “Add maintenance request”; “Add property inspection”. Helper:
  “Track property work and document references; tenancy and payment rules are not changed by templates.”
- Roles: property_manager, field_technician, purchasing, finance, owner; icon family: property/tools.
- Boundary: tenancy identity documents and legal agreements need approved private storage/access.

## 13. Professional services

### services.consulting — consulting/legal/design advice
- Ask: engagements, deliverables, ongoing services, confidential case material?
- Tree: engagement -> C(service_engagements)+C(deliverables);
  documents -> C(document_register) under approved privacy; sales -> M(quotations).
- Templates: `service_engagements`, `deliverables`, `document_register`.
- Primary: records, quotations, deals, controlCenter; secondary: catalog, subscriptions, sales.
- Shortcuts: C(service_engagements), V(deliverables,my_work), M(quotations).
- CTA/copy: “Add client engagement”; “Add deliverable”. Helper:
  “Organize engagement scope and delivery; confidential evidence requires approved handling.”
- Roles: advisor, designer, operations, sales, owner; icon family: briefcase/checklist.
- Boundary: no court filing, legally signed contracts or time-billing engine.

### services.agency — marketing/creative agency
- First-class Marketing Agency usage mode; use its dedicated client-brand setup contract.
- Ask: campaigns, content commitments, client briefs, reporting?
- Tree: campaign work -> M(campaigns); briefs -> C(editorial_briefs)+C(production_briefs);
  delivery -> C(deliverables); reports -> existing applicable report modules.
- Templates: `editorial_briefs`, `production_briefs`, `deliverables`, `account_plans`, `review_notes`.
- Primary: campaigns, contentCreator, content, records, assets;
  secondary: segments, quotations, reportSocial, reportTraffic.
- Shortcuts: M(campaigns), C(production_briefs), V(deliverables,my_work).
- CTA/copy: “Add client creative brief”; “Add deliverable”. Helper:
  “Coordinate client briefs and campaigns; connected accounts govern actual publishing and metrics.”
- Roles: marketing, content_creator, designer, sales, owner; icon family: media/briefcase.

### services.field — repair/maintenance/field service
- Ask: service requests, site visits, equipment checks, quotations?
- Tree: requests -> C(maintenance_requests); work -> C(work_packages);
  checks -> C(equipment_checks); schedule -> M(reservations) where applicable.
- Templates: `maintenance_requests`, `work_packages`, `equipment_checks`.
- Primary: records, controlCenter, reservations, quotations; secondary: inventory, sales, suppliers.
- Shortcuts: C(maintenance_requests), V(work_packages,my_work), M(reservations).
- CTA/copy: “Add service request”; “Add work package”. Helper:
  “Record requested work and checks; scheduling and stock updates remain separate authorized actions.”
- Roles: field_technician, reception, operations, purchasing, owner; icon family: tools/calendar.
- Boundary: no automatic dispatch, GPS tracking, route optimization or certified work approval.

## 14. Other, B2B, and fallback

### other.b2b_supplier — supplier/buyer organization
- Ask: selling, buying, or both? Quotes, internal requests, tenders, supplier evidence?
- Tree: selling -> M(quotations)+M(orders); buying -> M(purchaseRequests)+M(suppliers);
  internal tender work -> M(procurementTenders); evidence -> C(compliance_evidence).
- Templates: `account_plans`, `supplier_briefs`, `compliance_evidence`, `review_notes`.
- Primary: quotations, suppliers, purchaseRequests, purchasesOrders, records;
  secondary: procurementApprovals, procurementTenders, inventory, bills as needed.
- Shortcuts: M(quotations) for sellers; M(purchaseRequests) for buyers; C(compliance_evidence).
- CTA/copy: “Add supplier brief”; “Add account plan”. Helper:
  “Keep internal procurement and selling workflows distinct; evidence references are not accepted certifications.”
- Roles: sales, purchasing, approver, warehouse, finance, owner; icon family: handshake/package.
- Boundary: supplier public-tender participation is not the internal tender management module.

### other.organization — nonprofit/member organization
- Ask: programs, members, events, voluntary contributions, reporting?
- Tree: programs -> C(program_plans); member administration -> C(member_register)
  under personal-data gate; events -> C(event_plans); money -> existing finance only.
- Templates: `program_plans`, `member_register`, `event_plans`, `review_notes`.
- Primary: records, controlCenter, chat; secondary: content, reservations, transactions, reportOverview.
- Shortcuts: C(program_plans), C(member_register), C(event_plans).
- CTA/copy: “Add program plan”; “Add member administration record”. Helper:
  “Coordinate programs and approved member information; membership records do not grant application access.”
- Roles: program_coordinator, operations, marketing, finance, owner; icon family: community/checklist.
- Boundary: no donation tax receipt, grant compliance, volunteer screening or member portal.

### other.general — mixed/unknown/general
- Ask: select daily needs; optionally describe business. No forced industry inference.
- Tree: selected need -> shared module map; documentation -> C(general_notes);
  routines -> C(store_checklists); neither -> current general navigation, no auto-install.
- Templates: `general_notes`, `store_checklists`, `review_notes`, all optional.
- Primary: records, controlCenter, then selected-need modules; Standard if mode skipped.
- Shortcuts: personal pins first; C(general_notes) if installed; no generated arbitrary URLs.
- CTA/copy: “Add record”; “Add note”. Helper:
  “Choose the tools and record templates that match your work; adjust the experience later.”
- Roles: general plus any explicitly selected functional lens; icon family: folder/checklist.
- Boundary: unknown business text does not generate schemas, external prompts or new modules.

## 15. Registry acceptance gate

Every one of the 29 leaf IDs must exist in the implementation fixture inventory.
Each fixture must resolve every template ID through the shared schema registry,
every module key through existing navigation, and every role through the functional
map. Uninstalled collections are suggestions, never live links. Full state/CTA/copy
tests use the shared rules rather than treating these 29 sections as demos only.