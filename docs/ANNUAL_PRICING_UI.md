# Monthly and annual subscription UI

## Local billing read compatibility

Billing reads retry the legacy, explicitly allowlisted projection only when PostgreSQL
or PostgREST reports a missing column from the pending annual-coverage migration.
This is read-only compatibility: it does not bypass migrations for annual purchases,
invent paid coverage, grant credits, or mask permission/network errors.
`/api/sites` distinguishes `loaded`, `missing`, and `unavailable` financial reads.
An unavailable read offers **Retry loading billing**, never initial-credit setup.
The initial setup notice is reserved for a confirmed missing billing record, and
disappears when existing billing loads. Payment history no longer appends a stray
`0` to subscription descriptions with zero credits.

## Surfaces and ownership

- `/billing` uses `BillingForm`, `BillingIntervalSelector`, `SubscriptionPlans`,
  and `ConnectedAccountsAddons`.
- Tax and address fields are extracted to `billing-details-fields.tsx` so the
  touched billing form remains below 500 lines; existing saves remain unchanged.
- Settings' old billing placeholder now shows the stored plan/interval and links
  to real billing instead of simulating a subscription purchase.
- `/billing/success` labels the stored base-plan price using its actual interval,
  not the untrusted return query. It does not claim a URL proves payment or grant
  an entitlement. Add-ons are separate from its base-plan display.
- Upgrade prompts navigate to billing. One-time credit checkout and commerce
  prices are unrelated to the annual subscription discount and unchanged.

## Price and allowance display

The selector defaults to monthly for legacy records without `billing_interval`.
Annual base prices are $248.40, $1,069.20, and $5,400.00/year for engine, foundry,
and enterprise; monthly equivalents are $20.70, $89.10, and $450.00. These are
exactly 10% below twelve $23, $99, or $500 monthly payments. Base plan IDs never
change when switching intervals. Credits remain 20, 100, or 500 **per month**.

Annual add-ons cost $108.00/year ($9.00/month equivalent) each, versus $10/month,
and still grant +5 credits/month and one extra connection. The add-on management
surface displays the **stored subscription interval**, not the selector's pending
choice. Its current total multiplies the per-add-on charge by the stored count.

Current-plan comparison requires both the same plan and interval. A monthly
engine subscription can select annual engine, and vice versa. Selecting a radio
only changes the display preference; checkout requires an explicit plan action.

## Frontend/backend contract

```ts
createSubscriptionCheckoutSession(siteId, plan, userEmail, addonsCount = 0,
  billingInterval: 'month' | 'year' = 'month')
```

The POST to `/api/stripe/checkout/subscription` includes `billingInterval` along
with existing plan, site, email, count and return URL fields; it never sends a
calculated subscription amount. Normal checkout returns `{ url, sessionId }`.
Existing-subscription changes can return a hosted Stripe portal confirmation URL
under the same `url` field. Both navigate identically; the service preserves an
optional `sessionId` and fails if HTTP status is unsuccessful or no URL exists.

The backend validates real prices and persists `billing.billing_interval` from
the settled paid subscription invoice. No optimistic client update writes plan/interval before
payment confirmation. Missing annual configuration and unsafe existing
multi-item/add-on changes are errors, not monthly fallbacks or duplicate checkout.
The hosted update path currently supports a single base item with no add-ons;
for known add-on subscriptions, paid switch buttons are disabled and UI directs
users to Manage Add-ons/billing support
and surfaces the server's explicit error.

Paid same-interval tier changes are labeled **Manage** and open the existing Stripe
portal instead of submitting the checkout transition the backend rejects. Portal
availability/configuration still determines permitted changes; unavailable ones
require billing support. Interval changes on a single base item still use explicit
hosted confirmation. Existing subscription/item/customer discounts require support
review to retain their terms, rather than silently removing or resetting a coupon.
New subscriptions may still enter promotion codes in Checkout.

Downgrade review uses `LicenseDowngradeDialog`; it never selects accounts for
provider disconnection. Canceling review, failed portal/checkout requests and
unconfirmed Stripe transitions leave accounts and entitlements unchanged. Only
the effective server-confirmed license determines non-destructive suspension.

## Public signup preference

Commercial pricing links carry the chosen interval in the existing internal
`returnTo=/projects?billingInterval=...`. The project picker validates only
`month|year` and persists a non-authoritative browser preference. Billing reads a
validated URL preference, then the remembered preference, then the stored actual
interval. Invalid strings are ignored; unavailable browser storage is harmless.
No auth backend changes, auto-checkout, or entitlement updates are involved.

## Billing hydration and cancellation safety

Full-site API loads and targeted billing refreshes use the shared safe field list
in `app/context/site-billing-data.ts`. Its mapper preserves the actual interval,
credit buckets, the protected credit anchor and paid-invoice coverage fields instead of rebuilding a
monthly-only billing object. `Site.billing` inherits `BillingData` and its
protected coverage fields. Existing site/settings hydration preserves the whole
billing object and its read status, and cannot replace a newer targeted refresh
with stale values. Full loads update the selected site's billing even when
same-site selection skips a settings reload. A later failed financial read keeps
the last known balance but marks it unavailable; an earlier failed load cannot
undo a newer successful retry. A confirmed missing record is not revived from cache.

An explicit `/billing?billingInterval=year` from the commercial redirect is a
validated display preference; it does not start checkout. Invalid values fall
back to the remembered preference or actual interval. Paid-to-free cancellation
opens the Stripe portal before any downgrade account-limit check, so scheduling
cancellation cannot prematurely disconnect accounts or revoke annual allowances.

## Offline verification

`jest.pricing-offline.config.cjs` bypasses `next/jest` configuration/environment
loading while retaining the installed Next SWC transformer:

```sh
cd /absolute/path/to/market-fit
node /absolute/path/to/market-fit/node_modules/jest/bin/jest.js \
  --config /absolute/path/to/market-fit/jest.pricing-offline.config.cjs --runInBand
```

Covered: exact annual prices/add-ons, monthly allowances, same-plan other-interval
selection, busy controls, actual interval hydration, validated intent, explicit
fifth argument/default POST, checkout/portal URL contracts, missing URL/server
failure, no automatic checkout and no optimistic billing write. Existing
downgrade-account helper tests remain selected. Context regressions also exercise
annual full reload, targeted refresh, restored selection and stale settings
hydration. The sites API regression emulates selected columns and verifies annual
coverage is returned only for the authorized site's IDs, without raw card fields.
Provider/network/database
dependencies are mocked, and no real credential fixtures are needed.