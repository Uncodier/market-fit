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
- Category changes preserve existing keys. Populated fields cannot be removed,
  retyped, retargeted, or tightened without explicit data migration. Unknown legacy
  values can remain unchanged; new undeclared data/relations are rejected, with a
  limited compatibility allowance for known AI-feedback metadata.
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

## Remaining release gates

1. JSON links are still not foreign keys. Reverse integrity for target deletion,
   reclassification, membership disablement and company-association removal,
   including concurrent changes, requires a separate database design.
2. The migration validates relation admission, field definitions and populated
   field contracts, but not scalar record values/requiredness through the direct Data API.
   Concurrent first-insert/schema-edit constraint changes still need dedicated
   review. The follow-up Trash migrations prevent physical category deletion and
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