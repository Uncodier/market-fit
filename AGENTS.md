<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repository guidance

Read `docs/README.md` before substantial work. The canonical operational guides
are:

- `docs/DEVELOPMENT.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/DATABASE_MIGRATIONS.md`
- `docs/MAINTENANCE.md`

For browser-test behavior, routes, roles, and test data assumptions, also read
`specs/context.md`.

Mandatory constraints:

- Preserve unrelated working-tree changes. Never commit, pull, push, deploy,
  apply remote migrations, or run a production build without explicit approval.
- Use npm and the committed lockfile. Jest is the unit/regression test runner.
- Every `app/api/**` route performs its own authentication, authorization, and
  input validation; middleware intentionally does not authenticate API routes.
- Prefer user-scoped Supabase access with RLS. A service-role client is
  server-only and requires explicit authorization before use.
- Never trust client-provided tenant IDs, user IDs, prices, payment state,
  return URLs, or external fetch targets.
- Add forward-only timestamped migrations; never edit an applied migration.
- User-facing UI, code, comments, prompts, and repository docs are English.
- Reuse existing UI components and `app/components/ui/icons.tsx`; do not add
  direct `lucide-react` usage.
- Keep files below 500 lines and split touched oversized files by responsibility.
- Do not replace backend behavior with mock API responses.
