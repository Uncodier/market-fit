# Business and role-based UX personalization

**Status:** Proposed plan; no runtime behavior or database changes implemented.
**Date:** 2026-10-31.
**Scope:** Site onboarding, Site Settings, personal preferences, Team Settings,
Records starter templates, `/navigation` collection shortcuts, and a shared
presentation layer across the authenticated workspace.

**Record schema subdocument:** [Business templates, fields, and relations](UX_PERSONALIZATION_RECORD_TEMPLATES.md)
consolidates the 52 proposed templates, all 29 business mappings, explicit relation
keys/cardinality, dependencies, privacy gates, and schema decisions for review.

**Detailed extension:** [Record templates, navigation, and decision trees](UX_PERSONALIZATION_TEMPLATES_AND_DECISIONS.md).
This companion is part of this plan and specifies school/clinic packs, schemas,
installation, shortcuts, module selection, CTAs, copy, security gates, and tests.
**Full decision coverage:** [29 business leaves](UX_PERSONALIZATION_BUSINESS_CATALOG.md)
and [shared execution rules](UX_PERSONALIZATION_EXECUTION_RULES.md) specify all
current industries, template schemas, roles, needs, sizes, module families and states.
**Priority ICPs:** [Marketing Agency and Content Creator](UX_PERSONALIZATION_AGENCY_AND_CREATOR_MODES.md)
are explicit first-class usage choices, not inferred industry examples; both ship
with onboarding, Site Settings, personal lenses and tailored setup.

## 1. Product objective

Make Makinari feel appropriate for the business and the person using it, rather
than presenting every business with the same terminology and module hierarchy.
A site represents a business/workspace, not necessarily a website.

There are **two main personalization layers**, exposed through four entry points:

1. **Business layer:** onboarding establishes the site defaults; Site Settings
   lets authorized managers change them later.
2. **Personal layer:** Team Settings assigns recommended experience roles;
   personal preferences can override the presentation for that user, including
   choosing **Complete experience**.

The result must adapt module names, icons and their accessible labels, navigation,
CTAs, helper text, empty states, onboarding guidance, dashboard emphasis, and
progressive disclosure. It must not create separate products or duplicate modules.

### Non-negotiable boundaries

- Personalization changes presentation, never authorization or licensing.
- Keep canonical module IDs, routes, entities, workflows, and analytics IDs stable.
- Never change prices, payment behavior, procurement rules, legal terminology,
  location restrictions, data visibility, or automation execution through UX presets.
- Hiding a module from the main menu is not disabling it or deleting its data.
- User-facing strings use the existing localization system; repository docs remain
  English. A personal UX choice does not change the site's public language.
- Existing sites keep their current presentation until they opt in.
- Installing a Record template is an explicitly authorized schema/configuration
  operation, separate from selecting a presentation preset. Never install, modify,
  or delete site categories because a member changes their personal experience.

## 2. Current implementation and integration points

The following findings are based on local source, not a remote schema audit:

| Surface | Current behavior | Planned integration |
| --- | --- | --- |
| `/create-site` | Uses `SiteOnboarding`; marketing includes optional total/available budget | Replace budget questions with early identity and personalization questions |
| Company information | Already captures `industry` and `company_size` | Reuse these values; do not create conflicting copies |
| Site Settings | General section contains `default_locale` | Add a neighboring Business & Experience card |
| `/profile` | Preferences include language and timezone; profile has a professional role | Add explicit UX preferences without repurposing that role as authorization |
| Team Settings | Uses membership roles, positions, screen blocks, and location controls | Add an independent experience-role catalog and assignment |
| Navigation | Central area configuration uses stable keys and destinations | Resolve presentation around this registry, not new routes |
| Records | Categories define dynamic fields and relations | Offer reviewed starter packs with explicit installation and version tracking |
| `/navigation` shortcuts | Module tiles; sidebar supports user/site custom links | Add installed collection tiles and typed, validated collection/view shortcuts |
| Site persistence | Writes `settings`; initial settings failures can leave a created site | Verify personalization saves and offer retry without creating another site |

Relevant existing sources:

