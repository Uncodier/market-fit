# Order status and concurrent screens

## Source-proven failure paths

Orders previously finished its optimistic SWR mutation before the status Server
Action settled. A realtime/focus read could publish an older status during the
write. Its server list also used a five-second Redis entry (with a longer stale
fallback), including when another writer had changed the database before cache
invalidation ran. A realtime event did not guarantee a fresh read.

Existing-order checkout also wrote `status` in branches intended to preserve
kitchen progress. An unpaid Send/Draft or a non-atomic self-service payment could
read `pending`, then overwrite a concurrent `in_progress` or `completed` change.
The checkout admission identity prevents duplicate execution of the same attempt;
it does not serialize every writer of the order's lifecycle.

These are deterministic code-level mechanisms, not attribution of a specific
production incident. No production order, logs, or deployed triggers were read.
Opening an idle kiosk does not itself prove a writer exists. A POS tab may dispatch
previously accepted outbox work in the background. Printer acknowledgements write
print history, not the parent order's status, in the checked-in implementation.

## Bounded repair

- The live Orders list requests `listOrders(params, { fresh: true })` for all SWR
  loads. Authentication, membership and location verification still precede the
  user-scoped RLS query. Other list consumers retain their existing cache path.
- Status changes use a single asynchronous SWR mutation with optimistic feedback,
  rollback on failure, the returned server row, and post-write revalidation.
  Older/in-write reads cannot overwrite that mutation's presentation.
  Rapid status writes in the mounted list are serialized so mutations of two
  orders cannot supersede each other. Queued clicks retain their original site
  and cache key after navigation; they never publish into the newly selected site.
- Non-atomic checkout omits `status` when the calculated status equals the observed
  value. The returned row supplies the actual status for finalization.
- An intentional non-atomic status transition filters by the observed status as
  well as the site and order. A concurrent different status fails rather than
  being overwritten or retried automatically. The paid POS atomic RPC is unchanged.

Existing Orders debounce, hidden/offline deferral and one-dirty-follow-up behavior
remain intact. Freshness bypasses result caching; it does not add polling or claim
distributed request coalescing across devices.

## Unchanged rules and residual boundaries

**Send still sets an ordinary existing order to `pending` when a product is added
or its quantity increases.** This is an explicit reopening policy, not an idle-tab
sync effect. Changing it requires a separate work/fulfillment decision.

This repair is not a transaction protocol for all order/sale/line writers. The
non-atomic branch still writes the sale before the order; an order conflict may
occur after that sale write. Reconcile ambiguous checkout outcomes instead of
blindly retrying. Concurrent line status/metadata writes, lifecycle ABA changes,
provider reconciliation and installed legacy triggers require separate review.
No database migration is introduced or applied.

## Offline validation and rollout

```bash
npm test -- --runInBand __tests__/orders/use-orders-data.test.tsx __tests__/orders/location-cache-boundary.test.ts __tests__/orders/date-filter-page.test.tsx __tests__/pos/checkout-status-preservation.test.ts __tests__/pos/checkout-atomic-records.test.ts __tests__/commerce/self-service-lifecycle.test.ts
```

The fixtures copy read snapshots and interleave a second screen's status change
before persistence. SWR tests interleave realtime reads before/during a delayed
write and verify rollback and site isolation. These are offline regressions, not
live multi-device/database evidence. Deployment is a separate approved action;
reload Orders, POS and kiosk tabs afterward to retire older clients. Do not clear
browser storage or discard pending outbox payments as a workaround.