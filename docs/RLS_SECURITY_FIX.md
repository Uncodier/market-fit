# Historical RLS Security Note

This file previously described a one-time RLS repair for `synced_objects`,
`system_memories`, and `whatsapp_templates`. It is retained only to prevent old
links from presenting obsolete policy as current guidance.

Do not use the previous examples. In particular, the Supabase `anon` role is
unauthenticated and must never receive administrative access.

Current sources of truth:

- [Security guide](SECURITY.md)
- [Database migration guide](DATABASE_MIGRATIONS.md)
- timestamped SQL in `supabase/migrations/`
- the policies, grants, and functions in the target Supabase environment

Before changing RLS:

1. Inspect the current table grants and policies.
2. Define the intended anon, authenticated, tenant-member, manager, platform
   administrator, and service-role behavior.
3. Add a new forward-only migration; do not edit an applied migration.
4. Revoke broad defaults before granting the minimum access required.
5. Add regression tests for anonymous and cross-tenant denial as well as valid
   access.

The repository no longer contains the migration path cited by the old document,
`migrations/fix_rls_missing_tables.sql`. Do not recreate or apply it from
historical prose.
