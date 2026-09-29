# Shiplight Test Context: Makinari

## App profile

- **Name**: Makinari (repo package: `market-fit`)
- **Positioning**: Revenue operations platform — not a marketing-analytics-only app. Workspace covers CRM/marketing, commerce (shop, POS, marketplace), fulfillment, procurement, accounting, and AI agents.
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript. Node `>=22`.
- **UI**: Radix primitives, Tailwind, next-intl. UI copy is English.
- **Backend**: Supabase (Postgres + Auth + RLS). Stripe for billing and storefront checkout. Optional Twilio.
- **Multi-site**: A *site* is a workspace row in `sites`. Users switch sites at `/projects`. Active site lives in cookie `mf_current_site_id` and localStorage `currentSiteId`. Shop URL slug is derived from `sites.name` (also accepts a UUID), not a dedicated slug column.

### Workspace areas (sidebar)

From `app/config/navigation-areas.ts`:

| Area | Representative routes |
|------|------------------------|
| Marketing | `/campaigns`, `/segments`, `/promotions`, `/content`, `/assets` |
| Sales | `/pos`, `/catalog`, `/price-lists`, `/subscriptions`, `/sales`, `/leads`, `/deals`, `/quotations`, `/people` |
| Operations | `/chat`, `/records`, `/orders`, `/shipments`, `/control-center`, `/reservations`, `/visits`, `/inventory` |
| Buying | `/bills`, `/transactions`, `/purchases/orders`, `/purchases/quotes` |
| Finance | `/finance`, `/accounting`, `/accounting/entries`, `/costs` |
| Reports | `/dashboard?tab=` (performance, overview, analytics, traffic, sales) |
| Applications | `/applications`, `/applications/database`, `/applications/repositories` |
| Automation | `/context`, `/agents`, `/requirements`, `/skills`, `/robots?mode=workflow` |
| Settings | `/settings?tab=`, `/integrations`, `/billing`, `/security` |

Always-available workspace routes: `/projects`, `/create-site`, `/onboarding`, `/navigation`, `/profile`, `/notifications`.

### Public / buyer commerce (not the workspace sidebar)

- Per-site storefront: `/shop/[siteSlug]`, PDP, book, promo, privacy
- Cross-site marketplace: `/marketplace` (items with `is_marketplace_listed`)
- Cart: `/cart/checkout` (shop vs marketplace are separate cart scopes)
- Public booking: `/book/[siteSlug]/...`
- Authenticated buyer portal: `/buyer/*` (orders, quotes, library, subscriptions, entitlements)
- Public document tokens (no auth): `/q/[token]` quote, `/so/[token]` sales order, `/i/[token]` invoice, `/vb/[token]` vendor bill. Use `/prefix/token` so `/quotations` is not matched.

`/` and `/auth` both render the sign-in landing. Workspace routes redirect unauthenticated users to `/auth?returnTo=...`.

## Risk profile

- **Critical paths**: workspace login → site picker → site-scoped CRUD; team invites; storefront browse → cart → Stripe checkout; buyer portal entitlements; public token documents; billing/credits at `/billing` and `/checkout`.
- **Fragile areas**: www vs app host split and Server Action origin alignment; shop slug derived from site name; marketplace vs shop cart scopes; RLS + `user_can()` capabilities; screen-level `blocked_screens`; Stripe webhooks; demo sites (`demo-*` IDs, cookie `market_fit_demo_site_id`).

## Testing scope

- **In-scope (E2E first)**: sign-in (password + Google), post-auth landing (`/projects` on app, `/buyer` on www), site picker / create-site, one core workspace journey per area as coverage grows, public shop + marketplace browse, buyer portal after checkout, public quote/order token pages, role/capability differences (owner/admin vs collaborator vs marketing).
- **Out-of-scope for YAML E2E unless specified**: Stripe webhook failure matrices, Twilio delivery, load tests, agent/workflow internals that need the robot backend on `:3001`, demo-mode mock data as a substitute for real auth.

Jest unit/integration tests already live under `__tests__/`. Shiplight YAML is for browser journeys.

## User roles

DB / TypeScript (`lib/permissions/types.ts`):

