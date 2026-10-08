# Environment Variables

Create `.env.local` from `.env.example` for local development:

```bash
cp .env.example .env.local
```

`.env.example` is a partial, secret-free starter template; it is not a complete
runtime manifest. This document maps additional feature-specific configuration
used by the code. Never copy production secrets into committed files.

## Visibility rules

- Variables prefixed with `NEXT_PUBLIC_` may be bundled into browser code.
- Supabase service keys, Stripe secrets, OAuth client secrets, API keys,
  encryption keys, cron secrets, and test credentials are server-only.
- A server-only secret must never gain a `NEXT_PUBLIC_` prefix.
- Production code should fail closed when a required secret is absent; do not
  add fallback credentials.

## Core application

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`NEXT_PUBLIC_APP_URL` is used for redirects, public links, OAuth callbacks, and
trusted checkout origins. The anon key is intentionally browser-visible and
depends on RLS. The service-role key bypasses RLS and must remain server-only.

## External orchestration API

```dotenv
NEXT_PUBLIC_API_SERVER_URL=http://localhost:3001
API_SERVER_URL=http://localhost:3001
SERVICE_API_KEY=
```

The API server owns robot/workflow orchestration and selected external
integrations. `SERVICE_API_KEY` authenticates server-to-server calls. Do not
expose provider credentials through the public API URL.

Support chat identity uses this trusted API URL and the signed-in user's
server-validated Supabase session, not `SERVICE_API_KEY`. Its signing secret
belongs only in the API deployment. See [Support chat identity](CHAT_IDENTITY.md)
for rollout requirements and exact-origin validation.

The public storefront visitor-session bridge uses the existing server-only
`SERVICE_API_KEY` after public-site validation and requires Redis admission.
Visitor requests after bootstrap carry only the API-issued visitor proof.
Generated-image cache delivery uses `NEXT_PUBLIC_SUPABASE_URL`. Public storefront
cache misses may generate using the server-only `SERVICE_API_KEY` after resource
authorization and fail-closed Redis admission, charged to the resolved site.
Workspace generation uses the verified user bearer, never a browser API key. See
[Public visitor sessions and image delivery](PUBLIC_VISITOR_AND_IMAGE_DELIVERY.md).

## Stripe

```dotenv
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_PRICE_ID=
STRIPE_STARTUP_PRICE_ID=
STRIPE_ENTERPRISE_PRICE_ID=
STRIPE_ACCOUNT_ADDON_PRICE_ID=
STRIPE_STARTER_ANNUAL_PRICE_ID=
STRIPE_STARTUP_ANNUAL_PRICE_ID=
STRIPE_ENTERPRISE_ANNUAL_PRICE_ID=
STRIPE_ACCOUNT_ADDON_ANNUAL_PRICE_ID=
STRIPE_ENTERPRISE_LEGACY_MONTHLY_PRICE_IDS=
STRIPE_ENTERPRISE_LEGACY_MONTHLY_AMOUNT=
CHECKOUT_RETURN_ORIGINS=
```

`CHECKOUT_RETURN_ORIGINS` is a comma-separated list of additional exact origins.
Wildcard subdomains are not accepted. Keep test and live Stripe keys, price IDs,
and webhook secrets in matching environments.

Subscription prices are server-only configuration and validated against Stripe:
USD licensed recurring prices, interval count one, monthly $23/$99/$500 and
annual $248.40/$1069.20/$5400 for Engine/Foundry/Enterprise. Connected-account
addons cost $10/month or $108/year each (10% annual discount). All subscription
checkout selections need configured real prices; missing annual configuration
returns `503`, never a monthly or dummy-price fallback. See
[Stripe setup](STRIPE_SETUP.md) for hosted update confirmation prerequisites.

Historical Enterprise invoice/lifecycle verification has a separate read-only
allowlist: `STRIPE_ENTERPRISE_LEGACY_MONTHLY_PRICE_IDS` is a comma-separated list
of explicitly operator-verified retired Enterprise Price IDs, and
`STRIPE_ENTERPRISE_LEGACY_MONTHLY_AMOUNT` must be exactly `49900` (USD cents,
$499/month). Set both or neither; missing/malformed values, duplicate IDs,
collisions with another plan or annual/addon price, and unknown historical IDs
fail closed. Verify every allowlisted Price's intended Enterprise product,
Stripe account/mode, USD amount, and licensed monthly interval before rollout.
This is not automatic discovery based on a $499 amount or metadata. The handler
also verifies the provider Price and full gross invoice lines before settlement.

