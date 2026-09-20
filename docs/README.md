# Repository Documentation

This directory contains operational documentation for the Makinari application.
Use the guides below before relying on older implementation notes.

## Start here

- [Development](DEVELOPMENT.md) — local setup, scripts, tests, and validation.
- [Architecture](ARCHITECTURE.md) — runtime boundaries and repository layout.
- [Security](SECURITY.md) — mandatory controls for auth, data access, payments,
  public links, webhooks, and outbound requests.
- [Database migrations](DATABASE_MIGRATIONS.md) — safe Supabase migration workflow.
- [Environment variables](ENVIRONMENT_VARIABLES.md) — configuration by subsystem.
- [Maintenance](MAINTENANCE.md) — dependency, documentation, and release hygiene.
- [`specs/context.md`](../specs/context.md) — browser-test routes, roles, targets,
  and data assumptions.

## Integration guides

- [Stripe setup](STRIPE_SETUP.md)
- [Stripe environment variables](STRIPE_ENVIRONMENT_VARIABLES.md)
- [Stripe webhook security](STRIPE_WEBHOOK_SECURITY.md)
- [Social network OAuth](SOCIAL_NETWORK_OAUTH_SETUP.md)
- [Google authentication](GOOGLE_AUTH_SETUP.md)
- [Magic links](MAGIC_LINKS_SETUP.md)
- [Secure Tokens API](../app/api/secure-tokens/README.md)

Integration guides explain setup details, but the code and migrations remain the
source of truth for implemented behavior. Revalidate event names, routes, and
environment variables before changing production configuration.

## Architecture reviews

- [Redis/Upstash availability and self-amplification audit — 2026-09-20](REDIS_UPSTASH_AVAILABILITY_AUDIT_2026-09-20.md)

## Implementation notes

The following documents record specific implementations. They are useful
background, not canonical architecture or security policy:

- `HTML_CLEANING_SOLUTION.md`
- `LOGGING_SYSTEM.md`
- `NAVIGATION_HELPERS.md`
- `PERFORMANCE_OPTIMIZATIONS.md`
- `REFRESH_PREVENTION_IMPLEMENTATION.md`
- `RLS_SECURITY_FIX.md`
- `WEBHOOK_IDEMPOTENCY.md`
- `WORKFLOW_RESPONSE_DETECTION_EXAMPLE.md`

Some implementation notes predate the current code. When they conflict with
tests, timestamped files in `supabase/migrations/`, or the current
implementation, follow the latter and update the note in the same change.

`WORKFLOW_WEBHOOK_INTEGRATION.md` and
`WORKFLOW_RESPONSE_DETECTION_EXAMPLE.md` are explicit retirement markers for a
route that no longer exists. Keep them only while external links may still
reference those paths.

## Documentation conventions

- Write repository documentation and code examples in English.
- Prefer links to source files over copied implementation blocks.
- Document commands exactly as they appear in `package.json`.
- Never include real credentials, customer data, internal access tokens, or
  production-only URLs that are not already public configuration.
- Date-sensitive implementation notes should identify the migration or source
  file that establishes the behavior.
- Update this index when adding, renaming, or retiring a guide.
