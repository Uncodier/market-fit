# Projects list performance and contention audit

## Status and scope

The application changes are local and regression-tested, not deployed. Supabase
Makinari was initially inspected read-only on November 20, 2026. With subsequent
explicit approval, only the message lock-order migration was applied at 22:28:56
UTC and independently verified. Records remains blocked after review. No session
cancellation, cache purge, credential rotation or service configuration change
was performed. Existing unrelated working-tree edits were preserved.

This work separates presentation latency from database locking. A Redis hit does
not authorize a request or guarantee that Supabase Auth is available.

## Observed evidence

The audited 24-hour window ended at approximately 21:19 UTC:

- The project-wide Auth user endpoint had 49 recorded HTTP 504 responses.
  Successful requests sometimes took over 40 seconds at the gateway. These are
  not uniquely attributed to the Projects page or to PostgreSQL execution.
- The location-access RPC reached 5.30 seconds at the gateway. Selector-shaped
  member-ID reads reached 1.90 seconds; member site batches reached 2.14 seconds.
- No recorded lock/deadlock/statement-timeout event was attributed to the
  selector's sites/membership queries. Snapshots are not continuous monitoring;
  a short unclassified lock appeared in a later global capture and cleared.
- PostgreSQL plans for the selector filters already use `sites_active_owner_idx`
  and `idx_site_members_user_site_status`. Catalog estimates were roughly 60
  sites and 37 memberships. The plans used synthetic UUID constants, did not
  execute application functions, and did not expose customer records.
- A separate workload showed two message-insert deadlocks and repeated
  site-wide Records advisory waits. Those require database lock-protocol changes,
  not a larger selector cache or another sites index.

## Local application changes

1. **Keep existing rows visible.** `/projects` no longer replaces available
   actor-scoped cards with skeletons while the selected workspace hydrates or
   the list refreshes. Selection and redirect still respect the settings gate.
   Failures are displayed without hiding an already loaded list.
2. **Retire denied scopes.** A fresh 403 clears retained projects and retires
   parallel settings hydration. A late response cannot republish the denied
   selection. Temporary 503s are not logout or evidence of zero memberships.
3. **Preserve real freshness.** Redis's 60-second timestamp begins when the
   database scan starts. Hydration does not renew the returned freshness budget.
   The browser does not persist a second list or any authorization state.
4. **Coalesce correctly.** Same-actor/environment pending lookups and fresh fills
   share work. An explicit fresh read supersedes an older ordinary cache-miss
   scan rather than accepting its pre-mutation result. Local writes are ordered;
   this is not distributed locking or cross-instance invalidation.
5. **Bound batch concurrency.** Up to three site-ID batches of 100 run together,
   preserving deterministic output, per-batch checked pagination, cancellation
   and all-or-error publication. No unbounded `Promise.all` fan-out was added.
6. **Measure each dependency.** Fixed `Server-Timing` names report `auth`,
   `location`, `list`, performed `redis_read`/`redis_write`, and `total`.
   `X-Sites-Cache` reports hit/miss; `X-Sites-Cache-Reason` explains bypass,
   disabled/unavailable Redis, expired/invalid/empty entries or coalesced work.
   `X-Sites-Timeout-Stage` captures the active stage before aborting its transport.
   The headers contain no token, cache key, actor ID or personal data.

Fresh `getUser()` and user-scoped location authorization remain mandatory and
sequential before Redis or service-role reads. Cache-only membership hints never
authorize mutations. HTTP metadata remains `private, no-store`; DB cache-fill
transport explicitly uses `no-store`, a five-second budget, and a signal
independent of a single coalesced caller. The API retains an eight-second response
deadline; the client retains its ten-second startup deadline. Those deadlines
bound failure, not eliminate upstream outages.

## Index decision

No speculative selector index was added or existing index dropped. Existing
indexes cover the measured filters, and the dataset/observed plans do not justify
extra write amplification. The Supabase performance advisor also reports broad
unindexed-FK and duplicate-index debt outside this flow; those findings are not
proof of this incident's cause and were not bulk-applied.

Auth currently has an absolute maximum of ten DB connections according to the
advisor. Review its allocation alongside actual connection pressure before
changing capacity; this audit did not establish it as the cause of Auth outages.
See [Auth production guidance](https://supabase.com/docs/guides/deployment/going-into-prod)
and the [foreign-key index advisory](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

## Validation and rollout

Run the focused suites without production credentials or a production build:

```sh
npm test -- --runInBand \
  __tests__/api/sites-selector.test.ts __tests__/api/sites-read.test.ts \
  __tests__/lib/sites \
  __tests__/context/site-selection-cache.test.ts \
  __tests__/context/site-background-refresh.test.tsx \
  __tests__/context/site-recovery-races.test.tsx \
  __tests__/context/site-selector-lifecycle.test.tsx \
  __tests__/components/navigation/site-selector-empty.test.tsx \
  __tests__/app/projects/page.test.tsx __tests__/pos/pos-page-access.test.tsx
npm run typecheck
```

Final local verification: 22 combined Jest suites / 325 tests passed (217
Projects/related regressions, 95 Records regressions, and 13 message lock tests).
`npm run typecheck`, targeted ESLint for the touched application/test files, and
`git diff --check` passed. Database cases executed against disposable local
PostgreSQL 17.11. No authenticated production browser session or deployed Redis
latency benchmark was performed.

After approved application deployment, capture the selector request's headers in
the affected authenticated browser. Compare hit/miss latency, the dominant stage,
timeout rates and visible-list retention. Do not infer hit rate from DB logs or
from local unit tests. Confirm the deployed `REDIS_URL` privately; it was not
verified by reading production environment variables here. Do not lengthen the
TTL or skip authorization to disguise slow Auth.

The Records migration has a separate [concurrency and rollout report](RECORDS_LOCK_CONCURRENCY_REPORT.md),
and message ordering has a [separate verification report](MESSAGES_LOCK_ORDER_REPORT.md).
The message correction is applied; production/browser retry acceptance remains
unverified. Do not apply the Records candidate until its bulk-restore memory
regression, worker concurrency and canvas error handling are corrected. Its
rollout still requires explicit approval and new monitoring of retryable
conflicts. The application-only improvements remain undeployed and independent.