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
npm test
npm run test:watch
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:report
npm run agent:verify
npm run test:magic-links
npm run test:api-invitations
```

`npm run build` and `npm run start` also exist, but do not run a build as routine
validation unless the task or release process explicitly requires it.

`next.config.js` currently sets `typescript.ignoreBuildErrors: true`, so a
successful build is not evidence of type safety. Use `npx tsc --noEmit` when a
type check is required. `npm run lint` scans the whole repository; during a
dirty-tree task, targeted `npx eslint <changed-files>` can separate new findings
from unrelated failures.

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

Run a focused Jest test:

```bash
npm test -- --runInBand __tests__/path/example.test.ts
```

Run the complete Jest suite:

```bash
npm test -- --runInBand
```

Authenticated E2E setup reads `TEST_ADMIN_EMAIL` and
`TEST_ADMIN_PASSWORD`; deterministic scenarios may also require the
`TEST_*_NAME` values documented in `.env.example`.

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

## Before handing off

- Review the diff for unrelated edits and accidental secret exposure.
- Report which tests and checks ran, including failures that predate the change.
- Do not commit, pull, push, deploy, apply remote migrations, or run a build
  unless explicitly requested.
- Do not run E2E or agent verification against an unspecified environment.