- [Creation entry point](../app/create-site/page.tsx).
- [Onboarding controller](../app/components/onboarding/site-onboarding.tsx),
  [schema](../app/components/onboarding/schemas/onboarding-schema.ts),
  [steps](../app/components/onboarding/constants/onboarding-constants.ts), and
  [budget questions](../app/components/onboarding/steps/marketing-step.tsx).
- [Alternative creation form](../app/components/site/create-site-form.tsx): audit
  its consumers and align any still-supported creation path with the new contract.
- [General settings](../app/components/settings/GeneralSection.tsx) and
  [site types](../app/context/site-types.ts).
- [Profile preferences](../app/profile/components/ProfilePreferences.tsx) and
  [profile service](../app/services/profile.service.ts).
- [Team section](../app/components/settings/TeamSection.tsx),
  [team form roles](../app/components/settings/team-types.ts), and
  [screen access](../lib/auth/screen-access.ts).
- [Navigation areas](../app/config/navigation-areas.ts),
  [sidebar](../app/components/navigation/Sidebar.tsx), and
  [module inventory](MODULES.md).
- [Settings writer](../app/context/site-update-settings.ts) and
  [creation persistence](../app/context/site-crud.ts).

`SiteSettings.team_roles` currently has a name/permissions shape. Do not assume it
is an implemented UX-role catalog. The inspected profile preferences also do not
establish an existing Complete experience setting; this plan defines that option.

## 3. Personalization dimensions

Separate business facts from presentation choices:

| Dimension | Examples | Purpose |
| --- | --- | --- |
| Business archetype | Retail, restaurant, professional services, education, B2B supplier, general | Vocabulary and starter module recommendations |
| Industry | Existing industry taxonomy | Context; not a substitute for operating model |
| Business size | Existing employee bands; optional solo indicator | Team/management guidance, not permission or automatic complexity |
| Operating model | Physical, online, hybrid; one/multiple locations | Relevant setup recommendations |
| Primary needs | Sell, manage customers, book services, fulfill orders, buy supplies, automate, report | Prioritize modules and actions; allow multiple needs |
| Person's function | Owner, cashier, sales, marketing, operations, purchasing, finance | Recommended daily experience |
| Experience mode | Focused, Standard, Complete | Amount of presentation and progressive disclosure |
| Assistance level | Guided, concise | Helper density, independent of access and business size |

Use stable preset IDs and a versioned, curated registry. Do not generate labels
or navigation from AI on each request. Support `general` and an optional descriptive
answer for businesses that do not fit a preset; free text does not become an ID.

Do not infer expertise from headcount. A solo consultant may want Complete
experience, and an enterprise cashier may want a focused workflow.

## 4. A — Site creation: ask who the user is

### Proposed flow

1. **Basic identity:** keep the existing site identity requirements for the first
   release; changing URL requirements is a separate product decision.
2. **Who are you?** Ask the creator's function in this business, not an account
   permission: owner/founder, manager, sales, marketing, operations, purchasing,
   finance, other. Include “Prefer not to say”.
3. **What kind of business is this?** Choose archetype, reuse industry and size,
   and select physical/online/hybrid plus location complexity if relevant.
4. **What do you need help with?** Multi-select goals, with a primary priority.
5. **Recommended experience:** preview module labels, priority modules, primary
   CTA, and suggested role. Allow edits, Standard, or Complete experience.
6. **Optional setup:** show relevant existing business-hours, locations, company,
   channels, and catalog setup. Keep unrelated optional setup available later.
7. **Review and create:** distinguish site defaults from “My experience”; save
   both in their respective scopes and show persistence failures explicitly.

Target a short personalization sequence, not a long mandatory questionnaire.
Allow skipping to a safe general experience and returning in Settings.

### Replace the budget prompt safely

- Remove total/available marketing budget inputs from the creation journey.
- Keep budget configuration in Marketing Settings and preserve historical values.
- Do not infer a budget from identity, company size, needs, or subscription tier.
- Preserve billing/license initialization and existing background site setup.
- Keep AI `focus_mode` independent: it controls sales/growth behavior, not UX.
- Update step IDs, validation, skip logic, summary, error routing, skeletons, and
  related tests together; the current flow contains numeric step assumptions.

### Conditional follow-ups

