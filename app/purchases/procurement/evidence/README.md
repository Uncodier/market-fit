# Account credentials and selectively shared evidence

## Implemented local slice

- `/home` reuses `BuyerShell`; `/home/orders`, `/home/quotes`, `/home/library`,
  `/home/subscriptions` reuse existing buyer pages. `/buyer` and detail links stay
  intact. This is an **additive, transitional alias**, not a completed URL migration.
- `/home/profile` reuses the existing buyer profile and adds personal credential
  metadata, private uploads, immutable revisions, downloads and archival.
- `/home/submissions` (also `/home/tenders`) lists only opportunities authorized by
  an explicit supplier representation grant. The optional `publication` query
  filters that authorized list; it never grants access or submits automatically.
- Supplier quotations use the existing procurement quotation RPC. Explicit evidence
  selection is attached atomically and pins a publication, requirement and revision.
- `RepresentativeManager` lets buying managers grant/revoke an independently verified,
  email-confirmed account. Contacts and company links never confer authority.
- `SharedEvidence` presents exact submitted revisions to authorized buying managers
  after publication opening; it never displays an acceptance or authenticity result.

## Security and migration order

Apply only through the repository's approved migration process after explicit target
approval. Nothing here authorizes remote changes. Prerequisites include the procurement
supplier/tender/quotation migrations. `73005` fails closed before representation or
evidence helpers are installed.

1. `20261027174000_procurement_supplier_representation.sql`: account grants and audit.
2. `20261027174001_procurement_credentials.sql`: personal records, revisions and private
   `procurement-credentials` bucket.
3. `20261027174200_procurement_submission_evidence.sql`: atomic selective sharing,
   opening-aware RLS and safe external participation DTO.

All APIs use authenticated user-scoped Supabase clients, not service clients. Credentials
do not require workspace membership. Mutation APIs validate same-origin requests.
An account-scoped transaction lock enforces 128 MiB total reserved storage, including
archived and incomplete revisions. Files are limited to 8 MiB, PDF/PNG/JPEG, with server
signature checks, opaque database-generated paths and no overwrite. Storage insertion
requires metadata size/type matching the reservation. Restrictive policies protect the
bucket even when legacy storage policies are permissive. Download responses are private,
uncached attachments with no public or signed bearer URL.

Buyers cannot browse a holder's entire profile or latest revisions. They see only explicitly
shared immutable revisions. `after_close` requires both opening and participation deadline
to pass; unknown opening policies do not grant access. Archival never deletes submitted
files. Account-keyed SWR caches and keyed editors avoid cross-account UI state reuse.

## Explicit limitations

- Only person-owned credentials are supported. Supplier-specific representation is not
  organization membership or global organization credential-management authority.
- Legal representation documents can be uploaded as personal evidence; they do not
  automatically prove representation or create account grants.
- Requirement IDs are publication-pinned, but normalized certification taxonomy,
  required holder/scope equivalence, mandatory enforcement and expiry-at-milestone
  rules are not implemented. Sharing optional evidence does not establish eligibility.
- The existing robot assistant is a workspace/instance orchestration API, not a
  credential-assessment worker. The profile explicitly reports pending/unconfigured;
  no AI report, issuer verification or fabricated acceptance is generated.
- Tender-specific human review/acceptance, direct-purchase evidence, organization
  authority and automated review/verification remain unimplemented.
- Failed uploads remain pending and count against quota. No abandoned-upload cleanup
  or resumable-upload UI is supplied. Archive retains history and is not erasure.
- No malware scanning or PDF sanitization is claimed. Downloads are attachments, not
  embedded previews. Storage metadata enforcement still needs deployment verification
  against the actual Supabase Storage upload lifecycle.

## Validation

```sh
npm test -- --runInBand __tests__/procurement/evidence-api.test.ts \
  __tests__/procurement/evidence-postgres.test.ts \
  __tests__/procurement/evidence-ui.test.tsx
```

The PostgreSQL suite starts a disposable socket-only cluster and applies actual migrations
with a non-superuser function owner. It covers private/foreign/anonymous storage access,
grant revocation, immutable revisions, stale/concurrent edits, upload completion, byte
quotas, rollback on foreign evidence, sealed sharing, opening and archival retention.
It is not a live Supabase upload or browser end-to-end test.