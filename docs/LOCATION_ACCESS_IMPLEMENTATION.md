# Location access: staged authorization foundations

**Status:** foundation-stage historical notes. The subsequent
[enforcement and member editor implementation](LOCATION_ACCESS_ENFORCEMENT.md)
supersedes this stage. It adds forward-only migrations; the foundation is unchanged.
The full target remains [Location access design](LOCATION_ACCESS_DESIGN.md).

## Implemented boundary

- Forward-only migration `20261020020000_location_access_foundation.sql` adds
  normalized membership/location exclusions, same-site composite foreign keys,
  indexes, protected audit history, and a database-owned disabled rollout gate.
- Existing members receive no restriction rows. No operational table policies,
  role permissions, public/buyer contracts, or legacy records are rewritten.
- `current_user_location_access(uuid)` resolves the authenticated actor's effective
  role, exclusions, and audit revision. Missing/inactive membership and lookup
  failure do not become an empty list. License and manual-deactivation checks
  remain owned by the existing effective-role resolver.
- `user_can_access_location(uuid, uuid)` validates site membership and a real
  same-site location. An empty set permits legacy null scope; a nonempty set
  denies it. Owners/admins are exempt, but cannot authorize foreign locations.
  This predicate is not action, assignment, or resource authorization.
- `replace_site_member_location_restrictions(uuid, uuid, uuid[])` is a protected
  authenticated-manager RPC. It serializes with membership/license changes,
  validates and locks the target and every location, replaces the set atomically,
  and records actor and old/new UUIDs. Pending invitations can own exclusions
  without a linked user ID. Direct browser/service writes are not granted.
  After the site lock, member-row acquisition uses NOWAIT: a concurrent ordinary
  membership update produces SQLSTATE `55P03`, requiring a retry of the complete
  transaction. This avoids a deadlock with the existing BEFORE membership trigger
  (which reaches the site lock after its member row has already been locked).
  Writes require READ COMMITTED; REPEATABLE READ and SERIALIZABLE are rejected
  with `40001` because their fixed snapshots can retain revoked authorization
  after waiting for another transaction's lock.
- `lib/permissions/location-access.ts` composes location and existing action
  permission with AND. It refuses malformed identities and failed RPCs.
  `requireSiteAccess` now accepts an opt-in `location: { id, command }` guard;
  existing callers have not all adopted it. SQL canonicalizes repeated UUIDs;
  the request schema rejects duplicates. Identical replacements are audit no-ops.
- `GET /api/site-members/[siteId]/location-restrictions` requires effective manager
  access and calls `read_site_location_restrictions(uuid)` with the user's session.
  The manager-only RPC returns one scalar JSON snapshot of locations, members,
  effective ownership exemptions, and complete exclusions. It has no application
  service-role client, separate RLS-empty read, or PostgREST row-limit truncation.
  Responses are private and no-store. Owner/coowner exemption is server-derived,
  not inferred solely from the stored member role.
- Team Settings shows a read-only readiness panel. Failed schema/permission reads
  show an unavailable state, never "no restrictions". Site switches abort pending
  loads and cannot display the previous site's configuration.
  Membership changes refresh the panel; nullable legacy location activity displays
  as unknown rather than failing the entire response or falsely labeling it active.
- Restriction PATCH and explicit restriction fields in legacy member POST/PATCH
  fail closed. Valid restriction requests, including `[]`, return
  `409 LOCATION_ACCESS_NOT_READY`; malformed requests return `400`. Omission from
  legacy requests preserves current behavior.
  The dedicated PATCH bounds its body to 64 KiB and rejects excess bytes with 413.

## Why editing remains closed

The design explicitly prohibits activating a dropdown before all included private
boundaries enforce exclusions. Adding the relation or helper does **not** protect
an ordinary inventory, CRM, order, or chat query by itself. This release therefore
does not permit managers to configure operational exclusions.

Both `LOCATION_RESTRICTION_EDITING_ENABLED` and the database rollout gate remain
false. The HTTP PATCH contains no write path, even if a database owner changes the
SQL gate. Neither browser input nor an environment variable can activate it.
Do not flip these gates as a deployment shortcut.

Read-only schema inspection on 2026-10-20 confirmed that Deals, quotations,
commercial subscriptions, tasks, conversations, and records lack a root location;
sale orders expose physical `origin_location_id`, not canonical commercial
`location_id`. Reservations need a distinct operating-location contract. The
checked-in migration is not a complete database bootstrap.

## Required activation work

1. Confirm the design's open decisions: owner/admin exemption, shared identity
   fields, canonical commercial scope, unresolved roots, offline revocation, and
   supported global projections. Foundations do not silently change role policy.
2. Add trustworthy root location fields, same-site constraints, and explicit
   shared/unassigned semantics. Propagate scope through creation, import,
   conversion, invoice generation, booking, and parent changes. Do not infer a
   location from the creator or default branch.
   Inspect `app/deals/actions.ts`, `app/tasks/actions.ts`,
   `app/leads/tasks/actions.ts`, `app/services/chat-conversations.ts`,
   `app/records/actions.ts`, `app/quotations/actions.ts`,
   `app/quotations/dynamic-quote-actions.ts`, `app/commerce/checkout-records.ts`,
   `app/subscriptions/generate-period-invoice.ts` and
   `app/commerce/checkout-finalize.ts`.