| Answer | Follow-up | Recommendation only |
| --- | --- | --- |
| Restaurant | Counter sales, table service, delivery, reservations? | POS, orders, menu/catalog, inventory, buying |
| Retail | Physical store, online store, or both? | Catalog, POS, orders, shipments, inventory |
| Professional services | Appointments, project work, or recurring services? | Reservations, customers, quotations, records |
| Education | Courses, sessions, or both? | Catalog, reservations, customer subscriptions |
| B2B supplier | Quotes, repeat orders, supplier/tender participation? | Deals, quotations, orders, relevant buying surfaces |
| General / skipped | Which daily tasks matter most? | Current module vocabulary and Standard experience |

Only recommend workflows that already exist. A role answer never grants admin
rights, opens blocked screens, or activates an integration.

## 5. B — Site Settings: business and usage defaults

Add **Business & Experience** next to the site language configuration. Reuse
SectionCard, form controls, save feedback, and settings loading patterns.

Fields:

- Business archetype, industry, company size, operating model, and needs.
- Recommended/default experience mode and assistance level.
- Module emphasis: primary, secondary, or absent from the focused menu.
- Preset vocabulary and approved icon choices, with a preview.
- Reset presentation overrides to the selected preset, with confirmation.

Show “Default for this site. Members can choose their own experience.” Explain
that this setting does not disable tools or change permissions.

Only trusted owners/admins or an explicitly authorized settings-manager capability
may write site-wide personalization. Ordinary members can read permitted defaults.

Changing the archetype must preview its impact and preserve manual overrides by
default. Offer an explicit reset separately. Preserve member role assignments and
personal choices; do not silently regenerate team roles on every site save.

Reuse existing company facts in Company Settings. Both screens edit the same
canonical values rather than maintaining independent business-size/industry copies.

## 6. C — Personal preferences and override precedence

Add **My experience** to `/profile`, with a clear current-site indicator.

Controls:

- Follow site and assigned role recommendations (default).
- Follow site only, ignoring the UX-role recommendation.
- Choose a curated personal experience/functional lens, without changing access.
- Experience mode: inherit, Focused, Standard, or Complete.
- Assistance level and optional module emphasis.
- Apply as an account default or only to the current site.
- Reset this site's overrides; reset account default separately.

### Resolution contract

Resolve **each field**, not one winning object. Highest precedence first:

1. Explicit personal override for the current site.
2. Explicit account-wide personal default.
3. Assigned site experience-role recommendation, unless the user chooses site-only.
4. Explicit site presentation override.
5. Business preset derived from site facts and needs.
6. Legacy/general application defaults.

An omitted or inherited field contributes nothing. An explicit empty list means
“no recommended modules”, not inheritance. Store intent, not a flattened resolved
snapshot, so inherited settings can follow future site updates.

After resolving presentation, intersect it with **trusted access, screen blocks,
location/resource scope, license entitlements, and operational availability**.
These are authoritative constraints, not overridable personalization layers.

Examples:

- Restaurant site + cashier role + no personal override: focused cashier workflow.
- Same membership + personal Complete: all authorized modules, no extra access.
- Restaurant site + personal finance lens: finance-oriented UI for this user only;
  the site remains a restaurant and financial permissions remain unchanged.
- A per-site Focused mode overrides an account-wide Complete mode on that site only.
- A blocked inventory screen remains blocked in every preset and mode.

### Complete experience

Complete means **all authorized module destinations using the standard navigation
organization**, without preset-based menu omissions or role-based progressive
disclosure. Keep permitted full configuration discoverable.

Business vocabulary may remain contextual, and helpers retain the selected
assistance level. Offer a separate “Use standard terminology” choice; Complete
does not inherently mean changing the business vocabulary.

Never expose forbidden fields, actions, or records, and never bypass prerequisites.
If no mode is explicitly chosen, inherit using the precedence above; Complete is
not a permanent account flag that automatically wins over a per-site choice.

## 7. D — Team Settings: experience roles

Introduce an **Experience roles** list, separate from the access-role selector.

Suggested templates: business owner, store manager, cashier, sales representative,
marketing specialist, service coordinator, operations, purchasing, finance, general.
These are recommendations, not a replacement for existing membership roles.

Each site role has a stable ID, name, description, base functional preset, default
mode, recommended modules/CTAs/helpers, and an assignment count. Site managers can
create, edit, archive, and assign roles, starting from relevant business templates.

The member editor shows three distinct concepts:

1. **Access role:** current authorization and existing screen/location restrictions.
2. **Position:** descriptive job title.
3. **Experience role:** presentation recommendation the member may override.

Start with one assigned experience role per membership; do not implement ambiguous
multi-role merging in the first release. Preserve a role assignment through pending
invitation acceptance using trusted membership identity, not an email-only mapping.

Preview a role's UI without impersonating members or fetching their protected data.
Allow the creator's onboarding function to suggest a UX role, without rewriting
account profile identity or changing the creator's access role.

Archiving a referenced role requires a replacement or explicit site-default
fallback. Assignment updates affect only inherited personal settings. Managers see
assignment status, not private personal overrides by default.

## 8. UX coverage and terminology rules

| Surface | Adaptation | Invariant |
| --- | --- | --- |
| Sidebar, launcher, search, shortcuts | Grouping, order, labels, icons | Same module keys, canonical routes, access checks |
| Page headings, tabs, breadcrumbs | Consistent contextual vocabulary | No unrelated terminology per surface |
| CTAs | Relevant action labels and emphasis | Same authorized action and prerequisites |
| Helpers, tooltips, empty states | Contextual guidance, density, examples | Never claim unavailable capabilities |
| Forms | Progressive disclosure of optional advanced sections | Preserve required fields and accessible validation |
| Dashboard | Relevant existing widgets and shortcuts | No invented metrics or data-scope changes |
| Onboarding tasks | Prioritize relevant tasks | Keep persisted progress and existing completion checks |
| Accessibility | Icon names, labels, focus order, announcements | No icon-only ambiguous actions |

Illustrative vocabulary, subject to a module-by-module semantic review:

| Canonical entity/module | Restaurant | Retail | Services |
| --- | --- | --- | --- |
| Catalog | Menu | Products | Services |
| Leads | Customer contacts | Customer contacts | Prospects |
| Reservations | Table reservations, if supported | Bookings, when relevant | Appointments, if supported |
| Catalog create CTA | Add menu item | Add product | Add service |
| Catalog helper | Add items and available options | Add products and variants | Define services and booking requirements |

Do not rename `records` to “Projects” or reservations to a specialized workflow
unless actual capabilities match. Do not personalize legal invoices, payment states,
audit events, raw exports, or public documents in this first workspace release.

Search should match canonical names and contextual aliases so experienced users
can still find renamed modules. “More tools” exposes other authorized destinations
in Focused mode; a valid deep link to a de-emphasized module stays valid.

## 9. Technical design and persistence proposal

### Shared presentation engine

- Add a small shared, typed registry and pure resolver under a dedicated
  `lib/ux-personalization/` boundary; filenames are proposed, not existing APIs.
- Define business presets, functional presets, semantic labels, approved icon IDs,
  mode rules, module metadata, validation schemas, and provenance per resolved field.
- Expose one provider/hook for consumers. Cache by authenticated user, site,
  membership role assignment, preference revisions, and registry version.
- Reuse React, TypeScript, Zod, existing context/data-loading patterns, existing UI
  components, and `app/components/ui/icons.tsx`; no new dependency is required.
- Do not overload `t()` globally or perform arbitrary string replacement. Resolve
  a semantic UX token to a locale key, then use the existing translation machinery.
- Fallback order: contextual translated token, canonical translated token, canonical
  English token. Cover all supported locales: en, es, fr, de, ja.
- Keep loading and error states distinct; avoid a flash of another site's preset.
  Invalidate on site switch, logout, assignment updates, and preference saves.

### Proposed storage boundaries

| Data | Recommended storage | Authorization |
| --- | --- | --- |
| Industry and size | Existing canonical settings fields | Trusted site-settings writers |
| Business archetype/model/needs and presentation defaults | Versioned `settings.ux_personalization` JSONB proposal | Site read scope; authorized manager writes |
| Account personal defaults | Versioned `profiles.settings.ux_personalization` proposal | Own authenticated profile only |
| Site experience-role catalog | New `site_experience_roles` table proposal | Active member read; authorized manager write |
| Membership role assignment | Nullable `site_members.experience_role_id` proposal | Same-site role and membership; authorized manager write |
| Per-site personal overrides | New `user_site_ux_preferences` table proposal, unique `(user_id, site_id)` | Own preferences plus valid site membership |

