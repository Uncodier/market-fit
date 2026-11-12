# UX personalization: Record templates, navigation, and decision trees

**Status:** Detailed proposed extension; no runtime or schema changes implemented.
**Date:** 2026-10-31.
**Parent plan:** [Business and role-based UX personalization](UX_PERSONALIZATION_DESIGN.md).
All precedence, canonical-route, localization, licensing, and rollout rules in
the parent apply. School/clinic details below are expanded by the exhaustive
[business catalog](UX_PERSONALIZATION_BUSINESS_CATALOG.md) and
[execution rules](UX_PERSONALIZATION_EXECUTION_RULES.md), both required implementation inputs.

**Schema catalog:** [Business Record templates, fields, and relations](UX_PERSONALIZATION_RECORD_TEMPLATES.md)
owns the 52-template baseline plus 40 additional operational definitions (92 total)
and explicit relation contract. Its [vertical catalog](UX_PERSONALIZATION_RECORD_VERTICALS.md)
adds specialization and pack recommendations. This document retains installation,
privacy, navigation, and UX decision-tree ownership; expansion grants no installation approval.

## 1. Product model: packs, collections, and shortcuts

Keep four different objects explicit:

1. **Module:** existing capability, such as Records, Catalog, Reservations, Sales.
2. **Template definition:** versioned field schema and presentation metadata.
3. **Installed collection:** site-owned Record category instantiated from a template.
4. **Shortcut:** navigational reference to a module, collection, or saved view.

For a school, “Grades” is an installed Records collection, not a new `/grades`
module. “Courses” can mean an academic planning collection or a sellable Catalog
course; display them as **Academic courses** and **Course catalog** when both exist.
Do not present Records as an LMS, grade-calculation engine, or student portal.

For a clinic, an installed “Medical records” collection is not proof of compliant
electronic health records, prescribing, diagnostic support, or clinical signing.
Release clinical templates only after explicit sensitive-data approval.

Selecting “school” or “clinic” recommends a pack. A personal finance/cashier lens
changes emphasis only. It never rewrites schemas or reclassifies stored information.

## 2. Source alignment and implementation gaps

| Existing source | Verified behavior | Required extension |
| --- | --- | --- |
| [Record actions](../app/records/actions.ts) | Categories, `template_fields`, records, relations, authenticated RLS-scoped writes | Validated pack installation, provenance, field-level schemas and conflict control |
| [Template editor](../app/records/components/CategoryTemplateEditor.tsx) | Category hierarchy; dynamic field types and relation targets | Starter gallery, stable field keys, semantic labels, preview and version review |
| [Dynamic form](../app/records/[id]/components/RecordDynamicForm.tsx) | Text, description, number, date, select, boolean, location, relation, file, table | Enforced validators and safe defaults; supported-type contract tests |
| [Records page](../app/records/page.tsx) | Category/view/filter state; URL sort | Validated category/view URL contract, restored filters, category-specific title/CTA |
| [Navigation page](../app/navigation/page.tsx) | Module tiles filtered by screen access and title | Installed collection tiles, semantic aliases, search, pinning and empty/error states |
| [Shortcut types](../app/components/navigation/shortcut-types.ts) | Module/custom URL records with pin state | Typed module/category/saved-view targets and safe migration |
| [Shortcut storage](../app/components/navigation/shortcut-storage.ts) | DB `user_shortcuts` scoped to user/site; browser cache key scoped only to site | Account/site-isolated cache, verified saves, intent/provenance |
| [Embedding worker](../app/records/lib/record-embedding-worker.ts) | External embedding API call; record actions schedule processing | Sensitivity-aware deny-by-default admission across producer, worker, and retrieval |

The existing field schema accepts unknown field definitions; UI field presence is
not proof of server-enforced ranges, relation-category restrictions, or workflow
states. Audit [Records hardening](../supabase/migrations/20260916020700_records_access_hardening.sql)
and the target schema before migrations. Do not reuse protected system category keys.

