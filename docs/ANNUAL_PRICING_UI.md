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
engine subscription can select annual engine, and vice versa. Selecting an interval tab
only changes the display preference; checkout requires an explicit plan action.

Annual Stripe Prices can be provisioned with the [operator script](STRIPE_ANNUAL_PRICE_SCRIPT.md).
It previews by default and requires explicit approval flags for Price creation;
it does not create subscriptions or automatically configure the portal.

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
users to billing support. The server also surfaces an explicit error.

Paid-to-paid downgrades **within the same billing interval** schedule the new tier at the end of the current Stripe
billing period (monthly or annual); the old plan and access remain until the
next paid invoice confirms the new tier. Same-interval upgrades reset the billing
anchor and invoice immediately with Stripe's unused-time proration credit; the
update is pending if payment fails. Only the verified paid full-period invoice
settlement activates the new plan. No client-side price, prorated amount, or
entitlement is trusted. Pending upgrade payments return a verified hosted Stripe
invoice URL so customers can complete authentication/payment. A retry of a
partially configured downgrade checks and finishes its attached schedule; a
retry after an upgrade payment verifies the paid invoice before acknowledging it.
Unknown schedules, invoices or tax configurations require billing support.
Downgrades that also change the billing interval require support review.
Add-on changes still require billing support. Scheduled cancellation and payment
details may still use the safe generic portal. Interval switches at the same tier
still use explicit hosted confirmation. Existing subscription/item/customer
discounts require support review to retain their terms, rather than silently
removing or resetting a coupon.
New subscriptions may still enter promotion codes in Checkout.

Downgrade review uses `LicenseDowngradeDialog`; it never selects accounts for
provider disconnection. Canceling review, failed portal/checkout requests and
unconfirmed Stripe transitions leave accounts and entitlements unchanged. Only
the effective server-confirmed license determines non-destructive suspension.

## Separate billing portal configurations

Both portal entry points select an explicit server-side configuration ID and
retrieve its current settings before creating a session. They never edit a
Stripe configuration, discover a default as a fallback, or accept a configuration
ID/customer ID from the browser. Missing, inactive, unavailable, or unsafe portal
configuration returns **409** and requires billing support; initial subscription
Checkout does not require either portal configuration.

- `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` selects the generic `/api/stripe/portal`
  configuration. `subscription_update.enabled` must be `false`, so the generic
  portal cannot bypass plan, interval, quantity/add-on, discount or proration
  checks. If cancellation is enabled, it must use `at_period_end` and `none`
  proration. Payment-method management and invoice history remain available when
  enabled by that configuration. This ID may explicitly select a safe existing
  default, but there is no implicit default fallback.
- `STRIPE_SUBSCRIPTION_UPDATE_PORTAL_CONFIGURATION_ID` selects a **different,
  non-default** configuration for `subscription_update_confirm` only. It must be
  active, allow exactly `price` updates (not quantity or promotion-code changes),
  use `always_invoice`, contain no end-of-period scheduling conditions, and list
  the selected target product **and** Price. Both IDs use Stripe's `bpc_...`
  configuration-ID format; they are server-only settings, never `NEXT_PUBLIC_*`.

Manager authorization and trusted return-URL checks precede billing access. The
generic route uses the authenticated/RLS client and verifies the retrieved
customer ID and `metadata.site_id` against that site's stored billing customer.
The dedicated flow also verifies the current subscription's customer, stored
subscription identity and single base-item quantity of one. Existing discounts,
add-ons, pending updates and scheduled/canceling
subscriptions still require support review. A portal URL or return redirect is
not proof of payment and does not itself grant coverage or credits.

Configure a new dedicated configuration only through a separately approved
operator procedure; do **not** enable subscription updates on the shared generic
portal in place. Changing application environment settings, any live Stripe
configuration or Vercel/deployment settings is a separate approved operation, not
part of the offline implementation or tests. Generic billing remains deliberately
blocked until its explicit configuration is safe; the update flow remains
blocked until its separately configured portal is safe.

Offline regressions are in `__tests__/api/stripe-portal-safety.test.ts` and
`__tests__/api/stripe-subscription-update-portal.test.ts`, selected by
`jest.stripe-offline.config.cjs`. They mock Stripe/Supabase, exercise authentication,
cross-site customer/subscription denial and unsafe/missing configuration, and
assert no configuration/subscription mutations or default discovery occur.

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