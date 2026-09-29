# E2E remediation report — 2026-09-28

This report supersedes execution-infrastructure claims in the historical
`test-report.md`; it does not declare previously reported application bugs fixed.

## Implemented

- Default execution is a six-scenario read-only smoke, plus separate auth setup.
- Explicit target, host, workspace name/UUID and synthetic fixture requirements;
  production mutations forbidden even with mutation flags.
- Root regression excludes vendor examples, local diagnostics, buyer identity
  tests and the separately orchestrated nested reservation project.
- Buyer has its own login/session and commerce host. Live role/RLS/API boundary
  checks use four explicit accounts and two existing tenant fixtures.
- Global service-role expense deletion removed. Mutation cleanup is exact-ID,
  site-scoped and authenticated with a public key, with browser/backend identity
  binding. Shared setting/agent originals restore in teardown.
- Hard persistence/removal/read assertions replace warning-only or self-healing
  correctness gates. Network, console and application errors are observable.
- Exact-run discovery/manifest/results/publication; setup is not product coverage.
  Missing, filtered, blocked and retry-passed outcomes cannot certify full health.
- Protected deployment/manual CI definitions and secret-free PR harness validation.
- Agent runner split into focused modules; explicit targets, one terminal status,
  current evidence/artifact validation, no automatic replay of mutating attempts.
- Following owner clarification, the legacy cron status route and unused activity
  view were removed: execution metadata in Temporal superseded this debug view.
  The boundary test now requires 404. The database table remains unchanged.

## Verification performed

- Focused Jest: **15 suites / 291 tests passed**, covering safety, discovery,
  cleanup, assertions, reporting, deployment policy and agent evidence.
- Installed Shiplight strict transpilation: 50 root regression YAML, one buyer
  YAML and four nested reservation segments; zero errors/warnings.
- Actual Playwright discovery, without browsers, for all four root suites.
- Standalone strict TypeScript checks for test support, configs and agent runner.
- CJS ESLint and syntax checks; workflow YAML parsing; diff whitespace checks.
- Negative preflight checks return nonzero before browser/auth/application calls.
- Independent review regressions: reject trailing-dot production-host aliases,
  select visible desktop inputs, detect returned Server Action errors, terminate
  agent subprocess groups, and avoid the vendor wrapper's implicit CI cache upload.

These are harness/source validations, **not successful deployed E2E executions**.
No live E2E, provider payment, database mutation, Cloud upload, CI execution,
production build, deployment or remote configuration change was performed.

## Explicit blockers and unclaimed coverage

1. Configure approved disposable targets and named fixtures/accounts before live
   regression; the developer environment is missing required new variables.
2. Robot/social mutations remain BLOCKED until exact-ID provisioning/cleanup and
   disposable OAuth fixtures exist. Their intended journeys are not certified.
3. People zero-result success currently resembles the initial prompt; strict
   assertions expose this instead of accepting a visible Search button.
4. Some workflow modes remain loading without an active-instance fixture.
5. Nested reservation UI currently has an older Shiplight dependency than the
   root; the agent preflight blocks version drift. No dependency upgrade or
   lockfile rewrite was performed.
6. POS checkout completion, real Stripe test-mode settlement, full buyer ownership
   and public-token lifecycle, and complete workflow side effects still need
   dedicated live fixtures/journeys. Cash-zero Shop checkout is not Stripe proof.
7. Cloud's installed upload API labels local-runs; trigger + repository-owned
   manifest provide target/scope provenance without rewriting vendor artifacts.
8. Local health indices are not durable cross-CI monitoring. Alert cadence,
   destinations, queue/webhook/cron monitoring and GitHub environment setup are
   operational work, not enabled by a code-only test repair.

See `docs/E2E_TESTING.md` for commands and fixture policy. Do not weaken required
assertions or classify these blockers as PASS to obtain a green dashboard.