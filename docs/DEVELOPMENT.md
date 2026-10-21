# Development Guide

## Prerequisites

- Node.js 22 or newer, as declared in `package.json`.
- npm for the commands documented below.
- Access to the required Supabase project and any external services needed by
  the feature being developed.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The application listens on `http://localhost:3000`. The external orchestration
API defaults to `http://localhost:3001` where a feature provides that fallback.
See [Environment variables](ENVIRONMENT_VARIABLES.md) before exercising auth,
database, payments, email, integrations, or authenticated E2E tests.

Finder requests from the browser use the authenticated same-origin
`/api/finder/**` route. The web server forwards only the signed-in user's token
to the configured API server (`API_SERVER_URL`, falling back to
`NEXT_PUBLIC_API_SERVER_URL`); both servers must be running to load saved
lists or search. A `401`/`403` from the backend remains an access error, not an
empty list. The saved-list sidebar itself reads from Supabase under the user's
session.

Both `package-lock.json` and `yarn.lock` are currently checked in, and no
`packageManager` field selects one as authoritative. The documented commands use
npm, but do not update dependencies or regenerate either lockfile until the
repository owner confirms the package-manager policy.

## Available scripts

The exact script definitions live in `package.json`:

```bash
npm run dev
npm run dev:webpack
npm run lint
npm run lint:fix
npm run typecheck
npm test
npm run test:watch
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:validate
npm run test:e2e:report
npm run agent:verify
npm run test:magic-links
npm run test:api-invitations
```

`npm run build` and `npm run start` also exist, but do not run a build as routine
validation unless the task or release process explicitly requires it.

`npm run typecheck` generates Next.js route definitions and checks all authored
TypeScript, including tests, without building the application. Strict checking
remains enabled. The ES2018 target matches the modern browsers supported by
Next.js 16; JavaScript bundling remains Next.js's responsibility.
Production builds use Next.js's default type-error gate; do not restore
`typescript.ignoreBuildErrors` to bypass it.

ESLint loads the Next.js and TypeScript rule sets from `eslint.config.mjs` and
includes authored tests. It excludes generated output, not application modules.
The repository has existing lint debt; targeted `npx eslint <changed-files>`
separates touched code from unrelated findings. Do not disable rules or exclude
source files to make a check appear clean.

The TypeScript and compiler-contract CI workflow runs without database, payment,
or browser credentials. Its Server Action regression test invokes the installed
Next.js compiler because the normal Jest transform skips Server Action export
validation.

There are no `db:migrate` or `db:seed` npm scripts.

## Test layout

- `__tests__/**/*.test.ts?(x)` — Jest tests selected by `jest.config.js`.
- `tests/*.yaml.spec.ts` — generated Shiplight/Playwright test files.
- `tests/**/*.test.yaml` — source Shiplight YAML scenarios.
- `tests/agent/` — agent verification cases and runner support.
- `specs/` — behavioral specifications and coverage reports.

Jest defaults to jsdom and `jest.setup.js` installs global mocks, including
navigation, images, and fetch behavior. Node-only suites should declare
`@jest-environment node`; tests that need real fetch semantics must replace the
global mock deliberately.

The Stripe idempotency suite uses an isolated SDK transport and the current
claim/complete/fail delivery contract. It does not connect to a database or run
cleanup SQL. Any future live database test must be a separately authorized,
disposable-target suite, not part of the default Jest command.

Run a focused Jest test:

```bash
npm test -- --runInBand __tests__/path/example.test.ts
```

Run the complete Jest suite:

```bash
npm test -- --runInBand
```

Authenticated E2E setup requires explicit target/site configuration and dedicated
account credentials. The default E2E command selects a read-only smoke, not CRUD.
See [E2E execution and evidence](E2E_TESTING.md) for suites, environment gates,
fixture requirements, reporting commands and known blockers.

