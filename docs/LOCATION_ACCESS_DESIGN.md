# Team Settings: Location-Scoped Access

**Status:** target design; [operational enforcement and member management](LOCATION_ACCESS_ENFORCEMENT.md)
are implemented in source, with documented unsupported projections and deployment steps.
The restriction-list direction preserves access; open decisions remain below.
**Review date:** 2026-10-19. Findings below come from repository inspection, not a
live database audit. Physical columns, policies, grants, and RPCs must be verified
against the approved target before implementation.

## 1. Executive summary

Add per-member **restricted locations**, independent of the member's role, using
the negative-list pattern of `blocked_screens`. Preserve existing access unless
a manager explicitly restricts a location. An empty list adds no location denial;
it never elevates roles, site membership, or existing resource permissions.

This replaces the earlier `all`/`selected` allowlist proposal. New locations remain
accessible under existing permissions until explicitly restricted. To approximate
"only branch A", restrict the other branches; future branches require review.

The recommended approach is **cross-module security from the first release,
progressive UI improvements afterward**. A dropdown in Team Settings alone is
not sufficient. Every included root entity needs a trustworthy location relation,
database policies, authorized writers, and protection for its related records.

Security is centralized in shared authorization functions and enforced by RLS
per table. It is **not a manually repeated filter on every screen**. Ordinary
user-scoped queries inherit the restriction; privileged paths and caches need
explicit integration. Adding a field alone does not secure an entity.

Core distinction: **local operational records, minimally shared identity, and
global administration**. A location is a branch inside a site/workspace, not a
replacement for the existing site/tenant boundary.

## 2. Current implementation and evidence

- Stored roles are `owner`, `admin`, `collaborator`, and `marketing`. UI role
  labels are mapped to these roles; this proposal does not introduce new roles.
- Team Settings supports `blocked_screens` and `restrict_to_assigned_only`.
- `user_can` and `requireSiteAccess` operate at site/action or site/role level;
  neither currently establishes a location scope.
- Inventory, orders, and other modules already accept optional location filters.
  These are query preferences, not the proposed authorization boundary.
- Deals and Tasks include browser Supabase queries; Leads includes user-scoped
  server reads. Proper RLS can protect both without per-screen security filters.
- Orders has a user-keyed server cache. User identity alone does not prevent a
  stale cached response after that user's permissions change.
- No member location-scope model was found in the inspected source. Checked-in
  migrations are not a complete database bootstrap history.

Source references: [team card][team-card], [team state][team-state],
[member API][member-api], [site authorization][site-access],
[action permission helper][action-access], [assignment migration][assigned-sql],
[inventory actions][inventory], [deals queries][deals], [lead reads][leads],
[task queries][tasks], and [order queries/cache][orders].

## 3. Team Settings and permission composition

Each member keeps four separate controls:

| Control | Responsibility |
| --- | --- |
| Role | Which actions are allowed: select, insert, update, delete. |
| Restricted locations | Explicit locations to exclude from existing access; empty means no additional location restriction. |
| Assigned data only | Additional restriction in modules with defined assignment semantics. |
| Blocked apps | Navigation/screen restriction; not a replacement for data authorization. |

For a local resource, the proposed rule is:

```text
trusted identity + active site membership
AND action allowed by role
AND resource is not excluded by the member's location restrictions
AND assignment allowed, when applicable and enabled
AND any resource-specific business authorization
```

- Assignment and location restrictions combine with **AND**, never OR.
- An assigned record in a restricted location remains inaccessible.
- An empty restriction list does not elevate the role or unblock an app.
- Screen hiding does not secure API/database access. If app blocking must also
  revoke an operation, enforce that separately at its backend boundary.
- Preserve effective membership checks, including manual disablement and license
  suspension. Pending/rejected invitations must not grant operational access.
- Recommended initial policy: owners/admins are exempt from location restrictions,
  matching app blocking, and manage restrictions. Restrict branch operators in
  operational roles. Restricted admins need a separate no-escalation design.
