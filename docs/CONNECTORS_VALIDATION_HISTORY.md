# Historical connector validation

These results predate the Robots catalog and private report reader. See the
[current rollout guide](CONNECTORS_INSTANCE_CATALOG.md) for their successors.

Repair validation (offline, after the initial connector changes):

| Check | Result |
| --- | --- |
| API connector suites, including real host call flow | 22 suites, 245 tests passed. |
| Web connector UI/BFF/secrets and disposable PostgreSQL | 15 suites, 153 tests passed. |
| Additional assistant route/context/recovery and pending-work regressions | 127 + 13 tests passed. |
| Final API and web `tsc --noEmit --pretty false` | Both passed. |
| Focused web ESLint and both repositories' `git diff --check` | Passed. |
| Eight connector migration copies in canonical/API/web | Byte-identical; no remote application. |

The SQL suite includes authenticated instance-agent/queue/recovery spoof denial,
manager-removal serialization and single-claim revocation dispatch. Browser UI
tests are component tests, not an authenticated live-browser acceptance session.

Focused Jest suites cover web UI/BFF, credential boundaries, API provider transport,
OAuth correlation, access checks, runtime discovery and schema validation. Separate
socket-only PostgreSQL tests exercise actual constraints, RLS, grant races and
finalization, with fixture site/plan data rather than a complete billing bootstrap.
Offline provider fixtures are test evidence only; production routes call real
provider adapters and never substitute mock accounts or tool responses.

Initial-increment validation (before the repairs above) ran with Node 25.9.0:

| Check | Result |
| --- | --- |
| API focused connectors: `npm test -- --config jest.connectors.config.js --runInBand --silent` | 19 suites, 223 tests passed. |
| Web UI/BFF/secrets plus isolated connector SQL suites | 14 suites, 122 tests passed. |
| Web callback/login and existing middleware regressions | 3 suites, 32 tests passed. |
| API existing router/screen, MCP/document routing, skill and context regressions | 9 suites, 179 tests passed. |
| `tsc --noEmit --pretty false`, API and web | Both passed. No Next build or typegen run. |
| Focused web ESLint, touched connector source/tests and credential/callback boundaries | Passed. |
| Migration copies, document links/line budgets, `git diff --check` | Passed. Five migrations are byte-identical across three repositories. |

The broader API run also exercised the old
`src/lib/agentbase/agents/toolEvaluator/executor/__tests__/executeTools.test.ts`:
five tests failed (four invalid `process.env` getter spies and one timeout/open
handle). All five failures reproduced against the unchanged HEAD implementation
using temporary baseline files outside the repositories. They are not counted as
passing or repaired; known native MCP/document paths and the new legacy-default
execution-denial regression passed separately.

No authenticated browser, real OAuth, remote migration, production build, commit,
push or deployment was performed. Unrelated Finder and assistant test edits were
preserved. This increment does not complete the background workflow/delegation
phase of the target plan.
