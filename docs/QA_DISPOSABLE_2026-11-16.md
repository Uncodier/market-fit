# Disposable QA execution — 2026-11-16

## Target, provenance and safety

The user approved another four-hour disposable Azure QA at USD 0.172/hour VM
compute plus SSD, public IP, Automation and traffic. Exact environment:

- QA ID: `qa-1794712685585-f5501631`.
- Resource group: `rg-makinari-qa-20261116194602-630a7`.
- Created: `2026-11-16T19:46:02.937297+00:00`.
- Expiry: `2026-11-16T23:46:02.937297+00:00`.
- Installer base: `ad6cef30c07a33310fd7db4240d75d25309af5c0`.
- Schema: `72597493a3b72bf9956c470f02e982dbcf02c268`.
- Frontend: `f87ba74d0e851bd7d3ab242e1f6111fb066d6b18`.
- API: `5559a5fedce2cee66c05e8651ed2d0ad8aa1702a`.
- Workflows: `a9e46fd0521778d7710572130042f400de62c6aa`.

Clean private clones supplied the service snapshots; unrelated working-tree
changes were not packaged. Tests use loopback origins on the VM and synthetic
fixtures, not production accounts/data. No production build, commit, pull, push,
deployment or remote production migration was performed. Later concurrent local
application edits are not evidence about this fixed QA revision.

## Bootstrap and runtime repair

The pinned Supabase CLI and local-mail normalization passed. The complete fresh
schema replay passed the previous accounting OID failure, including the QA-only
prerequisite followed by the unchanged canonical accounting patch. Supabase Auth,
Storage, REST, Realtime and PostgreSQL became healthy.

A real startup race remained: workers connected to local Temporal before its
transport socket listened, then their failures caused the supervisor to stop web
services. The supervisor now waits up to 60 seconds for its local child to bind
loopback port 7233 before starting workers; child exit, shutdown and timeout remain
failures. Worker SDK handshakes still enforce actual Temporal readiness.

Reviewed overlay: `scripts/workspace-runtime.cjs` plus new
`scripts/temporal-readiness.cjs` in the installer repository. No application or
credential override was copied. Two runtime/readiness suites passed **61 tests**;
the pre-overlay installer battery passed **200 tests / 11 suites**. The final
installer battery including the repair passed **203 tests / 12 suites**. The overlay is
unpublished; this is not an unmodified published-installer acceptance claim.
Frontend `/auth` and API `/api/status` then returned 200. Installer provisioning
completed browser installation and verified synthetic identities, membership,
persisted fixtures, public-key access and role/RLS bindings.

## Exact browser attempts

Product counts below exclude separately reported authentication setup. No
automatic retries or successful-skip substitutions were used.

| Suite | Exact run ID suffix after QA ID | Product results | Evidence |
|---|---|---|---|
| Smoke | `smoke-40aebc9c` | 4 passed / 19 failed / 0 skipped | Complete full case results; export partial, `SOURCE_UNAVAILABLE` |
| Roles | `roles-54942df7` | 7 passed / 0 failed / 0 skipped | Complete full results; export `ok` |
| Buyer | `buyer-90a36307` | 1 passed / 0 failed / 0 skipped | Complete full results; export `ok` |
| Subsystems | `subsystems-79fe1d59` | 1 passed / 2 failed / 0 skipped | Complete full results; export partial, `SOURCE_UNAVAILABLE` |
| Procurement (initial) | `procurement-309c20e9` | 0 passed / 9 failed / 0 skipped | Complete full results; export `ok`; portal provisioning prerequisite failed |
| Project lifecycle | `project-lifecycle-5339ddb5` | 1 passed / 0 failed / 0 skipped | Complete full results; export `ok` |
| Account lifecycle | `account-lifecycle-be1d56fc` | 3 passed / 0 failed / 0 skipped | Complete full results; export `ok` |
| Regression | `regression-e595f5b6` | 1 passed / 42 failed / 6 blocked / 1 skipped | All 50 selected cases reported; `complete=false`; export `ok` |

The independent `healthGreen` provenance gate remains false; assertion passes do
not imply published overlay provenance, deployment or full application health.
The records suite is not exposed by the published installer and is not executed
by bypassing its fixture/policy gates. All nine suites passed offline validation
with exact IDs `qa-20261116-validate-<suite>`; that does not extend live coverage.

### Findings

Smoke's first confirmed application/dependency failure is HTTP 502 from
`/api/images/modules/profile`, followed by a console error. Sidebar platform
image reads can depend on image cache/generation; successful text rendering is
not proof those requests succeeded. Tests were not changed to ignore the error.

All initial procurement cases failed at the same precondition: the real QA tender
portal API returned `enabled=false`. The suite expects installer/operator
provisioning and deliberately never enables shared settings itself. These failures
do not demonstrate nine broken tender transactions. After regression finished,
the exact-QA setup script refused with `EACCES` while inspecting processes, before
Auth/API enablement. No successful portal POST or second procurement run occurred.
The original nine precondition failures remain reported, not overwritten.

Both POS subsystem failures stopped at strict comparison of persisted customer
selection: the actual identity matches but includes the additional
`priceListId:null` field. That is an observed serialized-shape/assertion mismatch,
not proof that customer identity was lost. Later cancel/reload behavior remains
unverified; tests and application persistence were not modified to hide it.

## Local checks

- Full Jest: **1,734 suites: 1,685 passed, 49 failed**. Tests: **21,056 passed,
  79 failed, 5 skipped** (21,140 total). No green/full repaired-suite claim.
  [Exact failed-suite inventory](../specs/qa-disposable/jest-failures-20261116.md).
- Schema validator: **9 tests passed**.
- Typecheck retains the existing PostCSS callback error in
  `mobile-primary-buttons.test.tsx:176`.
- Full ESLint: **3,172 errors / 1,900 warnings**; no blanket autofix.
- Specialized configurations: harness, pricing, instance-assets, OpenRouter,
  Stripe and top-up passed; catalog had one failure; robot-runner found no tests.

## Evidence and cleanup

Private local logs/JSON are under `/tmp/makinari-qa-20261116`. Safe installer
exports are in the exact QA's private directory; extraction gaps are explicit.
[Safe exact-run summary projection](../specs/qa-disposable/outcomes-20261116.json)
retains counts, completeness and extraction status for all eight attempts.
Raw traces, credentials, account links and provider payloads must not be published.
Account cleanup requires destruction of the exact environment, not merely project
archival. No account journal is relabelled complete before verified group absence.

All eight installer-supported suites were attempted sequentially. Final export
retains exact outcomes but is partial overall due to smoke/subsystem diagnostic
source gaps. Exact-QA destruction was requested after export; by **22:25 UTC**
the installer confirmed deletion. Follow-up installer status returned
`deleted-confirmed`, `groupExists=false`, `qaReady=false`, and independent
`az group exists` returned `false`. No resources remain for this QA. No expiry
extension or replacement was created.
These results do not certify a green release or fully healthy application.