- Access always stays within the existing authorized site and role. Do not turn
  this compatibility change into a blanket rewrite of existing app/admin permissions.

### Member scope model and UI

Proposed names, subject to schema verification:

- Team Settings/API field: `restricted_location_ids`, default `[]`; do not add
  `location_access_mode` or `allowed_location_ids`.
- Recommended persistence: `site_member_location_restrictions`, a normalized
  membership/location relation with uniqueness, same-site FKs, RLS, and indexes.
  The API exposes it as an array. Prefer this over a UUID array without per-ID FKs;
  it preserves the negative-list UX without sacrificing database integrity.
- Use real `locations.id` UUIDs, not names, array positions, or presentation IDs.
- Only authorized team managers can add/remove restrictions. Protect direct database
  writes as well as API calls; members cannot remove their own restrictions.
- Replace the restriction set atomically. Check actor, target member, and every
  location in the transaction. Audit old/new scope and actor without sensitive payloads.
- Configure restrictions on the pending membership before acceptance, including invites
  to users whose `user_id` is not linked yet. Acceptance/resend must preserve them.
- Accept `[]` as valid and clear all location restrictions. An omitted PATCH field
  means unchanged; malformed values or unknown/cross-site IDs fail validation, not
  silent sanitization to `[]`. A successfully resolved empty set differs from a
  failed lookup, missing identity/membership, or incomplete schema: failures deny.
- Existing memberships begin with zero restriction rows; no access-grant backfill.
  Preserve legacy unassigned/shared reads and writes when the list is empty.
- Reuse current team save/change detection, validation, license controls, UI
  components, and icon registry. Repository UI copy remains English.

## 4. Proposed access matrix

These rules describe a member with a non-empty restriction list. "Authorized"
means existing access minus restricted locations. Empty lists preserve existing
behavior. Additional central-management rules below remain recommendations, not
automatic changes to current users' permissions. Every write requires the role
and existing operation-specific checks.

### 4.1 Local operational data

| Module/data | Read access | Write access and location source |
| --- | --- | --- |
| Locations | Authorized locations only. | Location configuration reserved to owner/admin initially; use the location ID itself. |
| Inventory | Stock and local movements in authorized locations. | Adjust authorized stock; use `location_id`. |
| Transfers | Full transfer only when both endpoints are authorized. | Require origin and destination access before an atomic stock transfer. |
| POS | Operational catalog plus authorized orders/sales/stock. | Sell and operate only at authorized locations. |
| Registers/shifts/closing history | Authorized location shifts only. | Operate within the shift's location; retain existing cashier/closing rules. |
| Sales/invoices/receivables | Authorized documents and their balances. | Payments, refunds, and edits require access to the sale's `location_id`. |
| Orders/lines/units | Authorized commercial orders; children inherit authorization. | Use a canonical commercial location; logistics fields cannot widen document access. |
| Shipments/tracking | Authorized origin plus access to the related order. | Dispatch only within that scope; authorize stock location separately. |
| Purchases/bills/payables | Authorized purchase documents and balances. | Purchase, pay, and receive at authorized locations; use purchase `location_id`. |
| Expenses/transactions | Expenses allocated to authorized locations. | Create/edit within that scope; use `location_id`. |
| Reservations/visits | Authorized operating location records. | Book/attend there; separate operating location from the booked resource. |
| Quotations | Documents issued for authorized locations. | Own location, validated copy from a deal when applicable; conversion preserves scope. |
| Commercial subscriptions | Contracts owned by authorized branches. | Own commercial location; generated invoices receive that location. |
| Deals | Opportunities owned by authorized branches. | Explicit root location; assignment restriction also applies when enabled. |
| Tasks | Authorized local tasks plus applicable assignment restriction. | Own location for standalone tasks; enforce consistency with an operational parent. |
| Chat/conversations | Explicitly scoped conversations, not every conversation of a visible lead. | Reply within conversation scope; messages inherit it. |
| Records/evidence | Authorized standalone records or records constrained by their parent. | Explicit scope, never arbitrary JSON relations as proof of authorization. |