Confirm actual schema, existing writers, RLS, grants, and protected settings fields
before choosing final DDL. The proposal is not evidence these columns/tables exist.

Do not conflate the new role catalog with `settings.team_roles.permissions` or
existing membership authorization. Enforce same-site role assignment in the database,
not only in the form. Archived/deactivated memberships must not retain site access.

Use versioned minimal preference documents with bounded IDs, enums, lists, and
allowed presentation fields. Store module IDs and translation/icon tokens, not
arbitrary HTML, executable code, external icon URLs, or unsanitized prompts.

Writes must preserve unrelated settings, including calendar, channels, procurement,
onboarding progress, and license metadata. Use scoped atomic/conditional patches
or a version check; stale saves must not overwrite another settings editor.

New endpoints validate authentication, tenant membership, operation authorization,
and inputs independently. Prefer user-scoped Supabase with RLS; no service-role
shortcut. Verify returned values before announcing success.

Forward-only migrations, regenerated schema types, local database tests, and
explicit approval before remote migration/deployment are implementation gates.

## 10. Delivery phases

| Phase | Deliverable | Exit condition |
| --- | --- | --- |
| 0 — UX contract | Inventory all module surfaces; approve terminology, presets, precedence, schemas | Agreed coverage matrix and safe semantic aliases |
| 1 — Foundation | Resolver, schemas, registry, persistence/RLS, general fallback | Unit and local database tests prove inheritance and tenant isolation |
| 2 — Four entry points | Identity onboarding, Site Settings card, personal controls, team role list/assignment | Save/reload/reset/preview work across all four flows |
| 3 — Workspace shell | Sidebar, launcher, search, breadcrumbs, shortcuts, Complete mode | Consistent aliases and every authorized tool discoverable |
| 4 — Module UX | Catalog, POS/orders, customers/quotations, reservations; then buying, finance, automation, reports | Per-module labels, CTAs, helpers, empty/error states pass coverage matrix |
| 5 — Hardening and rollout | Localization, accessibility, performance, compatibility, staged opt-in | Approved QA evidence and rollback controls |

Initial usage choices include explicit **Marketing Agency** and **Content Creator**
modes, plus general, retail, restaurant, professional services, and school/education.
Use the full functional-role template list; stage
B2B vocabulary after validating semantics. Clinic operational templates may ship
separately; medical-record installation is blocked until its privacy/security
gates pass. MVP includes **all four entry
points** and Complete mode, not merely renamed sidebar items.

Include a school starter pack and installed-category tiles in the initial Records
extension. Deliver clinical records in a separately approved sensitive-data phase.
See the companion for the extension's independent implementation gates.

Broader “all UX” coverage belongs to the completed rollout, not an MVP completion
claim. Track each module/surface as canonical-only, adapted, reviewed, or blocked.

## 11. Validation and acceptance criteria

### Automated coverage

- Jest resolver tests: every precedence layer, partial inheritance, explicit empty
  lists, unknown IDs, archived roles, registry upgrades, and access intersection.
- Component tests: identity follow-ups, skip/back/error routing, preview, settings
  save/reset, role assignment, personal scopes, and Complete mode discoverability.
- Regression tests: canonical routes/actions, budget preserved in Marketing
  Settings, billing setup unchanged, onboarding progress not overwritten.
- Persistence/API tests: unauthenticated, unauthorized, forged user/site IDs,
  cross-site assignment, self-preference isolation, malformed payloads, stale writes,
  invitation acceptance, inactive memberships, and partial creation failures.
- Localization contracts: supported-locale coverage, canonical fallbacks, matching
  labels across navigation/title/CTA, searchable aliases, approved icon IDs.
- Browser scenarios in an explicitly approved disposable environment: retail
  owner, restaurant cashier, service coordinator, purchasing user, personal Complete,
  account/site overrides, reload, and switching between two differently configured sites.

Before implementation, consult [browser context](../specs/context.md) and
[E2E execution rules](E2E_TESTING.md). No production E2E target is implied.

### Acceptance checklist

