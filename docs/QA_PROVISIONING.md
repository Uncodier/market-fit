# Local deterministic QA provisioning

`scripts/e2e/provision-qa.cjs` seeds only an explicitly disposable, loopback
Supabase installation of the sibling `makinari-db-scheme/bootstrap` schema.
It does not install, migrate, deploy, reset, or clean up a database. No live
provisioning is part of the Jest suite.

## Required configuration

The script reads `.env`, then `.env.local`, then process variables (highest
precedence). Neither dotenv file is rewritten.

- `TEST_TARGET=local`
- `QA_ENVIRONMENT_ID=qa-<unique-lowercase-run-name>`
- `QA_EXPIRES_AT=<future-UTC-ISO-timestamp>`; reruns require the same expiry
- `TEST_BASE_URL` and `TEST_COMMERCE_BASE_URL`: loopback HTTP(S) origins
- `NEXT_PUBLIC_SUPABASE_URL` and `TEST_SUPABASE_URL`: matching loopback origins
- `TEST_SUPABASE_ANON_KEY`: public anon JWT or publishable key
- `QA_SUPABASE_SERVICE_ROLE_KEY`: separate local service-role JWT or secret key

For VM compatibility, a missing test URL/public key/setup key is populated from
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`, respectively. Target, expiry and mutation consent
are never inferred. If the application public key is supplied, it must match
the test public key. Never supply production credentials, even behind a tunnel.

Apply additionally requires **both** `TEST_ALLOW_MUTATIONS=1` and
`TEST_DISPOSABLE_ENVIRONMENT=1`, and one read-only schema inspection channel:

- `QA_DB_CONTAINER`: the explicit local PostgreSQL container name. Docker uses
  the local Unix socket, not an ambient remote Docker context.
- Alternatively, `QA_DATABASE_URL`: a loopback PostgreSQL connection URL for
  `psql`. It is supplied through the child environment, not command arguments.

The operator must ensure this PostgreSQL connection/container is the database
behind the configured Supabase API. Preflight uses a read-only transaction to
inspect RLS and the bootstrap's workflow webhook local-destination guard.
Missing tools, schema, RLS or guard fail before SDK writes. The guard may suppress
an unconfigured webhook; this is **not** proof of workflow execution.

## Commands

```bash
# Offline, no connections or filesystem writes, never reported as PASS:
node scripts/e2e/provision-qa.cjs --plan

# Only after explicit permission to mutate this disposable local installation:
TEST_ALLOW_MUTATIONS=1 TEST_DISPOSABLE_ENVIRONMENT=1 \
  QA_DB_CONTAINER=<local-postgres-container> \
  node scripts/e2e/provision-qa.cjs --apply