### 4.2 Shared resources and identity

Shared does not mean unrestricted write access or visibility of all related data.
Do not infer that a customer/resource linked to one non-restricted branch makes
its blocked-branch activity visible. Empty-list compatibility is evaluated separately.

| Resource | Restricted member visibility | Write policy recommendation |
| --- | --- | --- |
| Catalog/categories | Operational fields and applicable items; stock only within authorized scope. | Master catalog changes reserved to owner/admin initially. |
| Price lists/promotions | Applicable prices/promotions for authorized channels/locations. | Central configuration reserved to owner/admin initially. |
| Leads/customers | Minimal identity for customers associated with authorized locations; local history only. | Create/link locally; shared identity edits require explicit authorization. |
| Companies/vendors | Identity needed for authorized documents, not all company transactions. | Shared registry edits require separate authorization. |
| People/assignees | Minimal identity of eligible staff in authorized locations. | No team role, membership, or permission changes. |
| Schedules/calendar availability | Availability required for local operations without private appointment details. | Authorized local availability only; global blocks require central authorization. |
| Campaigns/content/assets/segments | Explicitly shared resources or safely isolated local resources. | Role and declared scope; global publishing/configuration requires central authorization. |

Company rows are currently a global registry, not site-owned branch records.
Customer and company visibility must not expose unrelated histories or grant
cross-site access. Costs/margins and other sensitive catalog fields need an explicit
field-level decision; operational catalog access is not permission to read everything.

### 4.3 Reports and global administration

| Area | Proposed policy for a member with location restrictions |
| --- | --- |
| Sales/cost/inventory/operations reports | Authorized records only, including totals, comparisons, rankings, and exports. |
| CRM reports | Authorized entities/events only; no business-wide denominators. |
| Traffic/social/global AI usage | Deny initially unless trustworthy attribution or a separately approved global permission exists. |
| Accounting source documents/local journals | Full documents only when their complete scope is authorized and accounting checks pass. |
| Consolidated balance sheet/trial balance | Deny in the initial restricted-member implementation. |
| Chart of accounts/opening balances/global accounting synchronization | Owner/admin initially. |
| Team Settings/member permissions | Authorized team managers only; no self-escalation. |
| Workspace billing/credits/payment methods | Owner/admin; separate from commercial customer subscriptions. |
| Integrations/credentials/Security/global agents/workflows/apps | Owner/admin initially; delegated execution requires its own authorization design. |
| Shop/Marketplace/buyer portal/public tokens | Independent public/buyer/token authorization; never implicit internal workspace access. |

Accounting location dimensions already exist on journal lines, but that alone
does not make consolidated reports safe. Do not filter arbitrary lines and present
an incomplete or unbalanced journal as complete. Location financial reporting and
cross-location allocation need a separate accounting contract.

## 5. Day-one data model

### 5.1 Root entities: add an explicit location

| Entity | Proposed field | Reason |
| --- | --- | --- |
| `deals` | `location_id` | Exists before a quote or sale; needs a responsible branch. |
| `quotations` | `location_id` | Independent document lifecycle; copy validated deal location at creation. |
| Commercial `subscriptions` | `location_id` | Contract owner and invoice attribution; not service redemption eligibility. |
| `tasks` | `location_id` | Supports standalone tasks and stable local queries; enforce parent consistency where linked. |
| `conversations` | `location_id` | A customer's different conversations may belong to different branches. |
| `records` | `location_id` | Standalone records and flexible JSON relations cannot infer authorization safely. |
| `reservations` | `operating_location_id` | Existing `location_id` represents a booked location resource and is absent for some employee/service bookings. Visits also use `reservations`; do not duplicate their persistence. |
| `sale_orders` | Canonical commercial `location_id`, if missing | Keep branch ownership separate from physical `origin_location_id`; inspect the target first. |