- [ ] Creation no longer asks for marketing budget; identity drives a preview.
- [ ] Industry and size have one canonical source; existing budgets remain intact.
- [ ] Managers can change site defaults beside language settings.
- [ ] Team Settings supports a separate editable/assignable experience-role list.
- [ ] Members can inherit, choose a personal lens, or select Complete experience.
- [ ] Per-site overrides beat account defaults; resetting restores inheritance.
- [ ] Complete shows every authorized tool and never broadens access or licensing.
- [ ] Module aliases, CTAs, helpers, icons, titles, and search agree.
- [ ] No setting change mutates business data, permissions, or automation behavior.
- [ ] Saves survive reload and conflict safely without overwriting unrelated settings.
- [ ] Site/account switching never leaks preferences or briefly shows protected UI.
- [ ] Legacy sites, missing preferences, and unknown presets retain safe defaults.
- [ ] Every supported locale and mobile/keyboard flow has reviewed coverage.
- [ ] Marketing Agency and Content Creator are named first-class choices in
  onboarding, Site Settings and personal lenses, with dedicated questions and copy.
- [ ] School templates cover courses, groups, enrollment, grades, and attendance
  through reviewed schemas, dependencies, relations, and explicit installation.
- [ ] `/navigation` lists authorized installed Record collections and can save
  category/view shortcuts without creating fake standalone modules.
- [ ] Template retries/upgrades preserve site edits and records; personal overrides
  never install or mutate templates.
- [ ] Clinical and sensitive education templates stay blocked until record-level
  controls and all AI/embedding/search/export privacy gates pass.

## 12. Rollout, observability, and open decisions

Ship behind an opt-in feature gate. Do not mass-reclassify existing sites from
industry alone. Offer a dismissible setup invitation; users who decline retain
the current general experience. Keep canonical fallback and disable personalization
rendering without deleting saved preferences if a rollback is needed.

Measure onboarding completion, time to first relevant action, use of More tools,
Complete adoption, override/reset frequency, and task success by preset. Use stable
event IDs; avoid logging free-text answers or another user's private preferences.

Decisions to approve before implementation:

1. Confirm initial business presets and reviewed semantic aliases.
2. Approve Focused/Standard/Complete distinctions and standard-terminology control.
3. Confirm which existing capability authorizes site defaults and UX-role management.
4. Confirm personal account-default plus per-site override controls for the MVP.
5. Confirm curated presentation only at launch; arbitrary custom labels/layouts
   and public storefront/document personalization are separate future scopes.
6. Decide whether solo identity needs a new normalized size value; do not rewrite
   existing employee-band records without an explicit compatibility mapping.
7. Approve the school starter pack, clinic sensitivity tiers, collection shortcut
   model, and decision trees in the companion before schema implementation.

## 13. Unified decision tree: templates, modules, actions, and copy

```text
Active site + authenticated membership
|-- Missing access -> existing sign-in/access flow; no site content
`-- Authorized -> read business facts, needs, installation state, and UX intent
    |-- Choose industry + explicit variant -> one of the 29 catalog business leaves
    |   |-- Every current industry -> declared questions/templates/modules/CTA/copy
    |   |-- Sensitive templates -> privacy/access/processing prerequisite gates
    |   `-- Unknown/skipped -> other.general + explicit need composition rules
    |-- TEMPLATE branch: site manager explicitly selects and reviews pack
    |   |-- Unsupported field, permission, privacy, dependency -> blocked/review
    |   `-- Valid -> atomic idempotent install -> site category IDs + provenance
    `-- PRESENTATION branch: resolve each personal/site/role field by precedence
        |-- Modules -> canonical capability + authorized scope + experience mode
        |-- Collections -> installed category + record access + role relevance
        |-- Shortcuts -> valid module/category/view target + own pin/hide intent
        |-- CTA -> authorized action + actual installation/data/loading state
        `-- Copy/icon -> semantic entity + curated token + locale + assistance
            `-- Render shared result in navigation, page, CTA, helper, and search
```

**Critical distinction:** role and personal choices determine emphasis, not which
school or medical schemas exist. Complete reveals all authorized installed
collections, never installs every template or removes record-level restrictions.

The catalog expands every business leaf; shared rules cover all role/need/size,
template schema, module, action-state and copy branches without unspecified cases.

**Recommended next step:** approve the UX contract and storage boundaries, then
implement the shared resolver and four configuration surfaces before expanding
module-level coverage. This document does not authorize deployment or migrations.