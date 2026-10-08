# Provision annual Stripe prices

Use `/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/scripts/stripe-annual-prices.cjs`
to provision the four annual subscription Prices on the Products already used by
monthly Prices. No new Products are needed. This is operator tooling, not an
application route or an automatic deployment step.

| Plan | Monthly USD | Annual USD | Annual variable |
| --- | ---: | ---: | --- |
| Engine / Starter | 23.00 | 248.40 | `STRIPE_STARTER_ANNUAL_PRICE_ID` |
| Foundry / Pro | 99.00 | 1,069.20 | `STRIPE_STARTUP_ANNUAL_PRICE_ID` |
| Enterprise | 500.00 | 5,400.00 | `STRIPE_ENTERPRISE_ANNUAL_PRICE_ID` |
| Account add-on, per unit | 10.00 | 108.00 | `STRIPE_ACCOUNT_ADDON_ANNUAL_PRICE_ID` |

## Required configuration

Use Node.js 22+ and installed repository dependencies. Supply these environment
variables through your secret manager or an untracked environment file:

- `STRIPE_SECRET_KEY`: a server key for the selected test/live mode, never a
  publishable key. Restricted keys need account, Product and Price read access,
  and Price write access for creation.
- `STRIPE_STARTER_PRICE_ID`
- `STRIPE_STARTUP_PRICE_ID`
- `STRIPE_ENTERPRISE_PRICE_ID`
- `STRIPE_ACCOUNT_ADDON_PRICE_ID`

All four monthly Prices must be active USD, licensed, per-unit recurring Prices
with a one-month interval and the amounts in the table. Their Products must be
active. Confirm the expected Stripe account ID in the Dashboard; `--account`
checks the account authenticated by the key, not a Connect destination.

Optional annual variables explicitly select existing annual Prices. The script
validates their amount, mode, product, interval and tax behavior. Incorrect
configured IDs cause failure, not replacement. Secrets are never CLI arguments
and no environment file is loaded implicitly.

## Preview and apply

From the repository directory:

```sh
cd /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit
export PATH=/opt/homebrew/bin:$PATH
export STRIPE_EXPECTED_ACCOUNT_ID
: "${STRIPE_EXPECTED_ACCOUNT_ID:?Set the expected Stripe account ID from the Dashboard}"

# Read-only preview using variables already supplied by your secret manager.
npm run stripe:annual-prices -- --mode test --account "$STRIPE_EXPECTED_ACCOUNT_ID"

# Explicitly create only missing test-mode Prices after reviewing the preview.
npm run stripe:annual-prices -- --mode test --account "$STRIPE_EXPECTED_ACCOUNT_ID" --apply
```

Alternatively, explicitly load the repository's **untracked** environment file:

```sh
node --env-file=/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/.env.local \
  /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/scripts/stripe-annual-prices.cjs \
  --mode test --account "$STRIPE_EXPECTED_ACCOUNT_ID"
```

For live mode use a live server key, live monthly IDs, and the confirmed live
account. Preview with `--mode live`; creation additionally requires both
`--apply --confirm-live`. `--dry-run` overrides `--apply` in either mode.

The script prints non-secret `STRIPE_*_ANNUAL_PRICE_ID=price_...` assignments for
existing/created Prices. Copy actual IDs into the server environment for the same
Stripe mode; the script does not write configuration files. Keep test/live IDs
separate, and do not remove or replace monthly Prices.

## Reuse, retries and safety

- Validates the complete catalog before the first write.
- Reuses the sole compatible active annual Price on each monthly Product. If
  several match, set that plan's annual variable explicitly rather than guessing.
- Preserves monthly Price tax behavior. Annual Prices are recurring once per year
  with licensed per-unit quantities; add-on quantity is supplied by Checkout.
- Uses stable idempotency keys and persistent unique lookup keys for created
  Prices. It never transfers a lookup key, reactivates an archived Price, or
  changes an existing Price. An occupied incompatible/archived lookup key fails
  closed. Do not run concurrent provisioners with different catalog configurations.
- Stripe creation is not a transaction across four Prices. If a later request
  fails, earlier Prices remain and their IDs have already been printed. Inspect
  Stripe, rerun the read-only preview, then rerun apply; compatible Prices are
  reused. No automatic deletion or rollback is attempted.
- Does not create charges, customers, subscriptions, migrations, or portal
  configurations. It does not migrate existing monthly subscriptions.
- Does not output raw Stripe errors, request payloads or credentials. Inspect
  Stripe's request logs privately when troubleshooting provider failures.

Creating these Prices alone does not enable annual billing. Complete the annual
SQL/API/application rollout and portal configuration, then validate Checkout,
paid invoice processing and monthly allowances in a sandbox before live use.
See [annual subscription rollout](../../API/docs/ANNUAL_SUBSCRIPTIONS.md).

## Offline validation

```sh
cd /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit
npx jest --config jest.stripe-offline.config.cjs \
  --testMatch '**/__tests__/scripts/stripe-annual-prices.test.js' --runInBand
npx eslint scripts/stripe-annual-prices.cjs __tests__/scripts/stripe-annual-prices.test.js
npm run stripe:annual-prices -- --help
```

Tests mock Stripe and generate synthetic credentials at runtime. They never load
environment files or connect to Stripe.