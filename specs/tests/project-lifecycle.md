# Project creation and archival

- Status: Ready
- Priority: UNKNOWN (no upstream priority declared)
- Target: `https://app.makinari.com`; commerce host remains `https://www.makinari.com`.
- Actor: existing dedicated password-authenticated admin, primary owner of the new project.
- Implementation: `tests/projects/lifecycle.spec.ts`, a deterministic native Playwright E2E
  in the Shiplight runner, consistent with native smoke tests. Shiplight MCP tools are
  unavailable in the authoring session; no guessed YAML or generated spec editing.

## Goal and journey

1. Select the exact configured reference workspace and bind backend reads to the
   browser's authenticated session and explicitly configured Supabase origin.
2. Confirm the unique run marker does not exist. Complete `/create-site` with a
   unique `Shiplight Lifecycle <run-id>` name and reserved `.example.invalid` URL.
   Leave optional business data, paid checkout and channel connections untouched.
3. Require one successful actual site insertion and capture its persisted ID,
   exact name/URL and primary owner. Observe the success screen.
4. Reload `/projects?manage=1`, select the persisted new project and verify both
   active-site cookie and localStorage use its exact ID.
5. In Settings → General, open Archive site. Submission must be disabled without
   a password. Cancel and prove the project remains active and selected.
6. Reopen, confirm the exact project name and submit the account password. Require
   an HTTP success with `{ success: true }`, removal from user-scoped RLS reads,
   cleared active-site caches and absence from a freshly loaded project chooser.
   The reference workspace must remain selectable.

## Auth, data and safety

- Reuse `auth.setup.ts`, `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD`. Never bypass MFA.
- Require ordinary target/site variables plus `TEST_SUPABASE_URL`,
  `TEST_SUPABASE_PROJECT_REF`, `TEST_SUPABASE_ANON_KEY`, a unique `SHIPLIGHT_RUN_ID`
  and explicit `TEST_ALLOW_PROJECT_LIFECYCLE=1`.
- Only this isolated suite may perform this requested production lifecycle. Existing
  regression/roles/agent production prohibitions remain unchanged.
- Backend client is read-only, public-key, authenticated and RLS-scoped. No service
  role, SQL writes, physical deletion or existing-project mutation.
- New-project creation invokes normal application initialization, including credits,
  commerce defaults and optional background setup. Archival preserves those records;
  it does not cancel billing or terminate external workflows. No paid subscription,
  payment or integration is configured by the test.
- Disable trace, video and screenshots for the suite because archival reauthenticates.
  Store only a synthetic project ID/name and step outcome evidence, never secrets.

## Cleanup and residual gaps

Creation is never retried. If an assertion fails before archival is submitted, an
authenticated API cleanup may archive only the exact ID returned by that creation
response, owner, name and reserved URL. A marker match alone is never adopted for
cleanup; missing creation identity requires operator follow-up. Cleanup rejects
redirects. If archival was submitted but not confirmed, do not replay
an ambiguous mutation; report the ID for operator follow-up. Archived synthetic
records are intentionally retained. RLS absence alone is not proof of physical
data retention; the existing archival API/migration/PostgreSQL tests own that proof.

## Run

```sh
TEST_ALLOW_PROJECT_LIFECYCLE=1 SHIPLIGHT_RUN_ID=unique-run-id \
  npm run test:e2e -- --suite project-lifecycle --target production
```

Live results and blockers are recorded in the project lifecycle report, not inferred
from successful transpilation/discovery or an earlier run.