# Offline regression tests:
npm test -- --runInBand __tests__/e2e/qa-provisioning.test.js
```

Load the other required values from private local configuration before either
command. Default mode is `--plan`; unknown or conflicting options are refused.
Supabase requests are pinned to the configured origin and redirects are refused.

## Initial battery and verification

- Five deterministic, confirmed Auth identities: admin, collaborator, marketing,
  foreign and buyer. Passwords are random and persisted privately for reuse;
  emails use a run-owned `.invalid` domain. Auth ownership is in app metadata.
- Main and foreign sites, active memberships, settings, and zero-credit manual
  local `engine` billing entitlements. These allow role capacity without any
  Stripe IDs, payment state or external subscriptions. Settings precede member
  insertion because member triggers otherwise generate their own settings IDs.
- Catalog/record categories, a global company (the schema has no company tenant
  column), expense accounting account, inactive agent, pending campaign.
- Zero-price purchasable product, reservable service and recurring product;
  draft smoke content and a buyer-linked lead with campaign/company dependencies.
  Catalog images use the real repository static asset `/images/logo.png`, not
  generated images or fabricated API responses.
- Shared `assets` bucket prerequisite if absent. An existing compatible bucket
  is explicitly reused, not claimed as run-owned; it is never updated/deleted.
  Asset object prefixes are run-owned; no object upload is performed.

Privileged access is limited to Auth/setup and setup inspection. Five independent
public-key password sessions verify identity/profile, effective memberships,
persisted fixtures, tenant visibility and `user_can` role capabilities. Marketing
is read-only under the actual bootstrap `user_can` helper; collaborator can
insert/update but not delete. Foreign and buyer sessions must not see private
main-site content; the buyer must see the public product. These are read/RPC
checks, **not** successful browser journeys or attempted write-denial evidence.
The bootstrap creates `profiles.language='es'` and does not consume language
Auth metadata. Initial setup sets only the five exact journal-owned QA profiles
to `language='en'` through their own public-key sessions, with exact identity
reads, conditional updates and persisted verification. Expected profile
fingerprints are journaled; real accounts are never touched.

For a previously verified QA run, explicitly set
`QA_ALLOW_SMOKE_ADJUSTMENTS=1` on the authorized `--apply` invocation to repair
legacy Spanish profiles and null catalog images. Image adjustment requires the
exact prior fixture fingerprint and every old planned field to match. It records
a separate durable adjustment intent with old/new fingerprints before the
user-scoped admin update, verifies the new row, then advances ownership. Existing
custom images, unrelated drift and unjournaled partial changes are rejected.
Matching interrupted adjustment intents can resume safely. Without this flag,
legacy product drift is never overwritten; later profile-language drift also
requires explicit adjustment consent. No image generation endpoint is mocked,
skipped or granted extra permissions.

## Private artifacts, reruns and failure

All artifacts live under `.auth/qa-fixtures/<QA_ENVIRONMENT_ID>/` (gitignored,
directories `0700`, files `0600`):

- `env.json`: flat test variables, five credentials, exact fixture IDs/names,
  smoke variables, buyer/customer linkage, asset prefix. No setup key or tokens.
- `journal.json`: environment binding, credentials, exact plan fingerprints,
  persisted write intents and verification events; treat it as secret.
- `summary.json`: sanitized status/counts and explicit unverified areas.

IDs/names are deterministic by environment ID. Existing rows/users require the
matching private journal intent **and** exact expected persisted fields. Exact
IDs without journal ownership, same names/emails under other IDs, mismatched
metadata, changed expiry/backend or fixture drift fail; nothing is adopted or
overwritten. A private lock rejects concurrent runs.

The sole legacy-plan exception is a failed `expense-account` intent whose key
was the hyphenated QA ID: after fresh exact-ID and scoped-code absence checks,
the script may replace only that known intent fingerprint with the underscore
key required by `accounting_guard_account`, recording both fingerprints. Any
existing row, verified intent, or other plan difference still fails closed.
No database row is updated by this repair.

Inspect interrupted processes before manually removing a stale lock. Partial successful inserts remain after
failure; reruns recover only exact journal-owned identities. No broad deletes,
automatic cleanup, password resets, upserts or blind retries exist.

Once an apply attempt opens its journal, prior environment/success files are
invalidated. Failed verification leaves `QA_STATUS=INCOMPLETE` without test
credentials in `env.json` and a failed summary; credentials remain only in the
private journal for exact rerun. Successful output uses `QA_STATUS=VERIFIED` and
defaults `TEST_ALLOW_MUTATIONS=0`: provisioning consent does not authorize a
subsequent browser mutation suite. Select and authorize that suite separately.

Expiry is a validity gate, not an automatic deletion schedule. Keep these files
out of logs, CI uploads and version control; eventual exact-ID cleanup requires
separate authorization and provider-aware design.

No Robot instance/provider lifecycle, active social/OAuth connection, storage
upload, paid Stripe settlement or completed reservation/POS checkout is claimed.
The reservable/recurring flags do not provide registers, booking resources,
calendar slots, subscription fulfillment or payment infrastructure.