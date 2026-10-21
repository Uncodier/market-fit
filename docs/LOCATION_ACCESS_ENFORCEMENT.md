# Location access enforcement and member management

## Implementation status

The member editor and operational location authorization are implemented in
source. Deployment and remote migration application are separate, explicitly
approved steps. The previous read-only readiness panel is removed.

Team Settings shows **Location access** inside each member card, using the same
collapsible panel, count/preview header, and toggle chips as **App access**.
Chips with an X mark restricted branches; click again to allow a branch. Empty
sets start collapsed, and saved restrictions start expanded. Managers can use
**Restrict all** / **Allow all** for the full branch list, regardless of search.
Owners/admins are exempt. Managers can search branches, mark excluded branches,
and save the set through the authenticated atomic membership RPC. Pending and
suspended memberships retain exclusions. Allow every branch to remove the
additional denial; role, screen, assignment, and license restrictions remain.
New branches are accessible under existing permissions until explicitly excluded.

The member card footer has the only **Save** action. Location-only edits enable
it; combined edits save the verified location draft first, then member details.
These are separate authenticated requests, not a cross-endpoint transaction.
Location failures retain the draft and prevent the detail write. A confirmed
location save is not replayed if the detail write fails; partial failure is shown
explicitly. Inactive member cards retain this footer for location edits too.
Changing the draft role locks further location editing until the role is saved,
but an existing location draft is saved under the persisted role first.

Both UI and database use the server-owned `editing_enabled` gate. Foundation-only
databases return false; requests do not activate the gate. Unknown, missing,
malformed, unauthorized, timed-out, or ambiguous save responses never become
successful empty restrictions. Only SQL-confirmed rollback conflicts retry, at
most three attempts. Unconfirmed saves require a fresh read before retrying.
Saves include the previously read exclusion set. The checked RPC compares that
set under the membership lock and returns a non-retryable conflict if another
manager changed it. The old unchecked RPC is no longer executable by authenticated
clients, so concurrent tabs cannot silently overwrite new restrictions.

## Operational data rules

- Roots have typed, same-site location relationships. Canonical `location_id` is
  distinct from order/shipment fulfillment origin and reservation resource IDs;
  reservations use `operating_location_id`.
- Root coverage: locations, inventory, Deals, quotations, commercial subscriptions,
  tasks, conversations, records, sale orders, sales, purchases, transactions,
  register sessions, and shipments.
- Children inherit their parent's RLS: quotation/order/purchase lines, order units,
  messages, task comments/categories, deal owners, shipment pings, invoice reminders,
  refunds, and register movements/receipts. Populated parent links compose with
  AND; a permitted child location never authorizes a blocked parent.
- Restrictive policies compose location with existing membership, assignment,
  business, and action permissions. New tenant/location writes are constrained by
  composite foreign keys. No UI filter is an authorization boundary.
- Records without a resolved branch remain unchanged for members without
  exclusions. Restricted members cannot read them. No branch is inferred from a
  creator, default location, or arbitrary JSON.
- The record-assignment screen and its Team Settings button are temporarily
  hidden. Direct visits to `/settings/location-access` redirect to
  `/settings?tab=team` without mounting the editor or loading operational records.
  Member location restrictions remain available. The reusable assignment editor,
  authenticated API, and database logic are retained for later reactivation.
  The manager-only RPC allows initial null-to-known assignment, not arbitrary
  historical reassignment. Parent scopes must agree.
  Known scopes are immutable through direct DML too, including service-role DML.
  Connected unresolved parents/children cannot be assigned individually if that
  would violate their shared scope; they require an explicit atomic graph-remediation
  operation, which is not implemented by this UI.
- Quote creation inherits the same-site Deal; commercial invoice generation
  inherits the subscription. Quote checkout keeps canonical scope separate from
  fulfillment. Recurring subscriptions inherit the persisted order scope.
- Inventory transfers are a single authenticated transaction that verifies both
  branches and the same-site product. There is no sequential fallback that can
  decrement source stock before a blocked destination fails.

## Unsupported private projections