## 3. School pack: proposed definitions

Use the shared IDs in the schema catalog; `school.*` denotes pack grouping only,
not a second template namespace. Store each student's academic entry separately;
do not use a single class-wide table for confidential grades.
Fields marked `*` are proposed required values, not current validation guarantees.

| Template | Proposed fields | Relations and behavior |
| --- | --- | --- |
| Academic courses | `course_code*` text, title*, description, academic level select, hours number | Optional same-site `catalog_item` link if sold; no automatic creation of a commercial course |
| Groups/classes | `group_code*` text, term* text, capacity number, location | Course* -> Academic courses record; teacher -> authorized team member |
| Student profiles | `student_reference*` text, enrollment date, administrative notes | Optional approved contact link; avoid duplicating auth identities and unnecessary minor data |
| Enrollments | enrollment date*, term*, enrollment state select | Student* -> Student profiles; group* -> Groups/classes |
| Grades | assessment* text, date*, score number, scale select, feedback description | Enrollment* -> Enrollments; assessor -> authorized team member; validate score against approved scale |
| Attendance | session date*, attendance state* select, optional administrative note | Enrollment* -> Enrollments; recorded by -> authorized team member |

Dependencies: Courses -> Groups; Students + Groups -> Enrollments;
Enrollments -> Grades and Attendance. These are relations, not parent-category
inheritance. An optional Academic Administration parent groups the categories only.

Proposed selectors: enrollment state = pending/active/withdrawn/completed;
attendance = present/absent/late/excused; scale = approved numeric or qualitative
scale. Use separate typed fields for qualitative results; never force text into a
numeric score. No automated averages, report-card publication, or attendance rules
until separately implemented and tested.

Validation prerequisites:

- Same-site relations must target the expected installed category and an authorized
  record. Validate references on the server, including after category changes.
- Define course/group reference uniqueness within the agreed school scope; use
  database constraints for required invariants, not frontend duplicate checks.
- Define record access for assigned teachers and authorized school administrators;
  template installation does not give every member access to student records.
- Finance/reception get only explicitly approved administrative information;
  no grade/feedback preview by default. Parent/student access is a separate scope.
- Do not gather health conditions, guardian identity documents, or disciplinary
  detail in a generic starter pack. Academic personal data needs its own privacy gate.

## 4. Clinic packs: operations versus clinical information

Offer two separate tiers. A clinic preset can recommend operational tools while
the medical pack remains unavailable. Even scheduling/contact data can be sensitive;
the operational tier is not exempt from privacy review.

| Template | Proposed fields | Release boundary |
| --- | --- | --- |
| Service protocols | title*, service code text, approved procedure description, revision date | Operational reference; no patient details; optional approved catalog link |
| Administrative follow-ups | reference*, due date, administrative task state, minimal notes | Approved contact/reservation reference only if a supported target exists; no diagnoses |
| Patient index | internal patient reference*, minimal necessary identity fields | Sensitive clinical tier; approved identity model and patient-record scope required |
| Medical history | recorded date*, reviewed history description, allergies description if justified | Patient* -> Patient index; author -> authorized clinician; sensitive clinical tier |
| Encounter notes | encounter date*, clinician relation, reason/findings/plan descriptions | Patient* -> Patient index; optional Medical history reference; sensitive clinical tier |
| Follow-up plans | due date*, instructions description, follow-up state | Patient* and Encounter* references; sensitive clinical tier |

Keep billing in the existing financial modules and appointments in Reservations
when their semantics fit. Do not invent a reservation relation target: add and
authorize it as a separate supported contract, or omit the link in the first pack.

### Mandatory gate before real medical data

1. Approve jurisdiction-specific privacy, consent/legal basis, retention, deletion,
   hosting, vendor-processing, and breach-response requirements. No compliance claim.
2. Enforce patient/record access across category lists, records, forms, relations,
   search, counts, exports, files, diagrams, previews, and APIs; UI roles are not ACLs.
