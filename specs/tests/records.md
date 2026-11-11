# Records repair — native Playwright contract

Status: **authored, offline discovery/validation only; live execution blocked until
an operator supplies and approves a disposable local QA target**. These are not
52 template-pack acceptance tests, migration rollout evidence, or proof of live
backend success. No remote operations, migrations, provisioning, or browser
mutations were performed to author this suite.

## Isolation and execution

```sh
# Offline discovery/transpilation only; no credentials, login or target requests.
npm run test:e2e -- --suite records --list
npm run test:e2e -- --suite records --validate

# Offline lint (use the repository's existing dependencies).
npx eslint tests/records tests/support/records-*.ts
```

The shared runner/config integrates `--suite records`, one native admin
project, one worker, zero retries, existing admin UI authentication, and
`recordsPolicy()` in preflight. Smoke/regression must never discover these files.
Discovery does not invoke fixtures or authorize subsequent execution. There are
12 deterministic cases, no placeholder assertions, conditional skips, mocks,
route fulfillment, or private Server Action calls from test code.

Live execution is intentionally not a copy/paste command here. First obtain
approval for the exact installer-owned QA stack. Follow
[QA provisioning](../../docs/QA_PROVISIONING.md) and
[E2E safety](../../docs/E2E_TESTING.md); the tests do not provision or migrate it.

## Fail-closed prerequisites

`tests/support/records-policy.ts` is pure and runs before authentication:

- `TEST_SUITE=records`, `TEST_TARGET=local`; loopback app, commerce and Supabase
  origins; all usual exact site name/UUID variables; both
  `TEST_ALLOW_MUTATIONS=1` and `TEST_DISPOSABLE_ENVIRONMENT=1`.
- `QA_STATUS=VERIFIED`, exact `QA_ENVIRONMENT_ID`, at least 20 minutes before
  `QA_EXPIRES_AT`, unique `SHIPLIGHT_RUN_ID=<qa-id>-records-<unique-suffix>`.
  The legacy run variable name belongs to the shared harness, not an AI executor.
