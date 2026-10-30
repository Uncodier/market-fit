# Targeted procurement migration validation

## Authorized remote application

Target project: `rnjgeloamtszdjplmqxy`. The operator verified the configured host/user
and matching cached session-pooler identity internally without logging credentials.
Credentials were loaded with the frontend's installed dotenv from the authorized
DB-schema repository environment. PostgreSQL 17 `psql` performed the application;
no Supabase bulk migration command was used.

Only these migrations were applied, together in one transaction:

| Migration | SHA-256 |
| --- | --- |
| `20261030120000_procurement_open_self_participation.sql` | `449bfbcb56f031251d969683d94ac4e88f9f4444c2244ef639724da7d18ab764` |
| `20261030130000_procurement_proposal_attachments.sql` | `0a9936ec56f1717d9d9634ac3a11d7ab3ae3c3efc15ae6eb93d38b8ea1ce4268` |

The transaction included advisory serialization, a five-second lock timeout,
a 120-second statement timeout, expected-function hash drift guards, and one
`supabase_migrations.schema_migrations` insert per migration with the full canonical
SQL in `statements`. Post-application reads confirmed exactly one history row per
version and SHA-256 equality of the stored SQL and canonical files. No unrelated
pending migration was applied; unrelated procurement history remained identical.

Canonical files were copied byte-for-byte into the DB-schema repository's
`supabase/migrations/`. No historical migration was edited.

## Compatibility review

The actual remote `procurement_validate_commerce_event` and
`procurement_supplier_proposal_count` bodies matched
`20261028020001_procurement_commerce_lifecycle_repair.sql`. That prerequisite and
`20261028020000_procurement_lifecycle_repair.sql` were already recorded remotely.
The new validator preserves publication binding, unpublished-amendment rejection,
closed-tender version handling, deadlines, inherited requirements/proposal counts,
and award uniqueness, adding only the scoped self-participant supplier exception.

Other replaced remote function bodies matched their expected local baselines:
quotation capture, supplier submission, participation listing, evidence attachment,
and shared revision access. Referenced columns, supplier status/composite unique
constraints, credential constraints, quotation writer guards and supplier activity
triggers were inspected. No compatibility adaptation was needed. After application,
all seven replaced function bodies matched the final canonical SQL.

## Tests

Command (local disposable socket-only PostgreSQL clusters; no remote fixtures):

```bash
npm test -- --runInBand __tests__/procurement/proposal-postgres.test.ts __tests__/procurement/open-participation-postgres.test.ts
```

Result: **2 suites passed, 23 tests passed, no skipped tests**. Includes proposal SQL
contracts, sealed disclosure, scoped buyer/foreign/anonymous denial, invalid PDF
selections and rollback, archival/renewal retries, immutable receipts, concurrent
submissions, self participation, registration scoping, revoked supplier approval,
and award/order behavior. No build, deploy, commit, or UI edit was performed.

## Read-only remote security validation

Executed inside `BEGIN READ ONLY` after application:

- All three new tables have RLS enabled and active immutable mutation triggers.
- `authenticated` has SELECT only; no INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  or TRIGGER grants. `anon` and `service_role` have no table grants.
- Self supplier and registration policies require `user_id = auth.uid()`.
- Proposal policy requires the submitter or scoped `procurement_evidence_open`.
- All ten inspected affected functions are SECURITY DEFINER with
  `search_path=public, pg_temp`.
- Internal capture, evidence/proposal attachment, self-participation predicate,
  proposal counter and commerce validator deny browser/service-role execution.
- Authenticated execution is limited to registration, submission, participation
  listing and the existing shared revision predicate; anonymous execution denied.
- A synthetic unregistered authenticated JWT identity saw no rows in any new table
  and could not access an unrelated shared revision.

All assertions passed. Remote validation did not create identities, supplier rows,
quotations, credentials, or Storage objects. Live buyer/submitter allowed-path tests
were not performed remotely; those behaviors were exercised in the isolated PG
suites instead.