3. Establish tamper-resistant access/change auditing and an approved revision model.
   Finalized clinical notes need amendments, not generic silent overwrite/delete.
4. Deny external embeddings, AI previews/insights, agent access, and outbound syncing
   for sensitive records by default. Enforce before enqueue and at worker/API
   admission; cover edits, retries, imports, related nodes, search and retrieval.
5. Prevent earlier or related embeddings/caches from leaking sensitive records;
   approve purge/reindex and sensitivity-change handling before activation.
6. Approve private file storage, record-scoped download authorization, backups,
   encryption controls, and minimization of log/telemetry payloads and titles.
7. Test denied clinician, reception, finance, cross-site, inactive member, and public
   access. Do not ship patient-facing access, prescriptions, or diagnosis automation.

If any gate fails, show an authorized manager “Medical templates require privacy
and access setup”. Offer safe operational templates, not a generic medical fallback.
Academic sensitive records receive the analogous access/AI/export review.

## 5. Template pack contract and lifecycle

### Registry and persistence proposal

- Pack: stable ID/version, archetypes, needs, supported capabilities, sensitivity,
  dependencies, locale tokens, approved icons, install rules and recommended roles.
- Template: stable ID/version, semantic entity, field IDs/storage keys/types,
  validators, defaults, options, expected relation targets/categories, and views.
- Installed mapping: `(site_id, template_id) -> category_id`, installed version,
  base schema hash, local revision, installer, timestamp and lifecycle state.
- Installation operation: unique site/idempotency key, requested pack/version,
  resulting mappings, status and safe diagnostics; one logical installation per request.
- Use proposed dedicated installation/mapping tables or approved category metadata;
  inspect actual RLS/grants first. Do not overload AI-feedback `system_key` semantics.
- Use existing `record_categories` and `records` for actual categories/content.
  Relation constraints and provenance need forward-only migrations and local tests.

Existing forms address values by `field.name`; changing a displayed field name
can therefore affect data lookup. Introduce stable storage keys separate from
localized labels with an explicit compatibility mapping for old categories.
Do not silently rename keys or treat localization as a data migration.

### Install sequence

1. Recommend pack during onboarding or in Site Settings/Records gallery.
2. Authorized manager selects templates; show dependencies, fields, relations,
   sensitivity and suggested collection tiles. No record creation on preview.
3. Resolve conflicts: reuse a provenance-matched installation; ask whether to map
   a compatible existing category, create a separate collection, or cancel.
   Matching names alone must never trigger overwrite or implicit reuse.
4. Validate version, capabilities, privacy gates, permissions and relation DAG.
5. Install categories, mapping and relations in one transaction, in dependency
   order; enforce same-site references and idempotency under concurrent requests.
6. Confirm stored IDs/version; publish installed collections in `/navigation`.
7. Offer personal pinning separately. Failures do not recreate the site, erase
   existing templates, or claim that a partly installed pack is complete.

Do not insert students, grades, patients, or clinical examples. Demo fixtures are
fictional, isolated, and approved separately. Course collections are empty too.

### Update, customization, and removal

- Copy definitions on install; later registry changes do not overwrite site edits.
- Upgrade uses base/local/new comparison, with added fields and conflicts previewed.
- Preserve values, storage keys and compatible relations. Breaking type changes,
  removed fields or grade scales require explicit migration planning and approval.
- A personal mode/business lens change has no install/upgrade/uninstall effect.
- Archiving hides recommendations; retained records and authorized deep links have
  explicit lifecycle behavior. Uninstall is never automatic; category deletion
  requires impact review, reference checks, retention policy and separate permission.
- Save per-user dismissal of suggestions so removing a recommended shortcut does
  not recreate it on every visit, role change, or pack upgrade.

## 6. `/navigation` and shortcut behavior

Add **Recommended for you**, **Record collections**, and existing **All tools**
sections to the full page and launcher overlay. Use existing ModuleTile/visual
patterns with an identifiable Records collection badge; do not mislabel as modules.

