# Records lock contention correction

**Status:** blocked after review, not applied. The candidate is
[`20261120232000_records_lock_concurrency.sql`](../supabase/migrations/20261120232000_records_lock_concurrency.sql).
The linked database was inspected over TLS using catalog SELECTs inside
`BEGIN READ ONLY`; no remote SQL writes, migrations, or production test fixtures
were run. The deployed lock-bearing functions, trigger bindings, security modes,
and record/site foreign keys were checked against the local migration history.

## Blocking review findings — November 20, 2026

Do not apply this candidate. Broader review found that restoring 15,004 records
regresses from 458 ms before the patch to a 51.5-second `53200` shared-lock-memory
failure afterward: it acquires redundant per-record locks while already holding
the exclusive site fence and repeatedly scans `pg_locks`.

The actual API worker also saves four node embeddings of the same record in
parallel. These newly fail with `40001` instead of waiting; its existing job-level
retries are not a validated substitute. The canvas maps the same transient error
to a revision conflict, disables Save and offers a reload that discards edits,
even when the revision did not change. Fix the migration and caller handling and
add regression coverage for these cases before approval.

On November 20 at 22:29 UTC, independent remote verification confirmed no history
entry for this migration and no `records_lock_private` schema. Only the separate
message lock-order migration was applied. The rejected Records SQL was not
copied into the canonical migration directory.

## Lock protocol

| Operation | Site fence | Additional behavior |
| --- | --- | --- |
| Normal record inserts/edits, diagrams and node embeddings | Shared | A nonwaiting exclusive content lock for the specific record avoids mismatched record/diagram revisions. |
| Revision-aware embedding enqueue | Shared | Takes the same record content lock before reading both revisions. |
| Job claims and direct admission of pending, processing or failed jobs | Shared | Admission rechecks trash state. Trash still cancels jobs to a terminal state atomically. |
| Category trash/restore and standalone restore RPCs | Exclusive | Acquire before locking rows. May wait when there is no existing advisory lock in that transaction. |
| Standalone record trash / direct `DELETE`, category writes, and record category/location or trash-marker changes | Exclusive | Nonwaiting from row triggers; never wait for the site fence while holding a row lock. |

The site key remains `hashtextextended('records-trash:' || site_id::text, 0)`.
Shared holders can write distinct records concurrently. Category edits and record
moves stay exclusive to preserve ordering with field and relation admission.
An exclusive holder can perform nested shared work (for example, enqueue after a
move). A shared-only holder cannot upgrade the site lock. In multi-site batches,
row-trigger acquisition still never waits, and lifecycle RPCs do not wait for a
second key if the transaction already holds an advisory lock. The existing
standalone trash invoker RPC still uses DELETE RLS and its original receipt.
The narrow service-role AI-feedback hard-delete exception is unchanged.

Why the row-trigger locks do not wait: PostgreSQL can lock a tuple before its
`BEFORE UPDATE`/`BEFORE DELETE` trigger runs. A category trash transaction can
already own the exclusive site key and be waiting for that same record or job
tuple. Waiting for the site key from the row trigger would close a deadlock
cycle. The trigger instead rejects the late operation with SQLSTATE `40001`.
After trash commits, diagrams are still read-only, ordinary reads remain hidden,
and any re-enqueued job is terminal. After restore commits, a new transaction may
edit or enqueue again. Historical diagrams and existing trash batches are
retained. The per-record fence is additional to, not a replacement for, the site
fence. The canvas save refreshes its record revision after taking both locks.

## Compatibility and rollout gates

- `40001` requires a fresh transaction. Surface the conflict and preserve user
  edits or reschedule the job as appropriate; do not automatically replay an
  uncertain or non-idempotent mutation. No application or worker retry behavior
  was changed. Contending same-record writers or a mixed ordinary/structural
  batch can now fail fast. Transactions needing exclusive access must take that
  path first or perform the ordinary writes separately.
- **Verify node-embedding fan-out before rollout.** Parallel embedding saves for
  different nodes of the same record also contend on the per-record fence, even
  without trash activity. Before applying the migration, workers must either
  serialize saves per record or handle `40001` with a verified idempotent retry
  in a fresh transaction, rechecking the expected revision and source hash.
- Guarded writes require PostgreSQL `READ COMMITTED` isolation (which also backs
  `READ UNCOMMITTED` in PostgreSQL). `REPEATABLE READ` and `SERIALIZABLE` fail with
  `0A000`: a fixed snapshot can still see pre-trash content after the lifecycle
  transaction releases its advisory lock. Check for external callers configured
  with those isolation levels before deploying.
- This change does not make arbitrary multi-row DML deadlock-free. PostgreSQL row
  and foreign-key locks can still conflict independently of the advisory protocol.
  External requests already sent by embedding workers cannot be recalled; workers
  must still recheck trash and revision state. The old enqueue overload without a
  record revision is unchanged except for the common job admission guard.
- Plan an approved, quiet rollout with affected Records writers and workers
  paused. The migration briefly takes `SHARE ROW EXCLUSIVE` on the six affected
  tables to prevent old and new lock modes from mixing; it fails if lock
  acquisition times out after five seconds. Verify audited function definitions,
  ACLs, enabled triggers, and representative identities before applying. Monitor
  advisory waits, `40001` and retries after rollout. No production latency result
  or full Supabase/browser replay is claimed here.

## Local validation

The regression starts a disposable Unix-socket-only PostgreSQL cluster and uses
independent `psql` sessions. It establishes order with explicit transactions and
`pg_blocking_pids`/`pg_locks`, not elapsed-time assumptions. It exercises the actual
canvas save, revision-aware enqueue, job claim, relation and trash functions on
the local fixture. Coverage includes distinct records sharing one site key,
both same-record revision orderings, multi-record edits/inserts, subtree trash
and restore order, record/job tuple inversions, cross-site reparenting, direct
standalone deletion, read-only state, job terminalization, ACL/tenant/location
denials and fixed-snapshot rejection. Production credentials are not used by the
suite.

```sh
PATH=/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:$PATH npm test -- --runInBand \
  __tests__/records/records-lock-concurrency-postgres.test.ts \
  __tests__/records/trash-database.test.ts \
  __tests__/records/record-diagram-trash-guard-postgres.test.ts \
  __tests__/records/record-diagram-migrations.test.ts \
  __tests__/records/creator-access-database.test.ts \
  __tests__/records/relation-admission-migration.test.ts
```

All six suites (95 tests, including the final helper-ownership regression) passed
on local PostgreSQL 17.11. After the explicit helper-ownership correction,
the concurrency suite passed all 15 tests, including
applying through a non-`postgres` migration role and verifying `postgres` owns
the private schema and both lock helpers. The suite uses the existing
`RECORD_TRASH_TEST_PG_BIN` override for another local binary directory; live
cases skip if the binaries are not available.