For independent records that may also be intentionally shared, define an explicit
scope state, conceptually `location`, `shared`, or `unassigned`, alongside the
location relation. Final enum/column names remain an implementation decision.
`NULL` alone must not encode all three meanings. Shared state is allowed only for
approved resource types and must not be an ordinary member's escape hatch.
Compatibility: an empty member restriction list adds no denial to these states.
For a non-empty list, propose hiding operational roots with unresolved location;
this conservative rule requires confirmation and does not apply to legitimate
explicit shared resources. Never strip a known location to bypass restrictions.

### 5.2 Reuse existing fields, do not duplicate them

Existing inspected responsibilities: sales, purchases, expenses/transactions,
inventory, and register shifts use `location_id`; shipments use
`origin_location_id`; journal lines have a location dimension. Some order lines
also have a location field for fulfillment.

Verify these fields and constraints against the target. Their business meaning
must be documented before wiring authorization. A line's inventory/fulfillment
location cannot override or grant access to its parent order.

### 5.3 Many-to-many relations rather than a single location

- `lead_locations`: same-site customer/branch relationships. One customer can
  transact with several branches without duplicating identity.
- `site_member_location_restrictions`: member exclusions; use the membership ID so pending
  invitations and site-specific roles work correctly.
- Catalog/price/promotion applicability and local campaign/content/asset/segment
  targeting may use dedicated many-to-many relations. Reuse existing applicability
  models only after checking integrity and semantics; availability is not edit permission.
- Branch-specific schedules/blocks need a local relation if delegated to branch
  members. Until then, preserve them as centrally managed resources rather than
  exposing private business-wide scheduling data.
- Companies/vendors need authorized relationship/document traversal, not a new
  branch ownership field on a globally shared company registry.

**Customer privacy prerequisite:** RLS filters rows, not automatically columns.
Granting access to a lead row can expose existing global `notes`, attribution,
and other private fields. Split local activity/notes from shared identity or provide
a controlled minimal projection while denying unrestricted base-table reads.
Masking fields only in a React component or one endpoint is not sufficient when
the same user can query Supabase directly.

### 5.4 Children inherit authorization

Quotation items, purchase items, order items/units, messages, payment/refund
records, shipment pings, diagrams, and attachments normally derive access from
their authorized parent. Do not add redundant authorization columns by default.

An attachment or record with several arbitrary links is not automatically a
child: select a canonical protected parent or define an explicit scope. Linking
to one authorized entity must not reveal unrelated linked entities.

For tasks/records that carry their own scope while also having a parent, enforce
same-site and scope consistency. Do not leave two independently editable sources
of truth. Parent changes need a transactional validation of affected children.

## 6. Database and backend enforcement

### Central mechanism, per-entity integration

```text
Team Settings restricted locations
        -> shared authenticated location authorization
        -> per-table RLS / protected parent access
        -> user-scoped queries, details, counts, search, and writes
```

An ordinary `deals` query scoped to `site_id` does not need manual location exclusions
repeated in every screen once its location relation and RLS are implemented.
The database returns only authorized rows. An optional screen filter then narrows
the user's already-authorized set; it never enlarges it.

| Work | Responsibility |
| --- | --- |
| Member restrictions and permission resolver | Shared infrastructure. |
| Root location relation and RLS | Per entity/table, reusing shared functions. |
| Child authorization | Per protected relationship, including direct child reads. |
| Creation/conversion/location changes | Per writer/flow, with common validation. |
| Service-role/RPC/external API/cached response | Per exceptional access boundary. |
| Dropdowns/badges/bulk assignment | Per relevant UI; not the security mechanism. |

### Required safeguards

- Validate trusted identity, effective site membership, action, location, and
  resource before using a server-only service-role client. RLS is bypassed there.
