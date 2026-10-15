# Stripe sale payment fees

## Rate policy

The forward migration
`supabase/migrations/20261015000000_stripe_sale_payment_fee_rates.sql`
updates `public.apply_stripe_sale_financial_effects(uuid, text, numeric, text)`.
The authenticated Stripe webhook calls this service-only database function for
paid sale and sale-order Checkout sessions. The separate orchestration API does
not calculate this fee and does not need a rate change.

| Billing plan | Total sale payment fee | Seller credit on a $100 USD settlement |
| --- | ---: | ---: |
| `enterprise` | 4.5% | $95.50 |
| `foundry` | 5.5% | $94.50 |
| `engine` | 6% | $94.00 |
| `commission` (Toolbox / Free) | 7% | $93.00 |

Missing, null, or unrecognized plans use the Free rate of 7%. A missing billing
record is created explicitly with plan `commission`; the database's default plan
is not used to award a paid-tier rate. Existing paid plans and subscription
prices are not modified.

The authoritative plan is read from the sale's site billing record when its
financial effects are first applied. A Checkout session does not lock a rate at
creation. Pending effects first processed after rollout use the new policy;
already completed effects keep their original fee.

## One fee, not two deductions

```text
gross = verified gross USD settlement
total fee = round(gross × plan rate, 2)
wallet credit = round(gross − total fee, 2)
```

The total fee includes the platform commission and standard Stripe processing.
The wallet is **not** credited from Stripe's net proceeds and Stripe processing
is **not** deducted a second time from the seller. Stripe's actual costs still
reduce the platform's margin; the new percentages are not a profit guarantee.

The ledger retains the existing `commission` transaction type and stores the
applied `commission_rate` in payment details. Its accounting description remains
compatible with the separately authorized currency-repair workflow.

Row/advisory locks, USD validation, cent rounding, service-only execution,
transaction identifiers, and atomic financial-effect completion are preserved.
Retries must not create a second credit or reprice existing ledger entries after
a plan change. Currency repair continues to use the stored historical rate,
not the current rate; do not use this migration to rewrite past payments.

## Scope and remaining conditions

This policy applies to Stripe commerce sale settlement, not the subscription
price, credit purchases, manual/cash sales, or an additional fee on the buyer.
Billing plan selection and site settings display the same percentages. The
commercial site's `/pricing` alias leads to `/product/pricing` and advertises
these as starting rates.

International cards, currency conversion, small payments, refunds, disputes,
Connect, and payouts can cost more than the included rate. **No dynamic
international surcharge, minimum fee, or fixed component is implemented by this
change.** Those amounts and customer disclosures require a separate approved
policy and implementation. Do not interpret the pricing conditions as a backend
loss-prevention mechanism.

## Rollout: explicit target approval required

Local source changes and disposable PostgreSQL tests do not apply the migration
to any hosted project. No remote migration or app deployment is performed by
this work.

1. Confirm the intended Supabase project and Stripe test/live mode. Review the
   installed function and grants with
   `scripts/verify-stripe-sale-payment-fees.sql`; this script only reads database
   catalogs and does not call the settlement function or change balances.
2. Verify the target has the settlement-effect tables/functions from
   `20260917210300_stripe_settlement_effect_execution.sql` and the USD wallet
   guard from `20261014220000_stripe_sale_wallet_usd_guard.sql`. Review the gross
   USD resolver and webhook changes described in
   [Stripe sale currency recovery](STRIPE_SALE_CURRENCY_RECOVERY.md). The rate
   migration preserves these guards; it does not bootstrap all underlying tables.
3. After approval, apply the **complete new rate migration** using the team's
   existing database-owner migration workflow and record its migration history.
   Do not edit historical migrations, execute a partial function body, or blindly
   apply all pending migrations: the working tree may contain unrelated changes.
4. Run the read-only verification SQL again. Confirm the four rates, Free
   fallback, safe search path, and absence of browser-role execution rights.
5. Deploy the coordinated application and commercial-site source changes using
   the approved process. No new Stripe Product, Price, API endpoint, environment
   variable, or orchestration API deployment is required for these sale rates.
6. In an approved disposable test environment, verify a new paid sale for each
   plan produces gross revenue, one commission row, the expected wallet credit,
   and no extra debit on webhook replay. Do not replay real production payments
   merely to test a fee policy.

The repositories do not define a canonical remote migration command; this guide
does not introduce an unattended deployment script. For a rollback, prepare an
approved forward corrective migration with the previous rate policy while
retaining the USD/security guards. Do not overwrite or reapply an old migration
that might restore earlier bugs. Existing settled payments remain unchanged.

## Local validation

From the application repository:

```bash
npm test -- --config jest.stripe-offline.config.cjs --runInBand \
  --runTestsByPath __tests__/api/stripe-sale-payment-fees.test.ts
```

The backend suite uses local PostgreSQL 17 binaries and a disposable socket-only
cluster, never a configured database URL or app credentials. Cases requiring
PostgreSQL explicitly skip when the binaries are unavailable. See the suite for
the supported binary-directory override.

Run the coordinated billing UI fee tests using the application's offline pricing
configuration, and the commercial site's `payment-fees.test.tsx` using its own
offline pricing configuration. Broader Stripe regressions also cover wallet
currency guards, settlement retries, and historical currency repair.