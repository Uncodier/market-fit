# Site archival

## Behavior

Settings → General → Danger Zone provides **Archive Site** to the site's
primary owner (`sites.user_id`). A delegated owner/admin cannot archive it.
The same control replaces the old Context danger-zone button.

Archival retains the site ID, name, ownership, settings, business records and
billing history. It removes the site from active workspace lists and public
shop/booking slug resolution. Its URL is cleared and its allowed-domain
associations are removed, allowing those addresses to be used by another site.
The original URL, tracking settings and domain rows are retained in
`sites.archive_snapshot`; active site API keys are revoked and tracking/chat
flags are disabled. The original name can be retained because shop slug
resolution excludes archived sites, including direct UUID lookups.

No self-service restoration is provided. A future restoration operation must
revalidate reclaimed addresses and cannot simply clear `archived_at`.
Archival does not cancel Stripe subscriptions, refund payments, delete DNS
records, detach robot deployment domains, or terminate external workflows
already running. External service-role consumers must honor `archived_at`;
it is not a global shutdown mechanism for integrations outside this repository.
Existing public marketplace/product/promotion caches may show their previous
content until their 60-second revalidation occurs. New checkout requests check
site state without that cache; already-admitted checkouts are not cancelled.

## Security boundary

`POST /api/sites/archive` accepts only `{ siteId, password }` as JSON. It:

1. Bounds the request body and validates both fields.
2. Authenticates the current session and verifies primary ownership.
3. Applies a per-user limit of five attempts per five minutes using the existing
   Redis control plane, failing closed when admission is unavailable.
4. Checks the password against the authenticated user's server-sourced email
   using an isolated, non-persistent Supabase Auth client. It does not replace
   the browser session or lower its MFA assurance.
5. Calls the service-only `archive_site` RPC, which locks the site, rechecks
   ownership, snapshots routing configuration, and commits the archive,
   domain release and key revocation in one transaction.

Passwords, provider responses and sessions are never logged or persisted by
this flow. OAuth-only users must first set an account password through the
existing account recovery/profile flow; there is no password-free bypass.

The migration denies direct client writes to archive metadata, excludes
archived sites through a restrictive sites RLS policy and the role/list RPCs,
and disables both direct client site deletion and `delete_site_safely`.
Domain writes lock the parent site so concurrent writes cannot recreate an
archived domain association. Duplicate in-flight archive calls are safe: the
RPC retains the first snapshot and returns success once already archived.
Existing-domain updates can take child/parent locks in the opposite order;
the API retries confirmed PostgreSQL deadlock/serialization rollbacks at most
twice. It never automatically replays ambiguous network failures.

## Rollout and validation

Apply `supabase/migrations/20260929221000_archive_sites.sql` through the approved
migration workflow **before** deploying code that queries `archived_at`.
Remote application requires explicit approval; adding the file does not apply
it. Ensure Redis admission and Supabase email/password authentication are
available. Review external consumers before relying on archival to stop work.

Focused checks:

```bash
npm test -- --runInBand __tests__/api/site-archive.test.ts __tests__/api/site-archive-migration.test.ts
# Requires local PostgreSQL tools (initdb, pg_ctl, psql) on PATH.
bash scripts/test-site-archive-postgres.sh
```

The SQL script creates and destroys its own local cluster with no TCP listener.
It tests domain reuse, authorization, RLS, rollback, retries and competing
archive/domain writes. Its minimal fixture is not a complete production-schema
bootstrap; review all production policies and consumers before remote rollout.