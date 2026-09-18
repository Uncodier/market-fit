# Makinari

Makinari is an AI-assisted growth and operations platform. The application
combines CRM and campaign workflows with commerce, quotations, orders,
reservations, content, records, communications, and automation.

## Technology

- Next.js 16 App Router and React 19
- TypeScript in strict mode
- Supabase PostgreSQL, Auth, Storage, and RLS
- Stripe billing and commerce payments
- Tailwind CSS and Radix UI primitives
- Jest for unit and regression tests
- Shiplight/Playwright for browser workflows

`package.json` declares the supported versions. Both npm and Yarn lockfiles are
currently checked in; confirm the package-manager policy before changing
dependencies.

## Requirements

- Node.js 22 or newer
- npm
- Supabase configuration for authenticated and database-backed features
- Feature-specific credentials for Stripe, the external orchestration API, or
  other integrations

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The starter environment file does not contain secrets. Configure the subsystems
you need using [the environment guide](docs/ENVIRONMENT_VARIABLES.md).

## Common commands

```bash
npm run dev                 # Next.js development server
npm run dev:webpack         # Development server using webpack
npm run lint                # ESLint
npm test                    # Jest
npm run test:watch          # Jest watch mode
npm run test:e2e            # Shiplight browser tests
npm run agent:verify        # Agent verification runner
```

The repository has no `db:migrate` or `db:seed` npm scripts. Follow the
[database migration guide](docs/DATABASE_MIGRATIONS.md) instead of using commands
from old setup notes.

## Repository layout

```text
app/                    Next.js routes, features, components, and route handlers
lib/                    Shared clients, authorization, utilities, and types
supabase/migrations/    Forward-only SQL migrations
__tests__/              Jest tests
tests/                  Shiplight E2E and agent verification assets
specs/                  Behavioral specifications and coverage artifacts
scripts/                Operational and test-support scripts
docs/                   Repository and integration documentation
public/                 Public static assets
```

## Documentation

Start with [the documentation index](docs/README.md):

- [Development](docs/DEVELOPMENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Database migrations](docs/DATABASE_MIGRATIONS.md)
- [Environment variables](docs/ENVIRONMENT_VARIABLES.md)
- [Maintenance](docs/MAINTENANCE.md)
- [Stripe setup](docs/STRIPE_SETUP.md)

Older files in `docs/` may be implementation notes rather than current policy.
The index labels their role and points to canonical guidance.

## Security-sensitive work

Every API route is its own trust boundary: `app/middleware.ts` intentionally
skips authentication for `/api/**`. Authenticate and authorize each operation,
prefer user-scoped Supabase clients with RLS, and use service-role clients only
after explicit authorization.

Before changing auth, RLS, public tokens, checkout, payments, payouts, webhooks,
or outbound proxying, read [the security guide](docs/SECURITY.md) and add focused
denial and retry/concurrency tests.

## Database changes

Schema changes are timestamped SQL files in `supabase/migrations/`. Never edit a
migration that may already be applied. Remote migration application is an
explicit deployment action and is not part of routine local validation.

## Contributing

Keep changes focused, preserve unrelated work, add tests for changed behavior,
and document new commands, configuration, routes, and security invariants.
Follow `AGENTS.md` for repository-specific automation guidance.

No license file or public vulnerability-reporting address is currently present
in this repository. Do not infer or advertise either until the repository owner
adds authoritative information.
