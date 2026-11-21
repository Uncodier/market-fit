# Message lock ordering correction

**Status:** applied to Makinari (`rnjgeloamtszdjplmqxy`) on November 20, 2026 at
22:28:56 UTC using the canonical repository's credentials with explicit approval.
Independent read-only verification at 22:29:14 UTC confirmed the exact source,
one history row, enabled triggers and preserved existing security settings.
Canonical evidence: `makinari-db-scheme/supabase/validation/20261120_messages_lock_order.md`.
No application deployment or production message test was performed.
Migration: [`20261120232100_messages_lock_order.sql`](../supabase/migrations/20261120232100_messages_lock_order.sql).

## Confirmed problem and correction

Two recorded `40P01` cycles on November 20, 2026 involved concurrent inserts
into `public.messages`. The inheritance trigger acquires `FOR SHARE` on the
conversation before the AFTER summary trigger acquires an advisory lock and
updates that same parent. One transaction can own the advisory lock while
waiting for the other's parent lock, closing the cycle. Human-reply snooze also
needs `FOR UPDATE`, so just moving the advisory acquisition is insufficient.

The new BEFORE trigger runs after the existing visibility check and before the
inheritance trigger. It serializes on the parent conversation with `FOR UPDATE`.
The summary no longer acquires a second, differently ordered advisory lock.
It still computes the exact count and latest-message preview, ordered by
`created_at DESC, id DESC`; moves refresh both old and new conversations.

PostgreSQL has already locked the child tuple before its BEFORE UPDATE/DELETE
trigger. Those parent acquisitions use sorted `FOR UPDATE NOWAIT`, not blocking
locks that could invert the order of a concurrent parent deletion and its
foreign-key cascade. Conflicts raise `55P03`; they never silently skip summaries.
Metadata-only updates remain outside the new serialization trigger.

The legacy timestamp trigger remains installed with its original `updated_at`
side effect, but no longer overwrites `last_message_at` with an older/backfilled
insert after the exact summary has run. Updating `id`, which participates in
the preview/tie-breaker, also refreshes the summary. No historical data is
backfilled or rewritten by the migration.

## Compatibility and deployment gates

- Application required explicit approval and a quiet message-write window. The
  migration takes `SHARE ROW EXCLUSIVE` on messages, with a five-second
  `lock_timeout`, before switching the trigger chain atomically. The application
  wrapper also acquired conversations/messages with `NOWAIT`; no active message
  transaction was observed, and workers were not separately stopped.
- Preflight pins the two audited function bodies, owners, security configuration
  and relevant trigger bindings/event columns. Unexpected schema drift fails
  closed. Review the current FK/cascade and complete trigger chain before rollout.
- Existing function owner, ACL and security settings remain unchanged. The new
  definer belongs explicitly to `postgres`; browser/service roles cannot invoke
  it directly. It neither replaces RLS nor weakens human-reply authorization.
- A `55P03` conflict requires rolling back and retrying the whole DB transaction
  when semantically safe. Do not automatically repeat an external message send
  or a non-idempotent mutation. No caller retry behavior was changed here.
- A stale `REPEATABLE READ` parent snapshot can produce PostgreSQL `40001` and
  likewise needs a fresh transaction.
- This does not guarantee deadlock freedom for arbitrary cross-conversation
  batches, `INSERT ... ON CONFLICT`, external table locks or multi-statement
  transactions. Batch callers should acquire parent locks in UUID order from
  the outset. These are rollout/review constraints, not solved incident claims.

## Executable evidence

```sh
npm test -- --runInBand \
  __tests__/chat/messages-lock-concurrency-postgres.test.ts \
  __tests__/chat/messages-lock-migration.test.ts
```

The two suites pass 13 tests (10 disposable-PostgreSQL cases and 3 migration
contracts). They deterministically reproduce the original assistant and human
reply `40P01` cycles, then demonstrate both inserts committing after the patch.
They cover parent/cascade inversion, `55P03`, stale-snapshot `40001`, exact
summaries, ordered batches, ID/timestamp edits, moves, deletes, rollback,
metadata-only writes, function grants and tenant/anonymous denial.

Tests use Unix-socket-only PostgreSQL 17 with synthetic records, not production
credentials. They execute the actual inheritance function and exact hash-pinned
legacy summary bodies. RLS and the snooze dependency are focused synthetic
fixtures with the relevant lock/invoker behavior: they do not reproduce the
entire WhatsApp ledger, lead override, webhook or settings policy system.
Full Supabase/browser replay and external-worker retry acceptance remain unverified.

After an approved rollout, compare `40P01`, `55P03`, `40001`, lock-wait duration,
message write latency and exact-summary invariants. A local test passing is not
evidence that the production deployment or retry path has been validated.