3. Apply tested restrictive RLS to every included root and child, with both USING
   and WITH CHECK. Keep existing role/assignment/business restrictions composed
   with AND. Review permissive policy OR composition and public/buyer access.
4. Separate minimal shared customer identity from private notes/activity. A lead
   linked to one permitted branch must not expose its blocked-branch history.
   Existing projections include `app/leads/read-actions.ts` and the privileged
   `app/api/leads/export/route.ts`; adding `lead_locations` alone is insufficient.
5. Integrate every privileged RPC, service-role API, search/export/report,
   orchestration, storage, and multi-location transfer boundary. Unsupported
   private projections must deny restricted members without affecting empty-list
   members. Preserve public/buyer/token authorization independently.
   Review `app/records/lib/record-embedding-worker.ts` external orchestration,
   `app/assets/actions.ts` public attachment URLs, and the independent contracts
   in `app/quotations/public-actions.ts` and `app/catalog/digital-file-actions.ts`.
6. Make permission changes invalidate warm server caches, realtime views, POS
   offline snapshots, and queued writes. Permission resolution must precede a
   cached response. A signed URL or offline copy cannot be retroactively erased.
   The foundation audit revision does not invalidate current caches. Integrate
   `app/orders/actions.ts`, `lib/redis/analytics-response-cache.ts`,
   `app/pos/actions/pull-snapshot.ts` and `app/pos/local/db.ts` explicitly.
7. Add minimum operational location selection and pending-invitation/save
   integration. Acceptance/resend/reactivation must preserve membership-owned
   restrictions; role changes must retain no-escalation guarantees.
8. Validate allowed and denied cross-module journeys on a disposable approved
   target. Only then add a reviewed activation migration and HTTP writer.

### Source integration inventory

- Root writers: `app/deals/actions.ts`, `app/tasks/actions.ts`,
  `app/leads/tasks/actions.ts`, `app/services/chat-conversations.ts`, and
  `app/records/actions.ts`.
- Quote scope: `app/quotations/actions.ts#createQuotationFromDeal`,
  `app/quotations/dynamic-quote-actions.ts`, and `app/commerce/checkout-records.ts`.
- Recurring invoices: `app/subscriptions/actions.ts#createSubscriptionInvoice`,
  `app/subscriptions/generate-period-invoice.ts`, and
  `app/commerce/checkout-finalize.ts`.
- Customer privacy/export: `app/leads/read-actions.ts` and
  `app/api/leads/export/route.ts`; protect global notes and direct table reads.
- Cache/POS: `app/orders/actions.ts`, `lib/redis/analytics-response-cache.ts`,
  `app/pos/actions/pull-snapshot.ts`, and `app/pos/local/db.ts`; current identities
  do not establish a location-permission revision or actor-isolated offline scope.
- Storage/vector: `app/assets/actions.ts#uploadAssetFile` and
  `app/records/lib/record-embedding-worker.ts`; public URLs and service-key
  forwarding are not proof of private parent/actor authorization.

These are source findings, not a complete deployed-policy/bucket/external-server
audit. Cross-module integration must inventory the remaining reachable paths too.

## Validation and deployment

Focused Jest suites:

```bash
npm test -- --runInBand __tests__/lib/permissions/location-access.test.ts __tests__/api/location-restrictions.test.ts __tests__/components/settings/team-location-access.test.tsx __tests__/security/location-access-postgres.test.ts
npm run typecheck
```

The PostgreSQL suite uses a synthetic socket-only local cluster and executes the
actual migration with nonprivileged roles. It never connects to DATABASE_URL or
the remote project. Tests of the replacement RPC temporarily enable its gate
inside that disposable fixture only. They do not authorize production activation.
Coverage includes more than 1,000 exclusions in a single configuration snapshot,
nullable location activity, effective coownership, and the real parent membership
trigger's lock ordering. API tests exercise missing migration, valid legacy PATCH
without new RPCs, and explicit restriction rejection in both legacy write routes.

### Pre-application review (2026-10-20)

Read-only catalog inspection confirmed the foundation migration was not recorded,
its tables were absent, and `current_user_site_role(uuid)` plus
`lock_site_license(uuid)` were present in the configured project. It also confirmed
that `locations.is_active` is nullable. Only the untracked, explicitly unapplied
foundation migration was updated; no historical applied migration was edited.

Review fixes: complete atomic manager read; nullable activity and ownership DTO;
membership refresh; distinct missing-schema state; bounded PATCH input; and
retryable member-lock conflict rather than lock-order deadlock. Existing parent
triggers and operational RLS remain unchanged. Fixed-snapshot write isolation is
also rejected to prevent stale post-revocation authorization. Index creation is transactional,
not concurrent: the five-second lock timeout bounds lock acquisition, not total
index-build duration. Schedule an approved application window based on table size.

No remote migration, deployment, production build, or authenticated browser E2E
is part of this change. The readiness endpoint returns `503` with
`LOCATION_ACCESS_SCHEMA_UNAVAILABLE` when the RPC is missing or unavailable in the
schema cache; the panel displays database setup pending, never an empty list.
Other lookup failures remain a generic unavailable state. Existing member operations remain unchanged when no
restriction field is submitted. Before an approved remote application, recheck
schema drift, locks/index cost, grants, and security/performance advisors using
[Database migrations](DATABASE_MIGRATIONS.md).