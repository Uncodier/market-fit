# Migration audit and forward correction — 2026-10-22

The cross-repository Makinari audit reviewed 287 original SQL files against the
installed schema, functions, policies, constraints, grants and trigger bindings.
It found real contract gaps as well as a largely incomplete migration history.

## Installed web correction

`supabase/migrations/20261022032027_complete_channel_activation_and_paid_coverage.sql`
was applied to project `rnjgeloamtszdjplmqxy` and recorded under that exact version.
It completes the missing manual-channel capability/RPC and updates license
reconciliation to observe paid-coverage/subscription input changes.

The new migration is guarded by exact inspected bodies, owner/configuration/ACL,
dependency and trigger checks. Its postflight checks exact corrected bodies and
preserves existing function identities and grants. No settings/billing backfill,
credit grant, channel toggle or provider call was executed by installation.
The obsolete historical file was not replayed.

API forward corrections also converged the unused draft resume evidence/RPC,
restored the declared service-only legacy metrics ACL and bounded four vector
search paths while retaining current invoker/RLS semantics. The API repository
contains the full per-file report in `docs/MIGRATION_RECONCILIATION_AUDIT.md` and
`docs/MIGRATION_RECONCILIATION_AUDIT.json`.

## History safety

Seventeen fully verified metadata-only repairs and four new forward migrations
bring the remote history from nine to 30 entries. This **does not mean all
historical files are proven applied**. Twelve duplicate version groups, missing
bootstrap history, separate Apps-target files and unknown historical backfills
still prevent a safe blanket `db push`. Do not rerun foundation/location SQL or
mark additional versions applied solely because tables/functions exist.

The shared report lists every original file and its blockers. No remaining
confirmed functional/ACL/configuration gap found in this audit was silently
declared installed; the known gaps were corrected, while historical uncertainty
remains explicit. Production advisor findings beyond this scoped audit require
separate remediation: [database linter](https://supabase.com/docs/guides/database/database-linter).

## Validation

```bash
node node_modules/jest/bin/jest.js --config __tests__/security/jest.operational-offline.config.cjs --runInBand --testMatch '**/channel-coverage-forward.test.ts' '**/manual-agent-channel-activation.test.ts' '**/paid-coverage-license-reconciliation.test.ts'
```

The 28 existing semantic/security cases and four new guard cases use disposable
socket-only PostgreSQL, never a configured production connection. Remote
postflight confirmed corrected bodies/ACLs and an empty resume receipt table.
Postmaster start remained `2026-10-22 00:02:46.412272+00` with zero Lock waits in
the final 03:33 UTC capture. Short observations do not prove long-term stability.