- Every API, Server Action, RPC, and external API is an independent boundary.
  Middleware intentionally does not authenticate `/api/**`.
- Require same-site foreign-key integrity, ideally composite relations using
  site plus entity/location IDs where the target schema supports them.
- Index member restrictions, root site/location lookups, and protected parent joins.
  Measure representative query plans; avoid per-row recursive policy chains.
- Use appropriate RLS `USING` and `WITH CHECK`: an authorized old row cannot be
  moved into an unauthorized location through an update.
- Review every applicable policy and grant. Permissive policies combine with OR;
  adding a restrictive-looking permissive policy can leave an older bypass open.
  Consolidate or deliberately use restrictive policies with tested composition.
- Harden privileged functions with explicit search paths, schema-qualified
  objects, caller validation, and least-privilege execution grants.
- Direct child queries, autocomplete, entity previews, relation joins, counts,
  search indexes, and exports must not disclose unauthorized records or metadata.
- Scope record embeddings/vector retrieval and generated AI context as well as
  ordinary queries. A globally indexed search result is another disclosure path.
- Private storage downloads and signed URL generation must authorize the parent.
  Previously issued URLs may remain usable until expiry; choose bounded TTLs.
- Permission lookup errors deny access. A verified empty restriction set preserves
  existing access; demo IDs, empty UI state, and failed lookups are not that proof.
- Deny unauthenticated/unauthorized API work consistently without exposing raw
  database errors. Direct record lookups may use a consistent not-found response
  to avoid revealing existence; document that contract.

## 7. Creation, conversion, and location ownership

- A child of a verified operational parent inherits that parent's location.
- A root created in an explicit branch context uses a server-validated location.
- For a member with restrictions, ambiguous local creation requires a verified
  non-restricted location. With an empty restriction list, preserve legacy optional
  assignment; do not introduce mandatory fields into every old flow just to enable
  the new permission. Never guess the first location or silently use the site default.
- Never infer permanent ownership from the creator's current permissions: users
  can operate across branches and restrictions can change.
- Online/provider records without a trustworthy branch mapping enter an
  `unassigned` queue; preserve existing access for members without restrictions.
  Members with restrictions use the proposed unresolved-record rule, pending approval.
- Map provider integrations to trusted site/location configuration; do not accept
  arbitrary provider/client location claims as authority.
- Quote -> sale/order conversions and subscription invoice generation propagate
  validated commercial location. Subscription invoice generation currently omits
  it, so adding columns without updating this writer would leave a gap.
- A quotation's location is its document attribution, not a live lookup that changes
  whenever its source deal moves. Validate linked scopes when creating/updating.
- Issued/posted financial documents cannot be relocated through ordinary edits.
  Draft transfers require authorization on both endpoints and audit; accounting
  changes use explicit correction procedures, not silent historical reassignment.
- Commercial ownership, fulfillment origin, and entitlement redemption locations
  are separate dimensions. An entitlement usable at several branches does not
  make its entire subscription/invoice history visible at every branch.
- Multi-branch operations require explicit workflow authority. Initially deny
  complete local-member mutations unless all affected locations are authorized;
  partial views/actions need separately designed safe projections.

## 8. Edge cases and revocation

| Case | Proposed behavior |
| --- | --- |
| Existing members | Zero restriction rows; preserve existing access, role, and assignment rules. |
| Empty restriction list | Valid: no added location denial. Removing the last restriction restores prior scope, not higher privileges. |
| New location | Accessible under existing permissions until explicitly restricted. No automatic future-branch isolation. |
| Unassigned local root | Preserve existing access with an empty list; propose hiding it with a non-empty list until its location is verified. |
| Explicit shared resource | Apply the approved shared-resource policy, not the unassigned policy. |
| Assigned but outside location scope | Denied. |
| Archived location | Preserve historical authorized reads as appropriate; deny new operations according to archival policy. |
| Deleted location | Prefer archival and restrictive deletion; do not cascade away restrictions while surviving records still reference that location. |
| Cross-location transfer | Validate both endpoints before side effects; commit stock movement atomically. |
| Shared customer | Minimal identity only; other branches' notes, balances, conversations, and history remain hidden. |
| Direct URL/search/export/notification | Same underlying authorization as list views. Do not leak labels/previews. |
| Scope changes | Adding/removing restrictions versions/invalidates caches and refreshes browser scope and data. |
| POS offline | Partition and evict local data; revalidate queued writes at sync. Never reroute rejected writes to another branch. |

