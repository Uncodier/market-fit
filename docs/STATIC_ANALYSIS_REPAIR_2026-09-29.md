# Static Analysis Repair — 2026-09-29

## Scope and results

The initial strict TypeScript check reported 838 diagnostics in 234 files.
The repaired tree passes `npm run typecheck -- --incremental false --pretty false`
with exit code 0, including Next.js route generation and authored test files.

The work preserves strict checking and the original TypeScript file inclusion.
It does not suppress diagnostics with new `@ts-ignore` or `@ts-nocheck` directives.
The ES2018 target reflects the installed Next.js version's supported browsers.

## Changes

- Corrected missing identifiers, query projections, nullable values, and
  producer/consumer contracts across workspace, commerce, analytics, and tests.
- Restored asynchronous cookie/client access and explicit async Server Action
  exports. Added real Next.js compiler tests because ordinary Jest compilation
  skips the Server Action transform.
- Restored ESLint's Next.js and TypeScript rule sets for authored source and
  tests. Removed the unused legacy ESLint configuration.
- Removed `typescript.ignoreBuildErrors`; production builds use the default
  type-error gate. Added a credential-free TypeScript/compiler CI workflow.
- Split touched oversized modules by responsibility. Every changed source and
  documentation file is below 500 lines; existing public type/icon exports are
  preserved.
- Retired unused modules only after checking references, including the broken
  ROI prototype whose central engine was empty. Live analytics routes remain.
- Fixed conditional hook ordering, normalized mixed nested/dotted locale
  dictionaries, and supplied explicit persisted-setting defaults to forms.
- Replaced the obsolete live Stripe test, which called retired RPCs and deleted
  by broad prefixes, with isolated SDK transport tests for the current webhook
  delivery contract. These tests do not verify a live database installation.

## Validation

- Strict TypeScript and route generation: **passed, 0 errors**.
- Full Jest run: **558 suites passed, 19 failed; 4,767 tests passed, 53 failed**.
- All 19 failing suites also failed in an isolated archive of the original HEAD
  using the same installed dependencies. No new failing suite was introduced.
- The final requirement-extraction regression suites were also run separately:
  **21 tests passed** (loading/auth, saved campaign/graph state, undo/redo, and
  compiler/size contracts).
- `git diff --check`, changed-file syntax checks, and changed-file size checks
  passed.
- The last full ESLint audit reported **3,788 errors and 2,368 warnings**,
  predominantly existing explicit-`any` and React compiler-rule debt. It reported
  no parser errors or `react-hooks/rules-of-hooks` violations. ESLint is now
  operational, but a globally clean lint result is not claimed.

## Remaining boundaries

The follow-up read-only database audit confirmed that `reorder_task_priorities`
accepts only `p_new_position` and returns `void`. The corrective patch removes the
temporary argument union, fixes the incorrect client request, and adds a
forward-only migration for permission/input validation and concurrent RPC calls.
See [Critical flow security rollout](SECURITY_FINDINGS_ROLLOUT.md) for this and the
purchase/webhook policy corrections. Local success does not mean those migrations
have been applied remotely.

No production build, deployment, commit, push, remote migration, or live database
test was performed. Type safety and isolated regression tests are not a substitute
for approved end-to-end verification of production integrations.