| Role | CRUD (`user_can`) | Notes |
|------|-------------------|--------|
| `owner` | select, insert, update, delete | Site creator (`sites.user_id`) or `site_ownership`. Not assignable in team UI. |
| `admin` | select, insert, update, delete | Writable invite role. Admin screens: owner + admin only. |
| `collaborator` | select, insert, update (no delete) | Team UI: Editor (`create`) or Manager (`delete` label — still stored as collaborator). |
| `marketing` | select only | Team UI: Viewer (`view`). |

Non-admin members may have `blocked_screens` (nav keys) and optional `restrict_to_assigned_only` (leads/deals).

**Buyer is not a site role.** `/buyer` is for authenticated end-customers (orders, entitlements). Separate from `site_members`.

Do not use README labels Admin / Editor / Viewer as stored roles.

## Data strategy

- Database: Supabase Postgres + RLS. No `db:seed` script in `package.json`.
- No dedicated E2E test accounts are committed. Do not invent credentials; use env var names only (`_shared/secrets.md`).
- Demo mode (`lib/demo-utils.ts`) uses mock data and `demo-*` site IDs — not a substitute for logged-in workspace tests.
- Ad-hoc scripts (`scripts/test-magic-links.ts`, `scripts/test-api-invitations.ts`) use placeholder emails; they are not Shiplight fixtures.
- Prefer isolated sites/records and clean up created data. Stripe/Twilio: test mode when a live payment path is required.

## Targets

| Host | Role |
|------|------|
| `http://localhost:3000` | Local workspace + commerce (default for Shiplight until a remote target is agreed) |
| `https://app.makinari.com` | Production workspace. Post-auth default: `/projects`. |
| `https://www.makinari.com` / `https://makinari.com` | Production commerce/buyer. Post-auth default: `/buyer`. |
| `https://demo.makinari.com` | Demo host |
| `*.preview.makinari.com` | Preview deploys |

**www → app proxy**: when `MARKET_FIT_ORIGIN` is set, www rewrites `/auth`, `/shop`, `/marketplace`, `/cart`, `/buyer`, `/book`, `/q`, `/so`, `/i`, `/vb`, `/profile` to the app deploy. On Vercel, `assetPrefix` is `https://app.makinari.com`. Not all `/api/*` are proxied — clients often call app via `resolveAppApiUrl()`.

**Auth**: Supabase. Primary workspace login is **email + password** and **Google OAuth**. Magic-link OTP is for team invitations and checkout guest identity, not the main sign-in form. MFA (TOTP) may appear after password login. Callback: `/auth/callback`. Invites: `/auth/team-invitation`, `/auth/set-password`.

App env vars are documented in `docs/ENVIRONMENT_VARIABLES.md` (Supabase, API server, Stripe). Root `.env.example` is Shiplight AI keys only. Shiplight `.env` is gitignored.

## Known facts and decisions

- Do not use Lucide-react; the app has its own icons.
- `package.json` `"test"` is Jest. Shiplight scripts are `test:e2e` / `test:e2e:headed`. Do not overwrite `test`.
- `playwright.config.ts` selects explicit `smoke`, `regression`, `buyer`, or `roles` suites. Smoke is the default and never discovers root CRUD or nested agent tests. Auth state is isolated under `.auth/<target>/<run-id>/<role>.json`; buyer uses its own account and commerce host.
- `package.json` has no `"type": "module"` — Next config is CommonJS (`module.exports`). Leave it that way.
- `auth/example.login.ts` was deleted in favor of `auth.setup.ts`.
- Middleware aliases: `/chat/123` → `/chat?conversationId=123`, `/robots/123` → `/robots?instance=123`.
- GitHub icon on the landing page links to makinari.org (open source), not GitHub OAuth.

## Execution contract

- No live environment is inferred. `TEST_TARGET`, `TEST_BASE_URL`, `TEST_COMMERCE_BASE_URL`, `TEST_SITE_ID`, and `TEST_SITE_NAME` are mandatory.
- Production allows read-only smoke/buyer only. Mutating suites and agent workflows require disposable local/staging targets and two explicit mutation flags.
- Dedicated role/buyer credentials and foreign site fixtures remain operational provisioning requirements. Missing fixtures fail before execution, not as successful skips.
- Paid checkout and complete POS reservation remain unverified live journeys; cash-zero Shop checkout is not Stripe evidence.
- Smoke reads named pre-existing catalog/content/lead fixtures. CRUD uses run-owned data and scoped authenticated cleanup, never a service-role global reset.
- The supported commands, exact-run reports and residual blockers are documented in `docs/E2E_TESTING.md`.
