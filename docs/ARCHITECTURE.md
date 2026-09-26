# Architecture

## Runtime overview

Makinari is a Next.js 16 App Router application using React 19 and TypeScript.
The same repository contains the authenticated workspace, public storefront and
document surfaces, route handlers, Server Actions, Supabase migrations, and
automated tests.

Primary external boundaries:

- **Supabase** provides PostgreSQL, authentication, storage, and Row Level
  Security (RLS).
- **Stripe** handles subscriptions and commerce payments.
- **External API server** handles robot orchestration and selected integrations.
- **Cloudflare and Vercel** support deployment and custom-domain workflows.

## Repository map

- `app/` — routes, layouts, route handlers, Server Actions, and feature code.
- `app/components/` — shared application components.
- `app/commerce/` — checkout, entitlement, settlement, and post-payment logic.
- `app/api/` — HTTP boundaries. Every route must perform its own validation and
  authorization.
- `lib/` — cross-feature utilities, Supabase clients, authorization helpers,
  and shared types.
- `supabase/migrations/` — ordered database and authorization changes.
- `__tests__/` — Jest unit, integration, regression, and source-contract tests.
- `tests/` — Shiplight YAML E2E tests and agent verification fixtures.
- `specs/` — test specifications and generated coverage artifacts.
- `scripts/` — local operational and test-support scripts.
- `public/` — static assets only; never place secrets or internal docs here.

Prefer colocating feature-specific code below its `app/<feature>/` directory.
Move code to `lib/` only when it is genuinely shared across features.

## Request and authorization boundaries

`middleware.ts` re-exports the canonical implementation in
`app/middleware.ts`. Middleware refreshes browser sessions and protects page
navigation, but it deliberately skips authentication for `/api/**`.
Consequently, every API route is an independent security boundary.

Use these client patterns:

- `createClient()` from `lib/supabase/server.ts` for user-scoped server work.
  It carries the authenticated session and relies on RLS.
- `createServiceClient()` or `createServiceApiClient()` only in server-only code
  after identity, tenant membership, and operation-specific authorization have
  already been verified.
- `requireSiteAccess()` from `lib/auth/api-site-access.ts` for authenticated API
  routes that operate on a supplied site ID. Use `requireManager: true` for
  owner/admin operations.

The service role bypasses RLS. It is not an authorization mechanism, and a
successful login is not proof that the user may access a requested site.
The mutation guard in `lib/permissions/mutation-guard.ts` improves UI behavior;
it is not a server authorization boundary. Demo clients and `demo-*` IDs are
also not evidence of permission.

Prefer the client family under `lib/supabase/`. A second legacy family remains
under `utils/supabase/`; do not introduce another client wrapper or mix cookie
APIs without first consolidating the affected path.

## Public surfaces

Public pages and APIs must expose an explicit data-transfer object rather than
returning a database row. Public document links use opaque tokens and lifecycle
fields (expiry and revocation); see `app/documents/public-token.ts` and the
corresponding timestamped migrations.

Public commerce paths must derive prices and ownership from trusted server data.
Checkout return URLs are restricted by
`app/api/stripe/checkout/checkout-url-security.ts`.

## Payment processing

Stripe checkout creation and webhook settlement are separate trust boundaries:

1. Checkout routes validate the caller, referenced records, trusted prices, and
   return origin.
2. `app/api/stripe/webhook/route.ts` verifies the Stripe signature over the raw
   request body.
3. Database-backed delivery claims serialize retries and prevent duplicate
   event processing.
4. Settlement effects use durable database state so retries do not duplicate
   credits, inventory, entitlements, or related records.

Changes in this area should include focused regression tests under
`__tests__/api/` or `__tests__/commerce/` and a migration when invariants depend
on database constraints or atomic functions.

## Database ownership

The repository stores forward-only SQL migrations in
`supabase/migrations/`. There is no `db:migrate` npm script and no checked-in
Supabase local project configuration. Do not invent a migration command in
automation or documentation; use the deployment workflow approved for the
target Supabase project.

`lib/types/database.types.ts` contains database-facing TypeScript types. Keep
types synchronized after schema changes using the team's established generation
workflow.

## UI conventions

- User-facing interface text is English.
- Reuse components and icon exports already present in the repository,
  especially `app/components/ui/icons.tsx`.
- Do not add direct `lucide-react` usage.
- Keep modules below 500 lines; split by responsibility when a change would
  exceed that limit.

## Workflow relations

The workflow canvas saves each incoming relation on its destination `wf-step`:
`parent_node_id` identifies the source and `settings.relation_context` holds its
label (default `on success`). Clicking the line or its label opens the same
screen-anchored relation editor used by the other graph views, with a searchable
picker for presets and custom labels and a control to disconnect the step.
The external orchestration API copies both into the run plan. `on success` runs
after a completed parent, `on fail` / `on error` after an exhausted failure, and
`always` after either result; an omitted branch is cancelled. Custom text is
passed to the agent alongside the trigger payload and previous step outputs so
it can assess the condition and skip the step without side effects when it does
not apply. A trigger has no failure status, so failure-only relations directly
from a trigger do not run. Existing unlabeled relations behave as `on success`.