Shiplight CRUD suites create, update, and delete real records. Run E2E or agent
verification only against an explicitly approved disposable target. Generated
`*.yaml.spec.ts` files should not be edited by hand.

## Change workflow

1. Inspect adjacent implementations and tests before editing.
2. Confirm framework behavior in `node_modules/next/dist/docs/` before changing
   Next.js APIs or conventions.
3. Keep the change within one feature boundary when possible.
4. Add or update focused regression tests.
5. Run the focused test, then lint the changed files or repository.
6. For schema changes, follow [Database migrations](DATABASE_MIGRATIONS.md).
7. For auth, payments, public data, file proxying, or service-role changes,
   complete the checklist in [Security](SECURITY.md).
8. Update documentation when commands, configuration, routes, or invariants
   change.

## Coding conventions

- Code, comments, prompts, and user-facing UI are English.
- The project uses TypeScript with strict mode and the `@/*` path alias.
- Tests use Jest and ES module-compatible imports.
- Reuse existing UI components and `app/components/ui/icons.tsx`; do not add
  direct `lucide-react` usage.
- Keep files below 500 lines by extracting cohesive helpers, components, or
  hooks.
- Do not replace real backend behavior with mock API responses. Test doubles
  belong in tests and must model the real contract.

### Persisted date filters

Orders stores `{ startDate, endDate, preset }` under its existing site-scoped
`orders-date-range:<siteId>` key. The shared picker callbacks include the selected
preset as their third argument; calendar selections emit `custom`, even when the
dates happen to match a relative preset. Preserve this argument when caching a
filter instead of inferring its meaning from date equality.

`usePersistentDateRange` restores relative bounds using the current local day and
locale, refreshes them at midnight and on tab focus/visibility, and gates data
requests until restoration completes. The default is 30 inclusive days. Custom
and legacy date-only ranges remain fixed; clearing stores `null`. An old saved
range needs an explicit preset selection once to become relative. Reuse this
hook and `lib/dates/date-range-presets.ts` when adding persistence to other screens;
response caches such as SWR do not persist filter selection by themselves.

### POS order selection

The POS picker restores complete, site-scoped order snapshots from its existing
IndexedDB catalog cache without calling the general order-detail action. Open-order
reads include line IDs, stored unit prices, modifier metadata and parent links.
Legacy description-only snapshots prefill customer and order fields. Selecting an
existing ID enables the payment dialog immediately; its preparation state blocks
confirmation until `getPosOrder(siteId, orderId)` returns usable lines. That
fallback uses one authenticated, RLS-scoped order query rather than loading
shipments, requestors or attribution profiles. Stored line prices use the order
currency, not the catalog item's current currency.

Restored prices carry sale-order-item references, not trusted client currency codes.
Server checkout validates each reference against the selected site's order, uses
its persisted currency for restored overrides, and converts newly added catalog
lines into that same currency. Cart/session settlement currency remains fixed for
an existing order, including after price-list changes. Legacy sessions without
this context reload the selected order before checkout; current edited sessions
retain their changes. Cancelled historical lines do not require live catalog IDs
and cannot return to the cart. Seller display names use batched, user-scoped member
and profile reads; unresolved retained IDs display `Seller unavailable`.

Changing the order clears the previous cart immediately. A selection sequence
ignores stale responses after another selection, New Order, unmount or a site
change; incomplete loads are not persisted as ready checkout sessions. Cached
data is a UI prefill, never authorization or an authoritative payment state:
checkout retains server-side resource, pricing and payment validation. Confirmation
re-reads an existing order and compares its original snapshot (including balance
and line changes), not the edited cart. Changed orders are refreshed for review,
never silently charged. The snapshot version travels with the outbox and is
checked again on the server before checkout side effects. This is stale-write
detection, not an atomic database lock: simultaneous payments after the check
remain a separate concurrency limitation. Older outbox entries have no version.
Pending-sync placeholder orders stay blocked rather than falling back to stale
server data. Existing-order payment now requires connectivity to verify its state;
new-order offline checkout remains available.

