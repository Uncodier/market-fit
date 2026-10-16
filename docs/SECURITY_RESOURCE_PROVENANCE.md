# Security resource provenance and display order

The Security & API screen keeps user-managed resources above automatic ones.
Within each group, records remain newest first. The quick-navigation links use
the same order and IDs as the displayed cards, including after deletion.

## API keys

`metadata.issued_by` identifies the two known automatic key issuers:

- `harness.requirement-provisioning` (current harness provisioning).
- `platform-api.ensure-platform-key` (earlier Platform API provisioning).

Both appear below a single "Automatically created API keys" divider and show
their issuer label. Other keys appear first; absence of a known issuer is not
proof that a historical key was manually created. Names, prefixes, scopes and
requirement references are not used to infer provenance. This is display
grouping only, not an authorization or deletion rule.

## Allowed domains

The forward-only migration
`supabase/migrations/20261016171100_allowed_domain_provenance.sql` adds:

- `source`: `unknown` (default), `user`, or `harness`.
- `requirement_id`: optional requirement provenance, restricted to the same site.

Manual inserts from `app/hooks/use-allowed-domains.ts` send `source: 'user'`.
The API repository's `src/lib/services/requirement-tracking-site.ts` registers
previews with `source: 'harness'` and the validated requirement ID. Its
duplicate-ignore upsert preserves an existing row's original provenance, even
if a preview subsequently uses a user-added or historical domain.

The screen displays user domains first, historical/unknown domains next, and
harness domains last with an "Automatically created domains" divider. Every
domain carries an explicit provenance label. There is no hostname-based
backfill: existing preview-looking domains remain unknown until their origin
can be independently established.

The migration preserves the table's existing RLS and privileges. Its provenance
guard prevents browser clients from assigning harness provenance or changing
an existing row's source or requirement reference. The requirement/site foreign
key prevents cross-site references. Deleting a requirement clears only its reference,
retaining the domain and its source; site archival/deletion and normal domain
deletion retain their existing behavior.

## Rollout

1. Confirm the target database schema and approve migration application.
2. Apply the migration before deploying the changed API and frontend writers.
3. Deploy both repositories' changes and reload the Security & API screen.

The column-specific `ON DELETE SET NULL (requirement_id)` requires PostgreSQL
15 or newer. Index and foreign-key installation take table locks; the migration
has a five-second lock-acquisition timeout. Review table sizes, existing schema,
policies and trigger ownership against the approved target before application.

Applying the migration remotely and deploying either repository are separate
operations requiring approval. The frontend can read older rows without the
new fields as unknown, but new domain writes require the migration. Writers do
not silently retry without provenance when the schema is missing.

## Regression coverage

- `__tests__/components/security/security-resource-order.test.ts`: classification,
  ordering, timestamp handling and no name/hostname inference.
- `__tests__/components/security/security-resource-lists.test.tsx`: rendered
  order, labels/dividers, navigation, creation and deletion.
- `__tests__/hooks/use-allowed-domains.test.tsx`: persisted manual provenance
  and missing-schema failure behavior.
- Migration contract and isolated PostgreSQL tests in `__tests__/security/`:
  provenance guards, same-site integrity, duplicate preservation and deletion.
- API requirement-tracking and preview-site suites exercise the server writer.

PostgreSQL tests use a disposable socket-only local cluster, never a configured
database URL. UI Jest tests are offline component tests, not proof of deployed
behavior or a live authenticated browser session.