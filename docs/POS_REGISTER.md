# POS cash register shifts and closing history

## User workflow

In the POS cart's **Options**, open **Cash Register** and select an active location.
The selection also sets the checkout origin location, independently of fulfillment
(including carryout).

The dialog separates **Today** (the current open shift, including shifts opened
on an earlier day) from **History** in tabs. Switching tabs preserves opening,
movement, and closing drafts. Actions for the selected tab live in a single
fixed dialog footer outside the scrollable body; closing a shift switches to its
read-only history detail. Submit buttons remain associated with their own forms.
The Today footer is contextual: a closed register offers **Open register**; an
open register offers **Add cash**, **Withdraw cash**, and **Close register**.
When no shift is open, the opening cash field is shown immediately. The amount
is required (an explicit zero is allowed); **Open register** submits it directly
without a separate form-opening step. Nothing is created until confirmation.
Choosing an action for an open shift shows only its form and replaces the footer
with **Cancel** and that action's confirmation. Cancel preserves drafts without
writing. Live printing is a secondary tool in the session header, not a base action.
Cash refunds remain available as a withdrawal type.
History always shows its table headers, with five skeleton rows while loading
the initial data or another page. Loaded rows are hidden until the request
finishes; empty and error states appear only after loading. History pagination
stays visible and disabled during loading, and lives in the fixed dialog
footer, alongside read-only detail actions when a session is selected. There are
no Refresh buttons in the dialog and no history date filters. Data reloads after
successful writes and when reopening the dialog; failed reads can be retried by
closing and reopening it. Reopening resets unsaved drafts.

- **Open register** records the authenticated cashier, the site's currency, and
  opening drawer cash. One shift may be open per site/location.
- **Cash movement** records cash in, cash out, or a cash refund, with a mandatory
  reason. The responsible cashier or an owner/admin may change a shift.
- **Close register** records counted cash, notes, the closing actor, and an
  immutable snapshot. The server calculates expected cash and difference.
- **History** lists all closed shifts for the selected location, newest first,
  with pagination. Open a shift to review receipts, movements, and reconciliation,
  or print an isolated browser report.

Session and receipt timestamps are displayed in the browser's locale.
Responsible users are currently shown by their immutable user IDs.

```text
Expected drawer cash = opening cash + cash receipts + cash in
                     - cash out - cash refunds
Difference = counted cash - expected drawer cash
```

Card, transfer, on-account and other non-cash methods appear separately and do not
increase physical drawer cash. Cash receipts use the applied amount; tendered and
change are retained for audit, and change is not deducted twice.

Cash refunds in this screen record drawer outflows only. They do **not** reverse
sales, execute Stripe refunds, or post accounting adjustments. Record those
operations through their existing authorized financial workflows. Opening and
closing a register do not create additional sales or accounting income.

## Connectivity and synchronization

Opening, cash movements, collected payments and closing require connectivity.
Unpaid POS order sends retain the existing offline outbox behavior. Collected
payments are associated with a server-created shift and stable receipt UUIDs
before enqueueing. The cart is only cleared after successful synchronization.
An ambiguous result leaves the order and its queued operation available for
review/retry rather than collecting a second payment automatically.

Payment collection and closing use the same site-scoped browser Web Lock. Closing
drains the local outbox and refuses to proceed while any collected payment in that
site remains pending, syncing or failed. Browsers must support Web Locks (modern
secure-context browsers); unsupported browsers fail closed.

This queue check covers the current browser, not every device. Database row locks
serialize receipt writes, movements, summaries and closure across devices.
A write reaching a closed shift is rejected; it is never reassigned to a new shift.
Resolve ambiguous/failed operations before a manager closes another cashier's
shift. The feature does not claim a distributed offline register protocol.

## Persistence and authorization

The forward-only migrations are:

1. `20261016171200_pos_register_ledger.sql`
2. `20261016171300_pos_register_rpcs.sql`
3. `20261016171400_pos_register_sales_receipts.sql`

They add sessions, immutable movements and immutable receipts. User-scoped
Server Actions validate inputs and site roles; RLS allows reads for owner, admin,
and collaborator roles only. Marketing and anonymous access are denied. Writes
are limited to authorized transactional RPCs and the authenticated sales trigger;
the application introduces no service-role register access.

Each new POS receipt carries a shift UUID, payment UUID and server-derived actor.
The sales trigger validates site, location, currency, cash arithmetic and actor,
and captures the receipt atomically with the sale statement. Stable payment IDs
prevent duplicate collection on a retry. Previously tagged payment data and
referenced sale identity/site/currency/location cannot be overwritten or deleted.
Additional partial receipts may belong to later shifts; reports use explicit
receipt linkage rather than sale dates. Existing checkout's broader order,
inventory and finalization workflow is not made fully transactional by this change.

Legacy untagged payments remain valid but are not reconstructed into register
history. Pre-release POS outbox payments without register tags cannot be processed
by the new collected-payment boundary; reconcile existing queues before rollout.
Old clients and non-POS writers can still create unassigned receipts for backward
compatibility. Coordinate deployment and reload all POS clients: this ledger
reports registered receipts, not every site cash receipt from every sales channel.

## Validation and rollout

```bash
npm test -- --runInBand __tests__/pos __tests__/commerce
npm run typecheck
npx --no-install eslint app/pos/register app/pos/hooks/use-checkout-attempt.ts
```

The register PostgreSQL suites use a new socket-only disposable local cluster;
they never connect using project database credentials. They validate the actual
migrations, RLS, immutability, receipt rollback, idempotency and concurrent closure.
UI and Server Action suites use isolated mocks, not replacement application APIs.

Apply all three migrations in order only after explicit approval of the target
database, then deploy the application and reload POS devices. No historic backfill,
remote migration, production build or deployment is part of local validation.
Verify opening, mixed/partial payment, cash out, counted close, printed history,
and cross-site denial in the approved staging environment before production use.