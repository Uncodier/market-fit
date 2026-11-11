# Recoverable Records Trash

**Status:** Database migrations applied to linked Makinari (`public`) on 2026-11-11
at 03:15:48 UTC and independently verified at 03:16:13 UTC. Live browser success
and application deployment are not claimed. See [repair history](RECORD_SCHEMA_REPAIR.md) and
[Records E2E contract](../specs/tests/records.md).

## Behavior

- Deleting a record moves it to Trash; its content, fields, relations and diagram
  remain stored. There is no permanent-delete/purge control in the UI.
- Deleting a collection moves the active category subtree and its active records
  to Trash in one transaction. Confirmation explicitly includes all contained
  records, not only those visible under the current filters.
- The operation assigns one deletion batch and root category. Restoring that root
  restores only categories/records belonging to that batch. An item already in
  Trash before the collection deletion remains there.
- Standalone records can be restored after their parent category is active.
  A child belonging to a collection deletion is restored through the root, not
  through a separate button. The UI displays root collections and standalone records.
- A separately deleted child collection requires its own restore; restoring an
  ancestor does not silently restore previously deleted descendants.
- Existing system collections, including AI Feedback, cannot be trashed as a
  collection. No schema, identity or relation UUID is reinterpreted during restore.
- AI-feedback records with a source identity remain managed through their original
  conversation/robot controls. Only that existing backend service-role deletion
  lifecycle retains physical removal; ordinary users cannot use it as a purge path.

## Authorization and concurrency

- Record trash uses the existing DELETE RLS through an invoker RPC. A DELETE
  trigger converts permitted deletion into a metadata-only update and suppresses
  physical deletion/cascades. It does not grant delete access to new users.
  The narrowly matched backend AI-feedback exception above is not a general
  service-role purge permission for ordinary records.
- Collection trash, all restoration and Trash listing require a trusted active
  owner/admin, the relevant `user_can` permission and unrestricted site-location
  access. Membership labels or client-supplied site IDs do not grant access.
- Ordinary SELECT adds an active-only restrictive policy for records/categories;
  Trash listing is a minimal authorized RPC, not a bypassing query from the browser.
- Clients cannot write trash metadata. Privileged content/diagram writers cannot
  edit deleted content; restore changes deletion metadata only.
- Site advisory locks serialize trash/restore against category/record creation
  and moves. Identity/site changes are forbidden. Deadlocks may abort a whole
  transaction rather than allowing partial collection changes; no automatic
  replay of uncertain mutations is added.
- Normal editor saves require the exact `updated_at` loaded by the caller. A
  mismatch returns a conflict before writing; a second compare-and-set detects
  concurrent changes during validation. The editor retains unsaved input, displays
  a conflict and offers Reload. Successful saves advance the local version token.

## Relations and background processing

Existing unchanged relation values can remain as historical references even when
their targets become unavailable. New/reassigned values require current readable,
same-site and expected-category targets. Moving between source categories does not
inherit this exemption. Historical reference preservation does not expose target
labels/content or grant permissions; previews independently reauthorize them.

Preview callers split requests to respect server limits and ignore empty legacy
values. Search queries survive changes in other relation selections. A loaded
record in the wrong category is not rendered as a valid constrained graph edge.

Trash cancels queued embedding jobs and guards future admission; the application
checks active readable records before contacting the embedding API. In-flight
external requests cannot be recalled by a database transaction. External workers
must recheck trash status before processing/saving; this repository cannot certify
external worker rollout. Saved diagrams and historical embeddings are retained.

## Migration and operational boundary

Apply only after review and explicit destination approval, in timestamp order:

The following versions are already applied to the linked Makinari project; do not
replay or edit them. Canonical evidence is in `makinari-db-scheme` under
`supabase/validation/20261111_records_trash.md`. Other targets require approval.

1. `20261111032000_records_relation_admission.sql` — relation admission and category
   field contracts, including unchanged historical-reference compatibility.
2. `20261111032100_records_trash_storage.sql` — markers, active SELECT restrictions,
   grants, write/identity guards and administrator authorization helper.
3. `20261111032200_records_trash_rpc.sql` — category/record trash, restore and list.
4. `20261111032300_records_trash_embeddings.sql` — retrieval/background safeguards.

No remote migration is performed by loading the UI or running offline tests.
Deploy application and migrations as a coordinated change; missing functions or
columns fail visibly rather than reverting to destructive DELETE behavior.

There is no automatic expiry or physical purge. Retention, permanent destruction,
storage reclamation and deleted asset lifecycle need separately approved policy.
Tests clean up Records through soft trash and keep exact IDs in their journal;
physical disposal belongs to destruction of the approved disposable QA stack.

## Validation and remaining boundaries

Local PostgreSQL tests exercise subtree atomicity, selective restoration, hidden
record handling, authorization, direct mutation denial, diagram retention and
queue exclusion. UI tests cover confirmation, errors and restoration. Authored
browser cases require the approved QA target and `TEST_RECORDS_TRASH_READY=1`;
this flag is an operator prerequisite, not evidence that the migration works.

This is not a complete JSON foreign-key implementation: references to deleted or
reclassified targets remain historical, not cascaded relational deletes. Required
clinical/academic cross-record constraints, sensitive-data processing policy and
the 52-pack installer remain separate work. Existing `active`/`published` status
terminology differences across views are unchanged by the Trash lifecycle.