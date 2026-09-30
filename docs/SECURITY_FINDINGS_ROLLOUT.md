# Critical Flow Security Corrections

## Scope

This patch addresses the purchase authorization, webhook visibility, and task
reordering findings from the post-TypeScript-repair audit. These findings were
confirmed against read-only deployed catalog metadata and synthetic local
reproductions, not established as regressions introduced by the TypeScript work.

No remote migration or payment operation was executed while preparing this
patch. Apply only through the deployment workflow approved for the intended
project, after validation in a disposable/staging environment.

## Migration order

All files are under `supabase/migrations/`. Apply each complete file in order:

1. `20260930000000_restrict_webhook_event_access.sql`
   - Removes browser/anonymous table and column grants and the user-read policy.
   - Keeps delivery events, including site-associated events, backend-only.
   - Preserves claim/complete/fail/cleanup function bodies and service execution.
2. `20260930000100_harden_purchase_permissions.sql`
   - Replaces membership-only policies with per-command `user_can` checks.
   - Removes anonymous grants and authenticated `TRUNCATE`/DDL-related privileges.
   - Checks each line's parent/site relationship in RLS.
   - Replaces the single-column purchase foreign key with a composite
     `(purchase_id, site_id)` foreign key, preserving `ON DELETE CASCADE`.
   - Keeps exactly one purchase relationship so existing PostgREST nested
     `purchase_items(...)` queries remain unambiguous.
3. `20260930000200_harden_task_reordering.sql`
   - Preserves the deployed `(uuid, integer, text, uuid) RETURNS void` signature.
   - Validates identity, update permission, task/site pair, status and position
     before any task update or update-trigger side effect.
   - Serializes same-site RPC calls using a transaction advisory lock and locks
     visible rows before renumbering, retaining caller-scoped RLS and triggers.
   - Grants execution only to `authenticated`; no repository service consumer
     was found. Confirm any external consumers before rollout.

The application fix changes the incorrect named argument to `p_new_position`
and types the PostgreSQL `void` result as `undefined`. It works with the deployed
signature both before and after the corrective RPC migration.

## Prerequisites and compatibility

- The core schema is pre-existing; these files are not a fresh database bootstrap.
- `public.user_can(uuid,text)` and `current_user_site_role(uuid)` must implement
  the active-membership capability matrix from
  `20260825160000_fix_site_role_and_delete_caps.sql`, retaining the newer archived-site
  denial from `20260929221000_archive_sites.sql`. Do not revert either helper.
- The Stripe claim functions and status correction from
  `20260917210100_stripe_webhook_delivery_claims.sql` and
  `20260925000000_fix_webhook_events_status_constraint.sql` must already exist.
- Keep the existing accounting migrations, especially
  `20260929220500_accounting_purchase_items.sql`, installed. Collaborators cannot
  directly delete items, but this explicitly authorized atomic update RPC can
  replace an item set after checking `user_can(site, 'update')`.
- Verify existing policies against the audited baseline. Unexpected additional
  purchase/webhook policies cause the whole respective migration to fail rather
  than leave an alternative permissive policy open or remove an unknown policy.
- The purchase/webhook migrations use a five-second lock acquisition timeout.
  Purchase index/constraint DDL takes table locks; use a low-traffic window and
  review table sizes. A lock timeout rolls back that file; do not remove timeout
  protection as a workaround without reviewing the blocking transactions.
- Existing financial rows are not rewritten or deleted. The composite foreign
  key is initially `NOT VALID`: new relationships are enforced immediately,
  historical inconsistencies are retained and hidden from ordinary item reads.
  Complete the validation step below before declaring historical integrity clean.
- No direct application reader of `webhook_events` was found. External tools
  using an ordinary user session must move to an explicitly authorized backend;
  never expose a service key in the browser to restore access.
- Purchase actions now validate real server identity and operation permissions;
  stale sessions, inactive members, forged IDs and demo mutations are rejected.
  Global vendor companies are looked up by ID under RLS (they have no site column).
- The selected demo bill list retains its existing in-memory read-only behavior.
  Its requested demo ID must match the demo cookie and an existing demo fixture;
  this path cannot use a real client or authorize any mutation or real-site read.

## Read-only preflight

Run using an approved administrative connection to the selected target, not an
ordinary user whose RLS view could hide inconsistencies. The implementation audit
did not run the financial-data query below remotely.

