# Location ACL implementation review — 2026-10-21

This review covers the source implementation, isolated PostgreSQL behavior,
synthetic Chromium/IndexedDB execution, and existing Jest regressions. It is not
an approval to deploy or apply SQL. No remote writes were executed. Read-only
catalog inspection confirmed the configured project has the foundation but not
the enforcement registry or global restriction predicate at review time.

## Confirmed issues and corrections

| Finding | Correction and evidence |
| --- | --- |
| Active members could insert their own `site_ownership` row, become owners, and bypass exclusions. | `20261021010000_location_acl_ownership_boundary.sql` adds primary-owner-only restrictive INSERT/UPDATE. A PostgreSQL test reproduces the old elevation before applying the correction and verifies denial afterward. Existing ownership rows are not automatically removed. |
| Additional same-site/same-scope foreign keys made previously unambiguous PostgREST embeds ambiguous. | `10002_location_relationship_consolidation.sql` retains one composite relationship under the deployed legacy name and preserves delete behavior. Reservation resource embeds explicitly name `reservations_location_id_fkey`. Catalog tests prove relationship cardinality; live PostgREST still requires deployment verification. |
| Direct UPDATE bypassed the manager-only/null-only scope assignment RPC; moving a parent could race with a child's authorized update. | `10001_location_scope_write_guards.sql` makes known scopes immutable, requires a private transaction-bound approval for initial assignment, validates caller-visible parents before privileged lookups, and locks those parents. Tests include raw DML, guessed GUCs, hidden-parent error equivalence, and concurrency. |
| Two managers could overwrite one another's exclusions and reopen a blocked branch. | `10003_location_restrictions_checked.sql` compares the expected old set under the lock; stale saves return HTTP409 without retry. The unchecked RPC is no longer granted to authenticated callers. API/UI send the expected set. |
| Missing/revoked membership returned `false` from the per-site restriction predicate and could authorize a stale cache-role snapshot. | `10004_location_records_insert_and_readiness.sql` treats unavailable membership as denied, grants the new records creation column, and verifies review prerequisites. |
| Warm UI never invalidated after the actual `42501` revocation error, and a hung permission refresh disabled future checks. | The browser revision watcher now retires warm data on errors, bounds requests, ignores late responses, and does not reload-loop on first-load setup failure. |
| Checkout could clear a different cart after awaiting local persistence; receipt identity was lost on permission remount. | Post-await grant/selection/session checks fence callbacks. A persisted opaque attempt ID survives remount and already-synced retries; explicit cart reset rotates identity. Same-user token refresh verifies in the background. |
| IndexedDB transactions already open at revocation could continue reading/writing; wall-clock rollback weakened expiry. | Active transactions are tracked and aborted, individual DBcore operations are checked before/after execution, and lease expiry uses monotonic time. Real Chromium/Dexie tests prove rollback within a live transaction. |
| Public invoice/order links, booking availability, shipment and promotion follow-ups accidentally rebuilt session-required workspace clients. | Token readers/aggregate availability use their explicit public contract; checkout/webhook shipment and promotion work reuses the already-authorized server client. Exposed shipment actions cannot select service-role access. Capacity lookup errors fail closed rather than returning zero bookings. |
| Restricted members lost access to their own buyer library/cancellation flows; buyer rescheduling had gained an admin past-time bypass. | Personal queries use independently scoped buyer access; cancellation fallback verifies Auth and own buyer identity. Buyer rescheduling again passes nonadmin rules. |

## Remaining limitations and rollout requirements

- The full migration order, including all five review corrections, is in
  [Location enforcement](LOCATION_ACCESS_ENFORCEMENT.md). Do not expose the
  intermediate ready gate or deploy the new client against missing RPCs.
- Existing ownership grants may predate the fix. Review provenance manually;
  automatically deleting rows would risk removing legitimate co-owners.
- Connected unresolved parent/child graphs cannot be remediated one record at a
  time if doing so breaks scope equality. The UI rejects this case; an explicit
  atomic graph-remediation workflow is still required.
- Reports, private shared customer history, opaque AI context, and other
  unsupported projections remain unavailable to restricted members. POS requires
  current online authorization and is not supported for excluded members.
- Public checkout and token contracts must be verified after deployment with
  disposable allowed/denied identities. Unit mocks alone cannot prove a live
  PostgREST relationship contract, provider delivery, or transaction timing.
- Browser freshness is bounded, not immediate erasure. Files, screenshots, or
  data already copied outside the application cannot be revoked retroactively.
- Existing lint debt in legacy modules remains; targeted new/corrected security
  modules are checked without disabling rules.

## Focused proof suites

```bash
npm test -- --runInBand __tests__/security/location-ownership-boundary.test.ts __tests__/security/location-review-postgres.test.ts __tests__/security/location-review-before-fix.test.ts __tests__/pos/db-permission-browser.test.ts __tests__/auth/location-revision-hook.test.tsx __tests__/commerce/public-location-client-contract.test.ts
npm run typecheck
```

The pre-fix suite intentionally reproduces prior vulnerabilities in a brand-new
socket-only synthetic database. The corrected suite then exercises the forward
migrations. The IndexedDB browser suite serves only synthetic local test code;
it does not connect to the application or any production account.

Final review validation: **363 Jest suites / 4,712 tests passed**, including the
PostgreSQL and synthetic Chromium suites; `npm run typecheck` completed with exit
0. Focused ESLint passed for the new review code, migrations' test harnesses,
member save boundary, browser revocation watcher, and POS permission machinery.
`git diff --check` passed. No production build, remote migration, or live deployed
application E2E was run. Legacy lint findings outside these focused checks were
not silently disabled or treated as resolved.