- `TEST_SUPABASE_URL`/`TEST_SUPABASE_ANON_KEY` and matching
  `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Public anon or
  publishable keys only; no service-role access, even for cleanup.
- Distinct `TEST_ADMIN_EMAIL`/`TEST_ADMIN_PASSWORD` and
  `TEST_FOREIGN_EMAIL`/`TEST_FOREIGN_PASSWORD`, with installer-owned
  `@<qa-id>.invalid` emails. Distinct `TEST_SITE_ID` and
  `TEST_FOREIGN_SITE_ID`, plus exact `TEST_SITE_NAME` and
  `TEST_FOREIGN_SITE_NAME`.
- `TEST_LEAD_NAME`: exact metadata-bound QA Lead whose non-null `company_id`
  references the synthetic global Company. No nonexistent company `site_id`
  assumption. Lead/company/member fixtures are read-only.
- `TEST_RECORDS_SUPPLIER_ID`, `TEST_RECORDS_SUPPLIER_NAME` and
  `TEST_RECORDS_ORDER_ID`, `TEST_RECORDS_ORDER_NUMBER`: operator-provisioned exact
  same-site synthetic rows in `suppliers` and **`sale_orders`**, respectively.
  Names/order number begin with `<qa-id><space>`. These are not present in the
  default provisioning battery: absence blocks the entire suite, including
  filtered runs, rather than skipping preview tests. Tests never create orders,
  bills, suppliers, stock, payments, or company associations.
- `TEST_RECORDS_RELATION_GUARD_READY=1`: operator attests that the reviewed
  `20261111032000_records_relation_admission.sql` is installed **locally**, with
  application/RLS/column grants compatible with the checkout. This flag cannot
  install a migration or prove it works; the direct DB cases verify admission.
- `TEST_RECORDS_TRASH_READY=1`: the three local recoverable Trash migrations
  described in [Records Trash](../../docs/RECORDS_TRASH.md) must be installed.
  Cleanup now retains deleted data in Trash until the disposable QA is destroyed.
- `TEST_RECORDS_LOCAL_EFFECTS_ACK=1`: operator has verified background worker,
  embedding, webhook and outbound network containment for this QA. Record
  creation/save schedules embedding work, and database triggers may enqueue
  work. An isolated loopback URL alone does **not** prove no external effects.
  Do not use real AI/provider keys or route QA requests to remote services.
  This is an attestation, not automated egress verification; queue/provider
  cleanup is not performed by this suite.

Before any fixture writes, each test authenticates public-key user sessions via
the existing `fixtureClient`, verifies actual server-owned QA auth/site metadata
and expiry, English profile language, unrestricted location RPC, exact target
rows, and active enabled admin membership. Member row ID must differ from its
`user_id`. Preview fixture names must fit the actual 80-character preview
contract; company industry and order total must be present. Browser site choice
is performed through `/projects` and its session is bound to the same backend
and admin. Missing schema/RPC/readability/fixture facts fail, never fall back to
an arbitrary first row or a privileged client. Supplied targets are never edited.

## Ownership and cleanup

- Each test uses a unique run marker. Subject Records are created through the
  real category-selected **New Record** UI, immediately capture the returned
  UUID, then title/save through the UI. Field and relation mutations under test
  always use actual controls and real Server Actions.
- One template is created via **New Category**. Other schemas and target Records
  are explicit scaffold inserts through public-key user sessions under RLS;
  those inserts are setup, not claimed UI coverage. Foreign scaffold belongs to
  the verified foreign account/site, not a privileged cross-tenant writer.
- Scaffolds omit IDs on INSERT to honor existing column-level grants. A durable
  intent and exact-marker absence check precede insertion. IDs are resolved from
  the generated row and verified by exact site/marker. No upserts or retry loops.
- `records-owned.json` in the private test output records exact IDs, actor/site,
  marker and unresolved creation attempts. UI category reconciliation only
  resolves a freshly absent exact name. An unresolved UI Record create blocks
  category cleanup rather than guessing which Untitled Record to delete.
- Cleanup uses authenticated owner clients with exact UUID/site/category (and
  marker where available), moves Records to Trash before categories, verifies active-list removal and retained Trash identity,
  and refuses a category with any remaining visible records. No site-wide,
  prefix-wide, global, or service-role deletes. Authorization is checked again
  before cleanup; expiry/revocation can leave data for explicit reconciliation.
  The remaining-child check is RLS-visible, not an RLS-hidden-row audit; this
  relies on verified unrestricted QA owner access and exclusive run ownership.
- Primary and cleanup errors are both retained. A process crash may leave rows;
  the journal is evidence for an operator, not permission for a global reset.
  Exact IDs remain journaled as pending physical QA teardown; no purge or content
  destruction is performed by suite cleanup. Auxiliary processing is not fully
  audited here; the entire QA must remain disposable and contained.
- Auth state/traces and run journals are sensitive local artifacts. Never upload
  credentials or `.auth` files. No real clinical, academic or customer records.

## Coverage matrix

| Case | Entry path | Durable evidence and boundary |
| --- | --- | --- |
| Zero/date/false/unset/enum | UI field edits | Exact JSON `0`, browser-local `YYYY-MM-DD`, `false`, then `null`, configured enum; reload controls; no create option for unlisted enum |
| Immutable key/display label | UI category create/edit and Record edit | Key disabled in editor, persisted key unchanged after label rename, old-key value remains `0`, reloaded new label |
| Populated schema guard | UI template retype/save | Explicit migration-required error; original template and Record data unchanged |
| Required active transition | UI status/save | Missing required field rejects without changing timestamp/data/draft; zero then permits active status and reload |
| Category-specific link | UI picker/save/preview | Settled backend search excludes wrong category; exact allowed ID in JSON, reload label and preview link |
| Site isolation | UI picker/detail plus independent user reads | Settled search excludes foreign ID, direct route returns to list, main RLS read empty; foreign owner verifies unchanged target; local link persists |
| Supplier/company previews | UI picker/save/Relations | Exact supplier/global associated company IDs persisted and labels/industry resolved after reload |
| Sales order/member previews | UI picker/save/Relations | Actual sale_orders ID and membership **user_id**, not row ID; order label, total field, member label/email |
| DB positive admission | Direct public Data API insert/update | Same-site/category link admitted, active membership user ID admitted, exact JSON re-read |
| DB negative admission | Direct public Data API update/insert | Wrong category, foreign, nonexistent, membership-row and undeclared links return `23514`; prior JSON/timestamp unchanged; rejected insert absent |
| Recoverable collection Trash | UI confirmation/delete/restore | Cancel does not change data; active subtree disappears; one-batch restoration restores collection/descendants but not earlier standalone trash; individual restore then succeeds |
| Stale editor conflict | Two authenticated browser tabs | Second tab cannot overwrite saved title/version, retains its draft, disables save and reloads the latest persisted value |

DB tests are deliberately in `db-admission.spec.ts`: they do **not** prove browser
or Server Action rejection. Positive UI assertions always include separate
user-scoped persisted reads; an optimistic toast alone cannot pass the case.
Negative picker assertions wait for the real filtered records response, avoiding
a false pass from a transient initial empty state. Preview checks exercise the
actual resolver through Relations, not mocked return values.

## Honest gaps / release gates

- No live success is claimed until this exact suite runs on an approved QA.
  Offline listing validates discovery/transpilation, not UI selectors or database
  compatibility. The strict extra supplier/order/local-effects gates currently
  need operator provisioning/verification.
- No 52-pack installer, registry/provenance, default business-template coverage,
  or clinical/academic compliance certification. See
  [repair status](../../docs/RECORD_SCHEMA_REPAIR.md),
  [schema review](../../docs/UX_PERSONALIZATION_RECORD_SCHEMA_REVIEW.md), and
  [template catalog](../../docs/UX_PERSONALIZATION_RECORD_TEMPLATES.md).
- No same-session site-switch race/late-response stress, location-restricted or
  assignment-restricted matrix, collaborator edit permissions, unsupported
  historical person migration, all target allowlist variants, or RLS-hidden
  category deletion certification. Foreign route isolation uses a distinct actor.
- No referenced-target deletion/reclassification, member disablement, company
  association removal, schema/write concurrency race,
  bulk edits, table/file/AI fields, multi-value relations or requiredness tightening
  matrix. These remain separate unit/database/design gates, not inferred passes.
- Existing status terminology still differs between detail (`active`) and
  list/Kanban (`published`). The active-transition case proves detail persistence,
  not correct list grouping; unify that contract and add list/Kanban acceptance
  before claiming status coverage across views.
- No broad console/network health certificate or proof of embeddings, graph
  layout, insight generation, sidebar stale-preview races, exports, or search
  privacy. Target preview coverage is positive same-site admission; exhaustive
  cross-target preview denial remains in the security regression suite.
- No remote migrations, production build, deployment, or target execution is
  authorized by this specification or by a passing offline check.