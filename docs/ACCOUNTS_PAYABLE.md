# Accounts Payable

Accounts Payable is available at `/accounts-payable` in **Buying**, immediately
after Bills. It clones the Accounts Receivable page's responsive filter controls,
document table, supplier-level balances, currency-separated totals, and payment menu.
Supplier links open the existing `/companies/[id]` detail route.

The list groups outstanding, non-draft purchases by supplier. The default tabs show
active purchases; **Cancelled purchases** shows only cancelled purchases with an
outstanding balance. This uses purchase status, not purchase order relationships.
Suppliers without a due date have their own filter, and overdue status uses the
local calendar date. Search, sorting, counts, and totals apply to the visible list.

**Settle balance / Add payment** loads the selected supplier's open bills within
the current site and active/cancelled scope. Choosing a bill opens the existing
`RegisterPurchasePaymentDialog`. Bills with unknown currency display a safe label
and cannot be selected until their currency is corrected. Payment completion emits
`purchase:payment-recorded` with the site ID; the page refreshes only its current
site's cache. Demo and read-only users cannot open the payment flow.

Offline regression coverage lives in `__tests__/accounts-payable/`. Browser visual
parity and live payment verification require an authorized disposable fixture;
unit tests do not establish live environment readiness.

All three registered demo workspaces include shared fictional purchase records
from `lib/demo-data/accounts-payable.ts`. These cover overdue, current, undated,
partially paid, multi-currency and cancelled balances. Draft and settled bills
are excluded from payables. Dates are relative to the local calendar day, supplier
links use existing demo companies, and demo loading never calls the live payable
actions or writes to the database. Real workspace loading is unchanged.