School tiles: Academic courses, Groups, Enrollments, Grades, Attendance.
Clinic tiles: approved operational collections and authorized clinical collections
only after activation. Do not expose patient names or sensitive counts in tiles.

Typed target proposal:

- `module`: canonical module key; use existing href construction.
- `record_collection`: trusted site/category ID; open its list.
- `record_view`: same-site collection plus approved saved-view ID/configuration.
- `record_create`: explicit button opening a validated form; no creation on GET.

Proposed collection URL: `/records?category=<uuid>&view=table`.
**This is a new contract to implement, not currently established category routing.**
Validate category ownership/access and allowed view/filter/sort values; synchronize
URL selection, back/forward, reload and site changes. Fix the generic last-30-days
filter for collection entry: use a declared view default and visible filter chips,
not an unexplained empty Grades/Courses list. Records detail stays `/records/<id>`.

Saved views such as “My groups” or “Today's follow-ups” use trusted assignment and
time zone semantics. Never treat a client filter as permission; do not add arbitrary
SQL, external URLs, user IDs, or data-changing commands as starter shortcut targets.

Personal pins/ordering override recommendations, not access. Preserve existing
legacy shortcuts and built-in pinned entries. Deduplicate by typed target identity,
not translated title. Invalid/deleted targets get a safe generic unavailable state;
access-revoked targets are removed from visible results without leaking metadata.

Reuse `user_shortcuts` where compatible. New fields/target types require reviewed
validation and migration, not arbitrary URLs disguised as category IDs. Cache by
**user + site**, clear on logout, distinguish local-only saves from DB-confirmed
saves, and never announce persistence when the existing writer swallowed an error.

Complete shows all authorized modules and installed collections, keeps personal
pins, and exposes authorized template browsing separately. It never installs packs.
Search includes canonical Records, contextual category tokens, and safe aliases.
Site-language/UI-language choices never rewrite installed storage keys or user text.

## 7. Decision tree A — business, needs, and template eligibility

The complete 29-leaf business tree is in the linked catalog. This tree shows
the sensitive school/clinic dependency expansion; every other leaf has equally
explicit templates/modules/CTAs/copy in the catalog, not an implementation fallback.

```text
Business archetype (site fact, not personal lens)
|-- School / education
|   |-- Academic management?
|   |   |-- Courses + groups -> Academic courses + Groups
|   |   |-- Enrollment -> Students + dependencies + Enrollments
|   |   |-- Grades -> enrollment dependencies + Grades [academic privacy gate]
|   |   `-- Attendance -> enrollment dependencies + Attendance [privacy gate]
|   |-- Sell courses? -> existing Catalog/Sales; optional approved collection link
|   `-- Teaching only? -> role emphasis; no authority to install schemas implied
|-- Clinic
|   |-- Operational references -> Service protocols [approved operational scope]
|   |-- Scheduling -> existing Reservations; no fake clinical appointment engine
|   |-- Patient history/encounters -> medical pack -> all sensitive gates pass?
|   |   |-- No -> blocked; setup explanation; never generic medical installation
|   |   `-- Yes -> manager selection -> Patient index + History/Encounter/Follow-up
|   `-- Billing -> existing finance/sales modules; no clinical data in billing copy
|-- All other current industries -> exact catalog leaf + its declared need branches
`-- Unknown / skipped -> generic Records + gallery; no guessed schema

Every recommended template
`-- Manager authorized + selected + supported + dependencies resolved + gates pass?
    |-- No -> omit/blocked/review state; no mutation
    `-- Yes -> existing provenance match?
        |-- Same version -> reuse; no duplicate
        |-- Older/local edits -> explicit upgrade/conflict review
        `-- None -> validated atomic idempotent install; confirm mappings
```

Size modifies recommendations only: solo = concise starter guidance; multi-team =
assignment guidance; multi-location = approved location setup. Never use headcount
to enable medical access or install more schemas without selection.