The server can deny access after revocation, but cannot erase information already
downloaded, exported, photographed, or held by an offline device. Define the
acceptable offline/revalidation window explicitly; immediate offline revocation
cannot be promised. Logout/account/site changes must clear or isolate user data.

User-keyed caches still need a permission revision or equivalent invalidation on
location restriction, role, assignment restriction, and effective membership changes. Check
authorization before returning cached results. Restrict realtime/private channel
payloads and unsubscribe/refresh clients when scope changes; RLS on a table is not
proof that every broadcast channel is safe.

## 9. Recommended delivery plan

This supersedes the earlier narrow first-release idea limited to commerce/POS.
Infrastructure alone would **not** secure Deals or other unintegrated modules.

### First release: cross-module authorization and minimum operational UI

1. Verify target schema, policies, grants, RPCs, public paths, and all writers.
2. Implement atomic restriction sets, invitations, audit, and shared authorization.
3. Add the day-one root fields, customer/branch links, identity privacy boundary,
   same-site constraints, indexes, and explicit unresolved/shared scope semantics.
4. Apply policies to roots and children; integrate privileged APIs, background
   jobs, orchestration/search, reports, storage, caching, and POS sync boundaries.
5. Update creation, invoice, booking, import, and conversion flows to assign scope.
6. Provide minimum location selection/context and Team Settings controls. Advanced
   display filters are optional; safe root creation is not optional.
7. Include commerce, buying, POS, Deals, quotations, subscriptions, tasks,
   conversations, records, reservations/visits, and customer identity isolation.
8. Do not activate restriction editing until included modules enforce exclusions.
   Unsupported private projections may be unavailable only to members with
   restrictions; do not blanket-block unaffected users. Resolve explicit global
   permissions separately instead of silently treating global data as local-safe.

### Follow-up UX and specialized capabilities

- Location badges, richer list filters, authorized bulk assignment, and admin
  reassignment tooling.
- Safely isolated multi-location operations, local marketing resources, advanced
  calendar management, and explicit delegated/global capabilities where approved.
- Branch accounting reports and allocations under a separate financial contract.
- Custom branch-management permissions if the existing operational roles are
  insufficient; do not reuse unrestricted admin as a shortcut.

## 10. Migration, validation, and rollout

- Follow [database migration guidance][migrations]. Use forward-only timestamped
  files later than the existing history; never edit applied migrations.
- Confirm the target and obtain explicit approval before remote migrations or
  deployment. No remote schema has been inspected for this proposal.
- Inventory legacy records and every creation path. Backfill only from verified,
  same-site business relations; never guess from creator membership, address text,
  JSON labels, or the site's default branch.
- Stage additive nullable fields and zero restriction rows with compatible writers.
  The empty-list path must behave like existing access; no new default role/app
  denials, mandatory location choices, or automatic restrictions for current users.
  Validate writes from restricted members so they cannot strip/move scope to evade it.
- Enable restriction editing only after all reachable paths are
  enforced or safely blocked. Test mixed-version clients and external API rollout.
- Provide an authorized review queue for unresolved records, audit backfill
  coverage, and document counts without customer data.
- Prefer forward corrections. Rollback must not mean disabling RLS or restoring
  an overly broad policy; stop affected operations if secure compatibility fails.
- Regenerate schema-facing TypeScript types and run security/performance advisors
  after approved DDL; evaluate indexes and lock/backfill cost before rollout.