Global reports, private customer notes/attribution, CRM identity associations,
automation/AI context, unscoped exports, social integrations, repositories,
and other opaque projections are unavailable to restricted actors until they
have a reviewed minimal or location-scoped projection. In particular, marking
one location does not make a globally stored lead's notes safe to share.

Unknown authenticated public-schema tables and privileged RPCs default to denial
for restricted actors. Existing SECURITY DEFINER bodies are isolated behind
guarded entries in a non-exposed schema; original signatures/defaults/grants are
preserved. Approved permission predicates remain callable. Views cannot bypass
base-table protection. Private storage enumeration/signing/mutations are denied
to restricted actors until parent-scoped attachment authorization exists.

Existing broad anonymous private table/RPC access is separately closed. Logging
out cannot become a workaround for location exclusions. Legitimate storefront,
buyer, payment-webhook, and public-token handlers retain their independent
authorization; server-owned public/system access modes must never be supplied
by request input. Personal buyer queries filter the authenticated buyer identity.

Private service transports revalidate the current actor's global restriction
state before every outgoing database request. Private API/proxy helpers also
verify scope before caches or external credentials. Missing restriction RPCs fail
closed. Deploy this code together with all enforcement migrations.
Ownership-relation writes are restricted to the primary site owner in addition
to existing policies. A member cannot make themselves a co-owner to gain the
owner exemption. Existing ownership rows are preserved and need administrative
review if they were created under the former permissive policies.

Checkout and webhook follow-ups reuse their already authorized clients. Shipment
creation has a server-only helper; its public Server Action never accepts a
service-role escalation flag. Public invoice/order token readers and reservation
availability explicitly use their independent public contract. Availability
errors are not interpreted as zero occupied capacity.

Public dynamic quote intake now requires a confirmed authenticated buyer. It
creates only a new own-buyer quote from a published dynamic product, never accepts
private quote/deal/lead IDs, and never returns raw agent logs. Advanced quoting
that requires shared seller robot context remains a contact-seller flow. This is
a deliberate safety limitation, not a mock quotation.

## Cache, realtime, and device limits

Order and line cache lookups recheck membership and restrictions first. Restricted
queries bypass older unrestricted cached projections and execute under RLS.
The browser observes the server-owned role/audit/exclusion fingerprint on focus,
reconnect, visibility, and a 30-second interval; a change resets the document and
in-memory projections. This is bounded freshness, not instantaneous remote erasure.
Confirmed revocation errors also discard a warm snapshot. A stalled refresh has
an eight-second deadline and cannot permanently disable later checks. Per-site
unscoped authorization treats missing or revoked membership as denied rather than
mistaking an empty exclusion set for membership.

POS is not yet a reviewed location-scoped offline projection, so it is unavailable
to excluded members. Before POS hooks can hydrate catalog, drafts, or queues,
the page verifies the actual actor, effective site role, and site/global restriction
predicates online. Offline/unknown access locks the database and unmounts the
workspace; no saved permission marker is an offline grant. Freshness has a
30-second refresh and an 8-second verification deadline.

The device ownership marker preserves work only for the same verified actor,
site, and role. Account/site/access changes purge private POS tables, drafts, and
unsubmitted queues. Late local writes and sync results are fenced by the grant
generation. Check server orders/payments before retrying a previously submitted
but unconfirmed transaction. Exported files, screenshots, signed URLs, and copies
already held by a user cannot be erased retroactively by ACL.
Checkout attempt identities survive permission-driven component remounts and
are rotated only with the explicit cart lifecycle. Deferred local writes recheck
the grant and current cart before clearing it. Lease expiry also uses monotonic
time; changing the wall clock cannot extend a grant. IndexedDB operations are
checked inside active transactions, which are aborted on revocation.

## Migration order and rollout

Do not edit or replay an already applied foundation migration. Apply the new
timestamped files in this order using the team's approved workflow:

1. `20261020030000_location_enforcement_scope.sql`
2. `20261020030001_location_enforcement_relations.sql`
3. `20261020030002_location_enforcement_policies.sql`
4. `20261020030003_location_enforcement_rpc_boundary.sql`
5. `20261020030004_location_enforcement_writers.sql`
6. `20261020030005_location_enforcement_private_anon.sql`
7. `20261020030009_location_enforcement_ready.sql`
8. `20261021010000_location_acl_ownership_boundary.sql`
9. `20261021010001_location_scope_write_guards.sql`
10. `20261021010002_location_relationship_consolidation.sql`
11. `20261021010003_location_restrictions_checked.sql`
12. `20261021010004_location_records_insert_and_readiness.sql`

Prerequisite: `20261020020000_location_access_foundation.sql` must already exist.
The original ready migration publishes editing readiness; the five review
corrections are mandatory before using it. Keep the application/manager editor
unavailable throughout this maintenance window; do not expose the intermediate
ready state. The last correction verifies required guards, checked writer, and
ownership protection. Pair the completed set with the application deployment; do not open it
against an older application with unguarded service/proxy routes. Freeze restriction
editing during deployment and confirm allowed/denied identities before enabling
normal manager usage. No migration was applied by the coding agent.

The directory is not a complete database bootstrap, and remote migration history
does not necessarily reflect earlier manual schema changes. Before application,
inspect the approved target's actual schema, functions, grants, and old FK lifecycle
semantics. These migrations intentionally fail on incompatible drift. Transactional
index/FK creation holds locks; five-second lock acquisition timeouts do not bound
total index-build time. Use an approved maintenance window.
The relationship correction consolidates redundant public FKs while retaining
legacy names and delete behavior. Reservation resource vs operating location are
intentionally distinct; consumers explicitly select the resource relationship.

Do not include unrelated billing or licensing migrations just because their files
are pending in the same working tree. Those belong to their own rollout.

### Step 3 coordinator-table ownership failure

The initial step 3 attempt on Makinari failed on `apps_migration_feedback`, which
is owned by `apps_migration_coordinator`, not `postgres`. Read-only inspection
confirmed that no `location_acl_*` policies were installed, the RPC guard was
absent, and the table already had RLS with no table/column privileges for `anon`
or `authenticated`. The still-unapplied step 3 and step 6 files now preserve that
specific infrastructure table only after checking its owner, enabled RLS, lack
of effective browser grants (including PUBLIC/inheritance), and absence from the
operational root/link registry. Any drift aborts rather than silently bypassing
location enforcement. Other foreign-owned tables are not exempted.

For this failed rollout, use the updated complete step 3 file, then continue
steps 4–12 in order, including the updated step 6. Do not replay steps 1–2 or the
foundation. If the SQL session remains in an aborted transaction, end it with
`ROLLBACK` before retrying. Keep the application/editor unavailable throughout.
These are unapplied-file corrections, not permission to edit or replay migrations
that have succeeded elsewhere; those environments need a forward-only review.
Do not change coordinator ownership, grant its role to `postgres`, disable RLS,
or swallow ownership exceptions. `storage.objects` still receives its restrictive
policy through Supabase's supported policy path; it is not excluded.

## Verification

Focused coverage includes real socket-only PostgreSQL policy execution, parent and
child denial, action/assignment AND composition, cross-site keys, anonymous logout
bypass, RPC quarantine and outputs, warm permission changes, atomic transfer,
manager assignment, successful member saves, timeout/ambiguity, and device scope
invalidation. No remote production writes are used by these tests.

```bash
npm test -- --runInBand __tests__/security/location-enforcement-postgres.test.ts __tests__/api/location-restrictions.test.ts __tests__/components/settings/team-location-access.test.tsx __tests__/location-scope-api.test.ts __tests__/pos/use-pos-location-access.test.tsx
npm run typecheck
```

Review regression tests also execute real IndexedDB in a synthetic Chromium page,
not the application or a production account, to verify transaction fencing.
Jest/local PostgreSQL do not prove a deployed application or external-server rollout.
Live role journeys require an explicitly selected disposable environment. Run
security/performance advisors after approved application, and verify nonprivileged
allowed and denied queries before concluding production readiness.