## 8. Decision tree B — modules, collections, roles, and shortcuts

```text
Resolve field intent: per-site personal > account personal > assigned UX role
                     > site override > business/needs preset > general default
`-- For each canonical module and installed collection
    |-- Access unknown/loading -> scoped skeleton; no cached other-user content
    |-- Access denied / license unavailable -> omit protected destination
    |-- Collection not installed -> eligible gallery suggestion, not active tile
    |-- Sensitive collection gate failed -> no content tile; manager setup only
    `-- Authorized and available
        |-- Complete -> all permitted modules/collections + personal pins
        |-- Standard -> normal tools + contextual collection recommendations
        `-- Focused -> relevant role/needs + pins; other permitted tools via More
            |-- School teacher -> assigned Groups, Grades, Attendance
            |-- School administrator -> Courses, Groups, Enrollments
            |-- Clinic clinician -> authorized medical collections + Reservations
            |-- Clinic reception -> approved administration + Reservations, not history
            `-- Finance -> authorized financial tools, not grades/clinical notes

Shortcut recommendation
`-- Typed target resolves to same-site authorized destination?
    |-- No -> omit or safe unavailable state; never substitute another site's ID
    `-- Yes -> personal pin/hide intent?
        |-- Pinned -> preserve order; do not duplicate
        |-- Dismissed -> do not auto-add
        `-- Neither -> role/site recommendation; offer explicit pin
```

Following site-only skips the UX-role layer as defined in the parent. Personal
preferences cannot manufacture “my groups” access; server assignment determines it.

## 9. Decision tree C — CTAs and lifecycle state

```text
Destination + semantic entity + trusted capabilities + actual state
|-- Loading -> skeleton; never empty-state install/create CTA
|-- Fetch failed -> Retry; never "No grades yet" or "Create patient"
|-- Read denied -> safe access state; no entity name, count or create action
|-- Pack absent
|   |-- Can install + privacy/dependencies pass -> Review templates -> Install selected
|   |-- Can install but blocked -> Review setup requirements; no bypass button
|   `-- Cannot install -> authorized generic guidance; no schema-writing CTA
`-- Collection installed + readable
    |-- Empty -> can create? -> Add grade / Add course / Add encounter note
    |                       `-> No: read-only empty state
    |-- Existing entries -> Open/view; create/edit only with respective permission
    |-- Filter matches none -> Clear filters, not Install templates
    `-- Sensitive finalized entry -> authorized View / Add amendment
                                   (only after amendment capability exists)

Any destructive action -> explicit permission + impact/retention review + confirmation
Any create CTA -> form validation -> authorized POST/action -> stored-row confirmation
```

Never label a generic save “Publish grades”, “Prescribe”, “Sign medical record”, or
“Enroll student automatically” unless that exact backend workflow exists.
Pin/unpin is a personal navigation action, not category creation or record access.

## 10. Decision tree D — names, icons, CTA copy, and helper copy

```text
Canonical entity/action + context (never arbitrary global string replacement)
|-- Legal/payment/audit/raw data token -> keep canonical regulated terminology
`-- Personalizable semantic token
    |-- Explicit approved personal terminology override?
    |-- Else role/site override? -> business template token -> canonical token
    `-- Apply selected UI locale: contextual translation -> canonical translation
        -> canonical English fallback
        |-- Label -> same entity name in tile/title/breadcrumb/create form
        |-- CTA -> action permission + state from tree C + semantic action token
        |-- Icon -> approved category/module icon + localized accessible name
        `-- Helper -> assistance level + operational state + applicable privacy notice
            |-- Guided -> purpose, necessary fields, next step
            |-- Concise -> short instruction; never remove mandatory warnings
            `-- Error/blocked -> truthful recovery; never claim saved/installed success