### Required test matrix

- Missing session, inactive/pending/rejected/disabled/suspended membership,
  cross-site IDs, role/action denial, owner/admin and empty/non-empty restriction sets.
- Explicitly restricted same-site location, forged/missing IDs, clearing restrictions,
  unassigned/shared state, and failure of the permission resolver.
- Assigned-only plus location AND semantics, including authorized location but
  wrong assignee and correct assignee but wrong location.
- Lists, direct IDs, child-only reads/writes, joins, search/counts, entity previews,
  notifications, storage, vector retrieval, reports, and complete exports.
- Creation/conversion/invoice propagation, draft reassignment, financial
  immutability, multi-location mutations, transfer failure and atomicity.
- Invitation acceptance/resend retaining restrictions, self-escalation attempts,
  concurrent restriction replacement, and disablement/reactivation preserving them.
- Empty-list legacy list/detail/create/update behavior, new-location access by
  default, omitted PATCH versus explicit `[]`, and invalid input/lookup failure
  never silently clearing restrictions.
- Permission changes with warm caches, realtime subscriptions, offline snapshots,
  outbox replays, account/site switches, and archived locations.
- Public/buyer/token workflows remain usable under their own minimal data
  contracts without opening private workspace access.

Use Jest for regression tests and isolated PostgreSQL/non-privileged identities
for actual policy execution. Source-contract tests alone do not prove SQL/RLS
behavior. E2E requires an explicitly selected disposable local/staging target;
do not run mutating role journeys on production.

Existing focused tests passed during exploration (permissions and inventory).
Foundation-specific Jest and isolated PostgreSQL tests are documented in
[the implementation guide](LOCATION_ACCESS_IMPLEMENTATION.md); they do not prove
cross-module enforcement. This documentation is
not a claim of end-to-end enforcement or a migration/deployment authorization.

## 11. Decisions to confirm before implementation

1. Confirm owner/admin exemption and the matrix; restriction-list compatibility
   direction is requested, but new central-management limits are not auto-approved.
2. Confirm one responsible commercial branch per root document, with separate
   fulfillment origin and redemption eligibility.
3. Choose allowed shared resource types and who may create/edit shared identity,
   master catalog/prices, and global marketing configuration.
4. Define assignment semantics per module and conflicts for tasks with several
   parents; verify existing rules rather than assuming "creator or assignee" everywhere.
5. Approve minimal customer identity fields and the local notes/activity model.
6. Confirm unresolved roots stay visible under existing permissions with an empty
   list, but are hidden for members with restrictions; define reassignment and audit.
7. Define offline and signed-link revocation limits and permission-cache freshness.
8. Confirm unsupported projections unavailable only to restricted members versus
   integrated immediately, including requirements, automation, schedules, and reports.
9. Choose migration target, rollout sequencing, legacy data remediation, and
   delegated branch-management permissions if needed.

**Bottom line:** existing access minus explicit restrictions; an empty list preserves
behavior and new locations are not blocked automatically. Add location to roots, normalized
relations for multi-location identity/applicability, and inherited authorization
for children. Centralize the rule, integrate each entity/access boundary once,
and never rely on UI filters to protect data.

[team-card]: ../app/components/settings/TeamMemberCard.tsx
[team-state]: ../app/components/settings/use-team-members.ts
[member-api]: ../app/api/site-members/[siteId]/route.ts
[site-access]: ../lib/auth/api-site-access.ts
[action-access]: ../lib/permissions/site-access.ts
[assigned-sql]: ../supabase/migrations/20260820000000_team_member_restrict_assigned.sql
[inventory]: ../app/inventory/actions.ts
[deals]: ../app/deals/actions.ts
[leads]: ../app/leads/read-actions.ts
[tasks]: ../app/tasks/actions.ts
[orders]: ../app/orders/actions.ts
[migrations]: DATABASE_MIGRATIONS.md