The baseline also includes persisted notes and seller attribution to avoid lost
updates from another device. A note already written by the local autosave can
therefore require an explicit order refresh before payment; it is never silently
replayed with an outdated baseline. This check still does not provide a database
lock against simultaneous writes after validation.

### POS sync error recovery

The visible POS sync loop retries failed as well as pending outbox operations.
Successful operations retain their synced result and clear their stored error;
catalog and order pulls clear only their own errors, including unchanged-revision
catalog checks. Unresolved failures remain visible rather than being hidden by
another operation's success. Error state and subscriptions are site-scoped.

`app/pos/local/sync-errors.ts` reports operation failures through the authenticated
`reportPosSyncError` Server Action without awaiting the report in the sync engine.
The email contains only diagnostic categories, site ID, mutation fingerprint and
attempt count, never the outbox payload or arbitrary error prose. Configure
`POS_SYNC_ERROR_EMAIL` alongside SendGrid and Redis as described in
[Environment variables](ENVIRONMENT_VARIABLES.md). Recovery sends no success email.
Repeated error reports are bounded on both client and server; email reporting is
best effort and provider acceptance does not confirm inbox delivery. It is not a
durable notification queue. Existing checkout idempotency remains unchanged.

Regression coverage is in `__tests__/pos/sync-engine.test.ts`,
`__tests__/pos/report-sync-error.test.ts`, `__tests__/pos/sync-policy.test.ts` and
`__tests__/pos/sync-badge.test.ts`. These tests use isolated mocks and send no emails.

### Partial site settings writes

`app/context/site-update-settings.ts` reads the latest settings for JSON merges,
then updates only the supplied fields, scoped by `site_id`. It inserts only when
the initial read finds no settings row. Never replace this with a full-row upsert:
PostgreSQL runs INSERT triggers before conflict resolution, so copying stored
resource `_license` metadata into an upsert is rejected even for owners/admins.
Keep RLS and license protections enabled. Confirm each write with returned row
identity; resource changes return the full row to publish server-enforced limits.
Printer regression tests cover the writer and a disposable local PostgreSQL
cluster under `__tests__/context/printer-settings-*.test.ts`.

Onboarding writes use the dedicated `app/components/dashboard/onboarding-progress.ts`
helper. It conditionally updates only the onboarding JSON snapshot it read, then
re-reads and merges task changes on a conflict (at most three attempts). This
prevents overlapping auto-validation and "Skip remaining" saves from erasing
completed steps while preserving explicit task reopening and RLS. It verifies
requested values in the returned row before reporting success. Regression coverage
is in `__tests__/dashboard/onboarding-progress.test.ts`,
`__tests__/dashboard/use-onboarding-validation.test.tsx`, and the disposable local
PostgreSQL suite `__tests__/dashboard/onboarding-settings-postgres.test.ts`.

### Shop delivery selection

Explicit hero/cart/checkout delivery choices are stored per seller under
`market-shop-fulfillment:<siteId>`. `useShopFulfillmentPreference` restores them
after hydration and gates automatic defaults until restoration commits. Only
manual changes write the preference: nearby-store defaults and incompatible-cart
fallbacks do not replace it. Marketplace checkout never reads a Shop preference.
The saved value is a UI preference, not authorization; allowed item methods and
server checkout validation still apply. Regression coverage lives in
`__tests__/commerce/shop-fulfillment-preference.test.tsx` and
`__tests__/shop/shop-fulfillment-cart.test.tsx`.

## Before handing off

- Review the diff for unrelated edits and accidental secret exposure.
- Report which tests and checks ran, including failures that predate the change.
- Do not commit, pull, push, deploy, apply remote migrations, or run a build
  unless explicitly requested.
- Do not run E2E or agent verification against an unspecified environment.
