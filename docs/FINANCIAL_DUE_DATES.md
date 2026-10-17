# Financial due dates

`supabase/migrations/20261006210000_financial_due_dates.sql` adds optional
`DATE` columns to `sales`, `subscriptions`, and `purchases` (vendor bills).
There is no default or historical backfill. Existing documents retain `NULL`.
Apply this forward migration only through an explicitly approved rollout; no
remote application is part of the implementation.

## Date contract

- Persisted `due_date` is a finite Gregorian calendar date, `YYYY-MM-DD`, from
  `0001-01-01` through `9999-12-31`, not a timestamp. UI selection and rendering
  never shift it to a browser timezone. Invalid dates are rejected.
- Sale and bill forms use `dueDate`; database DTOs and subscriptions use
  `due_date`, consistent with their existing naming conventions.
- Blank or explicit `null` clears the date. Omitted fields on updates preserve
  the existing date. Missing dates display as **Not set** and do not schedule
  invoice reminders. Due dates do not change amounts, payment status, accounting
  recognition dates, or settlement behavior.
- Past dates and dates before the invoice/bill date are allowed. These can
  represent overdue obligations or negative payment-term offsets.

## Subscription terms

The subscription's `due_date` corresponds to its current `next_billing_date`
cycle. Net terms are their signed difference in **calendar days**, not months,
business days, or elapsed browser-local hours. Legacy billing timestamps are
normalized to their **UTC calendar date** before computing the difference.

Generated invoices use:

```text
invoice due date = invoice billing date + (subscription due date - next billing date)
```

For example, next billing `2026-01-31` and due `2026-02-14` mean net 14 days.
An invoice dated `2026-02-28` is due `2026-03-14`, not February 14 or March 17.
Leap years, month ends, and daylight-saving transitions use the same day offset.
Without either configured date, no invoice due date is invented.

The manual invoice form prepopulates this relative default. Changing invoice
date recalculates it; users can then override or clear it for that invoice.
Server Action callers omitting `dueDate` get the relative default; explicit
`null` clears it. Manual creation retains existing behavior and does not advance
the subscription cycle. The automated billing worker advances subscription
`due_date` and `next_billing_date` together by the cycle's calendar-date difference,
preserving net terms for future cycles. Editing subscription terms affects future
invoices only, never rewrites existing invoices. A dedicated authenticated,
tenant-scoped, version-checked action edits subscription dates. In
`/subscriptions/[id]`, Next billing and Due date are editable inline using the
same property-row calendar and save/cancel controls as lead details. Changing
Next billing shifts the configured Due date by the same calendar-day difference
to preserve payment terms; editing or clearing Due date changes the default for
future invoices. Next billing cannot be cleared. Both dates are returned after
each save so the detail panel and manual invoice defaults stay in sync.

Amount and End date are also editable inline in the same panel. Amount is a
non-negative per-cycle value with at most two decimal places (zero is allowed for
free subscriptions). End date is optional and may be cleared; it must be on or
after the subscription's UTC start date. These edits require accounting update
permission and a same-site version-checked update. They change only the selected
subscription field, never historical invoice amounts, balances, dates, payments,
status, or entitlements. The saved amount immediately updates the detail header
and subsequent invoice defaults. Editing End date does not itself cancel or
expire a subscription; lifecycle changes still use the existing status actions.

## Persistence and verification

### Manual period invoice generation

The subscription detail header offers **Generate period invoice** alongside
**New invoice**. The same action is available from each subscription list row's
Actions menu, sharing the confirmation dialog and refreshing pending invoice
balances after success. Both entry points disable generation without an active
subscription, valid billing anchor, or accounting insert permission.
Confirmation uses the UTC calendar date of `next_billing_date`
(initialized to `start_date` for a new subscription), the stored recurring amount,
the catalog currency (USD fallback), and the configured due date. The server
requires accounting insert permission, an active same-site subscription, and an
unchanged billing date. It creates a pending sale without charging a payment or
advancing the subscription schedule.

Existing invoices on that billing date are reused; cancelled/refunded periods
require the manual **New invoice** flow for a replacement. A deterministic invoice
UUID protects concurrent invocations and ambiguous retries of this action through
the existing sales primary key. The pre-insert lookup also detects existing manual
invoices, but does not serialize a simultaneous insert from a different manual or
automated writer; it is not a database-wide subscription-period uniqueness rule.
No schema migration or remote database changes are needed.

Focused coverage: `__tests__/subscriptions/generate-period-invoice.test.ts`,
`__tests__/subscriptions/generate-period-invoice-button.test.tsx`, and
`__tests__/subscriptions/subscriptions-list-period-invoice.test.tsx`.

Bill header/line edits include `due_date` in the existing atomic
`accounting_update_purchase_items` RPC. Its tenant authorization, source-version
lock, item rollback, recorded paid-amount preservation, grants, and search path
remain intact. Existing table RLS/grants are unchanged. A partial site/date index
supports pending unpaid sales with configured due dates.

Focused Jest tests cover date validation/UTC arithmetic, optional form clearing,
invoice defaults/mapping, sale and bill persistence, and SQL protections. The
migration suite starts a disposable socket-only PostgreSQL cluster when local
binaries are available; it never reads a configured remote database URL:

```bash
npm test -- --runInBand __tests__/finance __tests__/subscriptions/subscription-invoices.test.ts __tests__/accounting/sale-source-actions.test.ts __tests__/purchases/actions-accounting.test.ts
```

Native binaries default to `/opt/homebrew/opt/postgresql@17/bin`; override with
`DUE_DATE_TEST_PG_BIN` if necessary. Missing binaries skip only the live local
PostgreSQL cases, not source-contract assertions.

## Collection reminder ledger

`20261006230000_invoice_reminder_ledger.sql` adds service-only reminder receipts
and claim/cancellation RPCs after the financial due-date migration. This file is
mirrored byte-for-byte from the API repository's migration of the same name.
Both repositories use the same database: **apply it once**, not once per
repository. No remote application is authorized by this documentation.

Claims lock and re-read the site-scoped sale before admitting a reminder. They
reject non-pending, paid, missing/future due-date, or malformed financial rows.
One generating/ready/uncertain receipt prevents another generation even with a
different key; ready retries retain their original message. Repeat intervals are
checked against persisted `sent_at`, and previous keys are never reused.

Stale-ready cancellation locks the message and invalidates a concurrent delivery
compare-and-set. It cancels only proven pretransport messages: ambiguous,
dispatching, successful, or provider-confirmed transport evidence is preserved.
Missing messages and malformed financial snapshot metadata fail closed rather
than enabling another generation.

Independent local PostgreSQL coverage exercises concurrent claims, payment and
message-lock races, interval boundaries, tenant isolation, grants, malformed
input, stale cancellation, and ambiguous replay protection:

```bash
npm test -- --runInBand __tests__/finance/invoice-reminder-migration.test.ts
```

The test starts a disposable socket-only cluster and never uses a database URL.
`INVOICE_REMINDER_TEST_PG_BIN` can override the local PostgreSQL binary directory.