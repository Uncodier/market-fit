# Records schema and relation repair

**Status:** Local implementation; Records migrations applied and verified on linked
Makinari (`public`) on 2026-11-11. Not a
template-pack installer or approval to release sensitive business schemas.
**Date:** 2026-11-10.
**Follow-up:** [Recoverable Trash and reviewed repairs](RECORDS_TRASH.md) supersedes
the original delete-category restriction and request-time-only version check below.
**Design:** [Template catalog](UX_PERSONALIZATION_RECORD_TEMPLATES.md) and
[review findings](UX_PERSONALIZATION_RECORD_SCHEMA_REVIEW.md).

## Implemented application changes

- Records list defaults to all dates, matching the relation sidebar's loaded
  inventory. Date filtering is explicit and can be cleared with All time; choosing
  a category/relation resets pagination. Load failures show an error/retry instead
  of the successful-empty state. This is a presentation repair, not a data migration.
- Relation targets use an allowlist. Sales orders resolve through `sale_orders`;
  suppliers have a dedicated `suppliers` target. Unknown tables and `person` are
  unavailable; no historical UUID is reinterpreted as a Lead, person or profile.
- Shared company choices are derived from readable site-associated Leads, Deals,
  or Suppliers. Companies are never queried with a nonexistent `site_id` column.
- Internal relation fields can declare `targetCategoryId`. Picker, preview and
  write validation enforce the expected site/category rather than treating every
  Record as interchangeable. Legacy generic Record links remain generic.
- Site/category changes invalidate picker requests; late responses are discarded.
  Selected IDs are re-read within the same boundary, not restored from stale cache.
  Failed/unsupported reads have explicit form errors, not successful empty results.
- Preview actions require site context and authorization; callers supply actual
  record/current-site context. Composite target keys avoid ambiguous UUID aliases.
- `field.name` remains the immutable storage key. Optional `field.label` changes
  form/editor presentation without renaming stored data or relation keys. Existing
  names are not translated or silently migrated to new identifiers.
- Number zero remains visible, new date values use local calendar `YYYY-MM-DD`,
  legacy timestamps remain readable, booleans distinguish unset/false, and enum
  inputs accept configured options only. Relations select existing entities only;
  entity creation is a separate authorized workflow.
- Server Actions validate declared scalar types, bounds, requiredness, table rows,
  relation UUIDs, target existence/readability, same-site scope and optional target
  category. Staff links use active enabled membership `user_id`, not the row ID.
- Drafts allow missing required values so the existing title-first creation flow
  works; supplied values are always validated. Non-drafts require complete fields.
- Category changes preserve existing keys. The original deployed guard blocks
  contract changes on any populated category. The local value-aware replacement
  described below checks only the affected fields. Unknown legacy values can
  remain unchanged; new undeclared data/relations are rejected, with a limited
  compatibility allowance for known AI-feedback metadata.
- Record updates now compare the caller's loaded `updated_at`, not merely a version
  fetched at save time; stale editor saves return a conflict.
- Category deletion now atomically trashes the active subtree and records, with
  selective batch restoration; it no longer refuses populated collections.
  Relation-history queries validate the configured field and use JSON containment
  instead of interpolating a client field into a PostgREST expression.

## Database migration: applied to linked Makinari

`supabase/migrations/20261111032000_records_relation_admission.sql` adds a
`SECURITY INVOKER` trigger for relation admission on direct inserts and changes to
relations/category/site. It uses the caller's target SELECT permissions, the
allowlisted table mapping and same-site/category checks. It rejects new unsupported
person references and preserves unchanged historical opaque links on updates.
It also adds a narrowly scoped, execute-revoked `SECURITY DEFINER` category trigger
that checks for populated categories including RLS-hidden records and rejects
destructive/tightening field changes. It returns no record data or extra privileges.
The local follow-up validates category definitions on insert/update: unique field
IDs/storage names, supported types/targets, valid bounds/options and record-only
category constraints. New `person` definitions are refused; legacy nullable
templates/values and unchanged legacy links retain explicit compatibility paths.

It does **not** change existing RLS, assignment rules, location restrictions, or
category foreign-key deletion behavior, and it does not rewrite existing rows.
The four renumbered Records migrations were applied to linked project
`rnjgeloamtszdjplmqxy` at 03:15:48 UTC on 2026-11-11 and independently verified at
03:16:13 UTC. No customer records were trashed/restored. Other destinations still
require explicit approval; do not replay applied migrations.

