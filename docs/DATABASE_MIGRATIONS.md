# Database Migrations

Supabase schema and authorization changes are stored as forward-only SQL files
in `supabase/migrations/`.

## Repository constraints

- Migration names use a sortable timestamp prefix:
  `YYYYMMDDHHMMSS_description.sql`.
- The repository does not currently contain a Supabase local `config.toml`.
- `package.json` does not define migration or seed scripts.
- The checked-in directory is not a complete database bootstrap history; core
  tables predate the migrations currently present.
- Applying SQL to a remote project is an external mutation. Never apply a
  migration without explicit approval and confirmation of the target project.

## Creating a migration

1. Inspect the latest migrations and the current remote schema before assuming
   a table, policy, function, or index exists.
2. Choose a timestamp later than every existing migration.
3. Wrap related changes in `BEGIN;` and `COMMIT;` when PostgreSQL permits.
4. Make rerunnable DDL explicit with `IF EXISTS` or `IF NOT EXISTS` where that
   behavior is safe. Do not hide incompatible schema states.
5. Add constraints and indexes that enforce the business invariant, especially
   for money movement, idempotency, ownership, and concurrent claims.
6. Update grants and RLS policies in the same migration as the protected
   object.
7. Add focused Jest contract/regression tests for security-sensitive SQL.

Never edit a migration that may already have been applied. Add a corrective
migration with a later timestamp.

## RLS checklist

For every new Data API table:

- Enable RLS.
- Revoke unintended access from `PUBLIC` and `anon`.
- Grant only required operations to `authenticated`.
- Define policies scoped to `auth.uid()` and the relevant site membership.
- Test owner/manager access, ordinary member access, anonymous denial, and
  cross-site denial.
- Decide explicitly whether the service role needs access.

Do not encode administrative access as `auth.jwt() ->> 'role' = 'anon'`.
`anon` represents unauthenticated access.

## Function checklist

For privileged PostgreSQL functions:

- Use `SECURITY DEFINER` only when required.
- Set `search_path = public, pg_temp` and schema-qualify sensitive references.
- Validate actor identity and resource ownership inside the function, or revoke
  execution from all browser-facing roles.
- Revoke default execution before granting the minimum required role.
- Lock rows or use conditional updates for concurrent state transitions.
- Return only the data required by the caller.

Recent hardened migrations in `supabase/migrations/` provide examples for
payout authorization, Stripe delivery claims, settlement effects, public
document tokens, quotation claims, and record access.

## Verification before application

- Review SQL for destructive operations, long locks, table rewrites, and
  backfill cost.
- Check all referenced columns, constraints, functions, and policies against the
  target schema.
- Verify the migration order and filename uniqueness.
- Run relevant Jest tests. Many migration tests inspect SQL source and do not
  prove that PostgreSQL accepts or executes it.
- Test the migration in an isolated or local database using the team's approved
  Supabase workflow.
- Plan rollback or a forward corrective migration before production rollout.

## After application

- Confirm the migration is recorded once in the target environment.
- Verify RLS and grants using non-privileged identities.
- Exercise both allowed and denied application paths.
- Monitor database and application errors for the affected flow.
- Regenerate `lib/types/database.types.ts` using the team's established process
  when schema-facing TypeScript types changed.

Document the exact deployment command only after the repository has a canonical,
checked-in workflow. Until then, do not copy ad hoc dashboard or CLI commands
into automation.

## Sale order attribution recovery

`20260917220000_sale_order_attribution.sql` backfills the creator before creating
its immutability trigger. If that trigger is already installed, replay can fail
with `P0001: created_by_user_id is immutable` when a POS creator is still null.
This is an existing/partially installed schema or replay scenario, not the normal
first installation. Do not weaken the trigger to allow arbitrary null-to-user
changes, and do not edit the historical migration.

The self-contained forward correction is
`supabase/migrations/20260929224000_repair_sale_order_attribution.sql`. It:

- completes missing attribution columns, indexes, and guards;
- takes an exclusive order-table lock, removes only the two attribution triggers,
  fills missing historical values, and restores the original guards in one
  transaction;
- preserves non-null attribution, restricts backfills to same-site sales/leads,
  and never infers a storefront creator or seller from site ownership;
- retains historical POS cashiers even if they are no longer active members;
  runtime validation remains unchanged;
- leaves RLS, foreign keys, unrelated triggers, and grants in place.

### Operator recovery procedure

1. Confirm the target project and obtain approval before executing remote SQL.
   Inspect its attribution columns, foreign keys, indexes, trigger definitions,
   and `supabase_migrations.schema_migrations` entry for `20260917220000`.
   `IF NOT EXISTS` does not validate incompatible pre-existing definitions.
2. Schedule a maintenance window and pause related writes, including sales/lead
   tenant reassignment. The exclusive lock blocks order reads and writes until
   commit. Lock acquisition times out after five seconds rather than waiting
   indefinitely; review the backfill size before running it.
3. Execute the **complete corrective file** using the approved database-owner
   workflow. Do not run its trigger-removal statements separately. A failure
   rolls back both the data changes and trigger changes.
4. Verify all attribution objects exist, both guards are enabled, populated
   creators remain immutable, and seller/requester validation still rejects
   invalid writes. Audit skipped cross-site links and existing invalid non-null
   attribution separately; this repair does not overwrite historical values.
5. Reconcile migration history using the approved Supabase workflow only after
   schema and data verification. A runner blocked at the original timestamp
   **cannot reach this later correction automatically**. If recovery was applied
   out of order, account for both timestamps before resuming chronological
   migrations. History repair only changes tracking; it does not execute SQL.
   Do not blindly rerun the original: its unconditional updates can still fail
   runtime validation for historical inactive sellers.

The PostgreSQL regression suite is
`__tests__/commerce/sale-order-attribution-migration.test.ts`. It starts a new
socket-only cluster and never uses a configured database URL. Run it with
`npm test -- --runInBand __tests__/commerce/sale-order-attribution-migration.test.ts`.
It uses `/opt/homebrew/opt/postgresql@17/bin` by default; set
`ATTRIBUTION_TEST_PG_BIN` to another local PostgreSQL binary directory if needed.
The live cases are explicitly skipped when those binaries are unavailable.