Inventory **all** preexisting $499 Enterprise monthly IDs used by active,
past-due, and historical subscriptions/invoices, not only the currently configured
checkout ID. Keep those IDs in this server-only allowlist and configure
`STRIPE_ENTERPRISE_PRICE_ID` separately with the validated active $500/month
Price for new purchases. If the old ID still occupies that variable during
rollout, the allowlist admits it only for read proof; checkout continues to
reject its $499 amount. Historical configuration is never used to create or
update checkout prices. Do not commit actual IDs/credentials or change live
configuration without approval. See [invoice recovery](STRIPE_INVOICE_RECOVERY.md)
for rollout and paid-invoice recovery order.

See [Stripe setup](STRIPE_SETUP.md) and
[Stripe webhook security](STRIPE_WEBHOOK_SECURITY.md).

## Public-token and asset-proxy operations

```dotenv
PUBLIC_DOCUMENT_TOKEN_TTL_DAYS=30
ASSET_PROXY_MAX_BYTES=
ASSET_PROXY_TIMEOUT_MS=
```

- Public document token lifetime is clamped to 1–365 days.
- Asset proxy limits have code defaults; set them only when the deployment
  requires different positive integer values.

## Stored integration secrets

```dotenv
ENCRYPTION_KEY=
LEGACY_ENCRYPTION_KEY=
```

These keys protect retrievable integration credentials. Current legacy code
contains a literal fallback value; production environments must set an
independent strong key and treat a missing value as security debt. Rotating
these values requires a credential migration because existing ciphertext may
depend on the previous key.

## Authenticated E2E tests

```dotenv
TEST_BASE_URL=http://localhost:3000
TEST_ADMIN_EMAIL=
TEST_ADMIN_PASSWORD=
TEST_SITE_NAME=
TEST_CATALOG_CATEGORY_NAME=
TEST_RECORD_CATEGORY_NAME=
TEST_CAMPAIGN_NAME=
```

The test account must be non-production and contain only disposable data.
`auth.setup.ts` writes browser state below `.auth/`; do not commit it.

## Optional integrations

Only configure the variables for enabled features:

```dotenv
# Cloudflare and Vercel
CLOUDFLARE_CLIENT_ID=
CLOUDFLARE_CLIENT_SECRET=
VERCEL_API_TOKEN=
VERCEL_PROJECT_ID=
VERCEL_TEAM_ID=
MARKET_FIT_ORIGIN=

# Secondary repositories Supabase project
NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL=
REPOSITORIES_SUPABASE_SECRET_KEY=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
# Exact public callback URL configured in Twilio. Recommended when a reverse
# proxy changes the request host or protocol.
TWILIO_WHATSAPP_WEBHOOK_URL=

# Transactional email
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
SENDGRID_FROM_NAME=

# AI providers
SHIPLIGHT_API_TOKEN=
GOOGLE_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
VERCEL_AI_GATEWAY_API_KEY=
WEB_AGENT_MODEL=

# AppSumo
APPSUMO_CLIENT_ID=
APPSUMO_CLIENT_SECRET=
APPSUMO_API_KEY=
APPSUMO_REDIRECT_URI=

# Upstash Redis request admission and short-lived caches. REDIS_URL includes
# credentials, for example rediss://default:TOKEN@INSTANCE.upstash.io:6379.
REDIS_URL=
# Keep false during rollout. Set true in production after Redis availability
# monitoring is in place to fail closed on protected high-cost routes.
REDIS_REQUIRED=false
ANALYTICS_MAX_RANGE_DAYS=93
ASSET_PROXY_MAX_BYTES=26214400

# Reddit
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=
```

Trends uses Google and Reddit only. Twitter/X Trends and its API route have been
removed; no X Trends token or paid API access is needed. Twitter/X social
publishing accounts and their OAuth configuration are independent and unchanged.

Some legacy or narrow integrations reference additional variables. Before
deploying one, search that integration's source for `process.env` and add only
the required values to the deployment secret store.

`NEXT_PUBLIC_API_KEY` and `NEXT_PUBLIC_API_SECRET` are not required for site
setup or connectivity diagnostics. Site setup now uses the user's session via
the authenticated same-origin proxy, and diagnostics use the public status
endpoint. Do not configure service credentials in browser-visible variables.
If a real service secret was previously published through either variable,
remove it from public deployment configuration and rotate it server-side.

## Debugging

```dotenv
NEXT_PUBLIC_DEBUG=
NEXT_PUBLIC_LOG_LEVEL=
```

These values are public. Never log tokens, authorization headers, personal data,
payment details, or complete provider payloads when debugging.

## Validation checklist

- The app can authenticate using the public Supabase configuration.
- Server-only operations reject requests when their secret is missing.
- Browser bundles and responses contain no server-only value.
- Redirect and webhook URLs match the current environment.
- Stripe test environments use only test keys and test price IDs.
- E2E credentials point to a disposable non-production account.