```

| Context | Tile/title | CTA | Guided helper / empty-state copy |
| --- | --- | --- | --- |
| School course collection | Academic courses | Add academic course | Define the academic course before linking groups and enrollments. |
| School grades | Grades | Add grade | Select an authorized enrollment and assessment, then enter the approved result. |
| School attendance | Attendance | Record attendance | Select the enrollment and session date. Only permitted student records are available. |
| Clinic operational references | Service protocols | Add service protocol | Maintain approved service guidance here. Do not enter patient information. |
| Clinic clinical collection, gates passed | Encounter notes | Add encounter note | Select an authorized patient record. Follow your organization's documentation policy. |
| Clinical gates blocked | Medical template setup | Review requirements | Medical templates are unavailable until privacy and record-access requirements are approved. |
| Installed collection, no filter matches | Same collection title | Clear filters | No entries match the current filters. |
| Collection read-only and empty | Same collection title | No create CTA | No entries are available in this collection. |

Copy is illustrative English source content, to translate through en/es/fr/de/ja
tokens. User-authored course/category names remain user data. Do not relabel every
customer as a student/patient: use that alias only in the matching semantic context.

## 11. Worked outcomes

- **School, 20 staff, grades + attendance, teacher:** manager installs dependencies;
  teacher sees only authorized groups/enrollments. Navigation offers Grades and
  Attendance; Add grade opens the matching form. Personal Complete adds all other
  authorized tools without exposing another teacher's students or changing schemas.
- **Same school, finance user:** fees use existing finance capabilities. Academic
  courses can be recommended if readable; no grade/feedback access by UX-role name.
- **Clinic, receptionist, scheduling:** Reservations and approved administration
  are emphasized. Medical templates absent/blocked do not produce a patient-history
  tile. Changing the personal lens to clinician never grants patient access.
- **Clinic, authorized clinician, gates approved:** manager installs reviewed
  clinical pack; encounters reference permitted patients. Clinical data remains
  excluded from external AI/embeddings by default. No prescribing/signing claim.

## 12. Implementation phases and acceptance evidence

| Phase | Deliverable | Gate |
| --- | --- | --- |
| T0 | Approve school/clinic schemas, semantics, access and sensitive processing policy | No unsupported fields/actions or compliance claims |
| T1 | Stable field keys, registry, validators, mapping/install transaction | Local database tests: duplicate/concurrent installs, same-site references, rollback |
| T2 | Gallery, manager review, install/upgrade/conflict UI, school pack | Dependency correctness; no sample student data; existing edits preserved |
| T3 | Category/view URL contract, `/navigation` tiles, typed shortcuts and cache migration | Reload/back/site-switch/search/access tests; no GET mutations |
| T4 | Shared CTA/copy/icon resolver and role recommendations | All four trees produce consistent titles/actions/state across supported locales |
| T5 | Approved clinic operations; clinical tier only after separate sensitive-data gate | End-to-end record/AI/export/file access evidence before real medical data |

Required Jest coverage: schema limits, expected relation category, numeric/qualitative
scales, stable keys/localization, dependency cycles, repeated/concurrent install,
unauthorized install, cross-site shortcuts, deleted/archived collections, revoked
access, personal dismissals/pins, legacy cache account isolation, DB save failure,
scope changes, URL parsing, date filters, missing translations and truthful CTAs.

Sensitive release tests must exercise enqueue/worker/API/retrieval denial, related
records, files, previews, counts, exports, amendment policy and stale embeddings.
Use fictional data only in an approved disposable test environment.

Acceptance: a school manager can install selected academic categories once, a
teacher can open/pin Grades in `/navigation`, and personal Complete preserves
record restrictions. A clinic cannot install medical templates until every sensitive
gate is approved. Registry upgrades never silently change site records or shortcuts.

Open decisions: initial grading scales; student/contact identity boundary; authorized
teacher assignment model; clinical retention/amendment policy; approved category
ACLs; saved-view persistence model; supported reservation links; final pack scope.
No remote migration, deployment, or handling of real sensitive data is authorized
by this planning document.