## Value-aware field edits (local only)

`20261124010000_records_field_value_compatibility.sql` replaces the installed
category trigger function without rewriting stored records or changing RLS. It
checks actual values in the same site/category, including hidden and trashed
rows. Empty fields can be removed, retyped or retargeted. Text, description and
select can switch without conversion when stored values meet the new rules.
Compatible bounds, unused option removal and requiredness changes also succeed;
missing required values only block non-drafts. Zero and false count as values;
tables with no rows do not. Edits that check hidden values require an owner or
admin without assignment or location restrictions. Presentation edits and
changes that only relax constraints do not check record values.

`20261124011000_records_schema_write_fence.sql` adds a user-scoped save RPC.
It compares the template used for validation under the Records site lock,
checks the document version on updates, and preserves the table's RLS and
column admission triggers. The category editor compares its original category
version and returns a conflict rather than overwriting a newer template.

Apply both migrations on an approved target before deploying the application.
Verify the installed category and record trash write guards use the same site
fence. Direct Data API scalar writes retain their existing validation limits;
the new application save path does not replace all record writers. The isolated
PostgreSQL suites do not establish full target integration or browser acceptance.

## Remaining release gates

1. JSON links are still not foreign keys. Reverse integrity for target deletion,
   reclassification, membership disablement and company-association removal,
   including concurrent changes, requires a separate database design.
2. The migration validates relation admission, field definitions and populated
   field contracts, but not scalar record values/requiredness through the direct Data API.
   Direct writers do not carry the application's template snapshot. The follow-up
   Trash migrations prevent physical category deletion and
   convert permitted record DELETEs into recoverable trash.
3. Existing assignment RLS matches user UUIDs inside relation JSON; attribution and
   assignment remain coupled. Existing location restrictions deliberately block
   some linked-record/category journeys. No service-role or permissive fallback
   was added. Changing those policies needs an explicit authorization design.
4. The 52 business templates remain a specification. Installation/version registry,
   template-to-category provenance, cross-record clinical/academic rules, additional
   review/content/recipe links, and requiredness variants are not generated here.
5. Clinical, academic and other sensitive packs remain blocked on identity,
   retention, audit, file, AI/embedding, search and export controls. This repair does
   not certify compliance or authorize real sensitive data.
6. New company association searches are bounded and fail closed if too large;
   unrestricted cross-tenant company selection is intentionally not restored.
7. Display-label adoption outside the form/editor is incremental; immutable names
   remain valid labels for existing graph/history consumers.

## First-save version stability

Previously, saving a regenerated summary and embedding also advanced
`records.updated_at`. A background job could therefore invalidate the version
loaded by the editor without changing its title, fields, relations, or status.
The forward migration `20261123174000_records_document_modified_at.sql` keeps
the editor's version stable for derived-only writes. Real document and
lifecycle changes still advance the version. Save continues to compare the
exact loaded timestamp and reject stale writes; no automatic retry or new
database grants are introduced.

`__tests__/records/record-document-version-postgres.test.ts` reproduces the
false conflict and verifies the first conditional write after indexing, using
an isolated PostgreSQL instance. The migration has not been applied remotely.

## Validation commands

The dedicated [Records E2E suite](../specs/tests/records.md) covers real browser
and Data API journeys, with separate reporting for each layer. It was prepared
for offline validation; no QA browser execution is authorized until a disposable
target is supplied. Accessible field groups and template-edit labels support
deterministic selectors; relation option lookup is disabled while active site
and loaded record site disagree.

Use the repository's npm runtime:

```bash
npm test -- --runInBand __tests__/records
npm run typecheck
npm run test:e2e -- --suite records --list
npm run test:e2e -- --suite records --validate
```

The relation-admission suite starts a disposable socket-only PostgreSQL cluster
when `/opt/homebrew/opt/postgresql@17/bin` exists (override with
`RECORDS_TEST_PG_BIN`). It does not use application database credentials. Its
same-site, wrong-category, RLS denial, member, company, person and rerun cases
exercise the migration locally; they do not prove full remote policy integration.

No production build or browser E2E against an unspecified environment is required
or authorized by this guide. Refer to the task handoff for actual test counts and
pre-existing lint findings.