```sql
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('purchases', 'purchase_items', 'webhook_events', 'tasks')
ORDER BY tablename, policyname;

SELECT count(*) AS inconsistent_purchase_item_relationships
FROM public.purchase_items i
LEFT JOIN public.purchases p ON p.id = i.purchase_id
WHERE p.id IS NULL OR i.site_id IS DISTINCT FROM p.site_id;
```

If the count is nonzero, review those relationships privately and prepare an
approved, auditable data correction. Do not delete lines or copy a tenant ID
blindly to make validation pass. The permission migrations can still close the
access gaps without automatically repairing historical data.
Do not delete headers with inconsistent historical children before reconciliation:
the new composite cascade matches both purchase and site, so an old mismatched
line would not follow a header deletion and could become orphaned.

## Foreign key validation (separate authorized step)

After the preflight count is zero, validate on the chosen target and record the
result in the deployment record. This is a remote schema mutation, not part of
the read-only checks:

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.purchase_items
  VALIDATE CONSTRAINT purchase_items_purchase_site_fkey;
COMMIT;
```

The corrective migration is safe to rerun after validation and does not reset
the validated state.

## Verification

Patch validation completed locally:

- `npm run typecheck`: passed, including Next.js route generation.
- Expanded critical-flow/regression selection: **136 suites, 1,475 tests passed**,
  no failed or skipped tests. This was not a rerun of every repository Jest suite.
- Targeted ESLint on edited TypeScript/tests: passed with no errors or warnings.
- All three migrations executed in disposable PostgreSQL 17, including reruns,
  role denials, allowed paths, rollback behavior and concurrent task/Stripe calls.
- Independent read-only review and the demo-list follow-up found no remaining
  introduced blocker in the scoped corrections.
- Remote deployment, authenticated browser E2E and live PostgREST embedding were
  not performed. Local clusters were stopped after testing.

Local commands (from the repository root):

```bash
npm test -- --runInBand __tests__/security/purchase-rls.test.ts __tests__/security/webhook-visibility.test.ts __tests__/control-center __tests__/purchases
npm run typecheck
```

The SQL suites create synthetic, socket-only PostgreSQL clusters and never use
a configured `DATABASE_URL`. Local binaries default to
`/opt/homebrew/opt/postgresql@17/bin`; override `SECURITY_TEST_PG_BIN` and
`REORDER_TEST_PG_BIN` for other local installations. Missing binaries explicitly
skip live cases: skipped cases are not proof that the migrations execute.

The purchase fixture uses actual repository capability functions, item-update
RPC and relevant accounting freshness/receipt trigger bodies. The reorder
fixture retains the deployed RLS expression, models the task permission trigger
branch and uses transactional probes instead of outbound workflow webhooks.
Neither fixture is a complete production clone or a live PostgREST/browser test.

After applying, verify with dedicated staging identities:

| Identity | Purchase reads | Create/update | Delete/unpublish |
| --- | --- | --- | --- |
| Owner/admin | Allowed | Allowed | Allowed |
| Collaborator | Allowed | Allowed | Denied |
| Marketing | Allowed | Denied | Denied |
| Inactive/foreign/anonymous | Denied for target site | Denied | Denied |

- Test direct table access as well as Server Actions; UI hiding is not authorization.
- Confirm all ordinary-user webhook access is denied, while backend delivery
  claims, failure/retry, replay and stale-token fencing still work.
- Exercise nested purchase/item queries and collaborator atomic item replacement.
- Invalid reorder inputs must fail without changing any tasks. Confirm successful
  owner/collaborator moves and concurrent same-site RPC calls.
- Assigned-only members reorder only their RLS-visible tasks. Hidden rows are
  unchanged; priorities are not guaranteed globally unique across different
  visibility scopes. Direct task writers that do not use the RPC do not acquire
  its advisory lock; global ordering across those paths is outside this patch.
- Confirm login, bill/PDF reads and Stripe test-mode flows with the approved
  browser target, site UUID and buyer fixtures. No saved legacy session or real
  payment is required or authorized by these instructions.

## Failure handling

Each migration is transactional and sends a PostgREST schema reload notification
on commit. If one file fails, stop and inspect its error and the installed state;
earlier successfully committed files remain applied. Record application through
the team's migration tracking workflow.

Do not roll back by restoring the permissive policies or granting browser access
to internal events. Prefer a new forward correction. App rollback does not undo
the database access fixes; the old mismatched RPC argument would still fail and
must not be restored as a deployment workaround.