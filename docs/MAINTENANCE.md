# Maintenance Guide

## Routine maintenance

### Dependencies

1. Read release notes for Next.js, React, Supabase, Stripe, and test tooling.
2. For Next.js changes, consult the versioned guides in
   `node_modules/next/dist/docs/`.
3. Change dependencies with npm and include the resulting `package-lock.json`.
4. Run focused tests for affected integrations, followed by lint and the
   appropriate broader Jest suite.
5. Treat major framework, auth, database, and payment upgrades as separate
   reviewable changes.

Do not infer runtime versions from badges or prose. `package.json` and the lock
file are authoritative.

### Documentation

Update documentation in the same change when modifying:

- setup commands or Node requirements;
- environment variable names or visibility;
- authentication and authorization boundaries;
- public routes, webhooks, or integration event subscriptions;
- schema migration procedures;
- test commands or directory layout.

Check that every relative link resolves. Keep historical implementation notes
clearly labeled and point readers to the current source or migration.

### Large files

Keep source and documentation files below 500 lines. When a touched file exceeds
that limit, split it by responsibility while preserving its public contract.
Prefer small route handlers that delegate parsing, authorization, and business
logic to independently testable modules.

## High-risk change playbooks

### Authentication or authorization

- Identify browser, middleware, route-handler, Server Action, and database
  boundaries separately.
- Verify unauthenticated, unauthorized, and cross-tenant denial.
- Confirm service-role usage occurs only after explicit authorization.
- Review public paths in `app/middleware.ts`, but do not treat middleware as API
  authorization.

### Payments, payouts, and webhooks

- Map the complete state transition before editing.
- Preserve signature verification, trusted pricing, idempotent delivery claims,
  atomic balance changes, and retry-safe side effects.
- Test duplicate, concurrent, stale, and partially failed processing.
- Verify required migrations are deployed before application code depends on
  new RPCs, columns, constraints, or grants.

### Supabase schema or RLS

- Follow [Database migrations](DATABASE_MIGRATIONS.md).
- Inspect the target schema and existing policies.
- Validate with anon, authenticated, cross-tenant, and service-role contexts.
- Regenerate database types when required.

### Public URLs and outbound fetches

- Preserve token expiry/revocation and minimal response DTOs.
- Preserve origin or hostname allowlists, protocol checks, private-network
  rejection, redirect validation, timeouts, and byte limits.
- Add regression tests before relaxing any restriction.

## Incident-oriented checks

When investigating a production issue:

1. Establish the affected environment, route, tenant, and time range.
2. Preserve request IDs, provider event IDs, and sanitized error details.
3. Do not paste secrets, full webhook payloads, bank details, or personal data
   into issues or documentation.
4. Distinguish code failure from missing migration or configuration drift.
5. Prefer a forward fix with a regression test.
6. Rotate exposed secrets; removing them from source history is not sufficient.

Authentication freezes can occur before a request reaches Supabase. Keep
`onAuthStateChange` callbacks synchronous: use the supplied session, and defer
profile database writes until after the SDK notification returns. Do not await
optional support-chat work in that callback. The sign-in landing checks identity
in the background without hiding the form or clearing sessions on lookup errors.
This does not bypass server authentication or repair a lock held by an older tab.
After deploying an auth-lock fix, close older app tabs and reopen the application.
Regression checks: `__tests__/auth/chat-identity-hook.test.tsx` and
`__tests__/auth/auth-landing-recovery.test.tsx`.

## Handoff checklist

- Summarize behavior changed and security assumptions preserved.
- List files and migrations added or changed.
- Record checks run and their results.
- Call out unrun checks, remote migrations, configuration changes, and manual
  provider steps.
- Leave unrelated working-tree changes untouched.
- Do not commit, pull, push, deploy, apply migrations, or run production builds
  without explicit instruction.
