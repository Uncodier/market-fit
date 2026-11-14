# Instance ownership access

## Deployment status

`supabase/migrations/20261113160000_instance_ownership_rls.sql` is a forward-only
correction applied to linked Makinari (`rnjgeloamtszdjplmqxy`) with explicit
approval on 2026-11-13 at 21:26:40 UTC using the canonical schema repository's
local credentials. Exact-source history and catalog checks passed independently.
The subsequent `20261113180000_atomic_catalog_item_requirement.sql` migration
was applied in the same transaction. The matching frontend and quotation Server
Action still require deployment. An unavailable RPC fails closed without the
former nontransactional fallback. Application evidence is in the sibling schema
repository at `supabase/validation/20261113_instance_ownership.md`.

## Contract

- Active members with `restrict_to_assigned_only = true` can access an instance
  only when `user_id` or `created_by` matches `auth.uid()`.
- Site owners and co-owners retain access. Unrestricted active members retain
  their existing access. Every operation also requires `user_can` for that action.
- These are restrictive policies, intersecting existing permissive policies and
  location/procurement guards, not replacing or broadening those guards.
- Logs, artifacts, context state/memories, nodes, pending work, plans, workflow
  runs/triggers, and catalog-item requirement links require a visible same-site
  parent instance. Node-context edges require both endpoints to be visible;
  infrastructure events require a visible parent plan.
- Assets, cloud files/operations, requirement status, remote sessions, automation
  sessions and site secrets keep their established standalone behavior when
  `instance_id` is null. Existing policies still authorize these standalone rows.
  Linked rows require a visible same-site instance.
- Unattributed core children and mismatched/null child sites fail closed. No
  historical attribution is backfilled. Optional API-owned tables are protected
  only when present during migration; later installations must add the guards.
- Browser inserts must attribute both ownership fields to the authenticated
  actor; omitted values are filled by the trigger. Browser updates cannot change
  the instance's site or attribution. Trusted backend/database maintenance roles
  retain their existing behavior; this migration does not authorize service-role
  API calls or audit every privileged RPC/secondary relationship.
- Browser roles lose `TRUNCATE`, `REFERENCES`, and `TRIGGER` privileges on protected
  tables, because row policies cannot enforce non-row operations such as truncate.

## Application compatibility

The Robots SWR key and realtime channel include the authenticated user identity.
Dynamic-quotation creation uses the user-scoped, SECURITY INVOKER
`ensure_catalog_item_requirement` RPC. It locks the authorized item to serialize
callers and creates the actor-attributed requirement, instance, durable link and
status row in one transaction. An RLS-hidden existing link conflicts with the
unique item constraint; the exception block rolls back every insert without
requiring DELETE permission. The response never reveals hidden link identities
or constraint details. Simultaneous successful requests reuse one durable triad.
Existing contexts are reused only when their instance and requirement are visible
in the same site. No service-role fallback or browser-owned attribution is added.

Robots checks authenticated identity, current member status/assigned-only flag and
site capabilities on visible-page focus, reconnection and every 30 seconds.
Confirmed changes advance a unique cache generation, mask old rows and reload
under RLS. Late responses and retired realtime callbacks cannot repopulate the
current generation. Transport failures do not imply revocation. This is freshness,
not authorization or erasure of previously exported data. Reload older tabs after
rollout; open updated tabs detect tightening at the next successful check.
Initial/site/actor permission confirmation reports loading, preventing automatic
instance creation against an unconfirmed empty list. Explicit server `select:
false` is respected even when the role-derived capability parser allows reads.

## Verification and rollout

```bash
npm test -- --runInBand __tests__/robots/instance-ownership-rls.test.ts __tests__/robots/instance-ownership-cache-contract.test.ts __tests__/quotations/catalog-item-requirement-attribution.test.ts
npm test -- --runInBand __tests__/quotations/atomic-catalog-item-postgres.test.ts
npm test -- --runInBand __tests__/robots/permission-cache-behavior.test.tsx
```

The PostgreSQL suite creates a fresh socket-only local cluster using the existing
test helper, never an environment database URL. It tests allowed/denied reads and
writes, forged attribution and parent links, operation permissions, standalone
compatibility, service-role behavior, and migration replay. Tests skip explicitly
when PostgreSQL binaries are unavailable; source/cache tests are not browser E2E.
The atomic quotation PostgreSQL tests additionally cover hidden-link retries,
rollback after status failure, concurrent callers, actor attribution, invoker
security and denied cross-site/anonymous access.
React behavior tests exercise same-user restriction changes, switching actor/site,
late replies, retired realtime events, polling, network failure and unmount cleanup.

Before application, recheck installed optional tables/columns, grants, policies,
and attribution against the confirmed target. DDL uses a five-second lock timeout
and rolls back atomically on failure. After application, verify real employee and
owner sessions, own/foreign direct URLs, logs/artifacts, and non-owner quotation
creation. Deployment, privileged API audit and live browser acceptance remain
separate release gates; do not claim that local tests update the running database.
The invoker RPC's item row lock requires SELECT/UPDATE grants and applicable item
UPDATE RLS, including for reuse. Confirm these for intended callers before rollout.