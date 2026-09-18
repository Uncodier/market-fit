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

## Stripe

```dotenv
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_PRICE_ID=
STRIPE_STARTUP_PRICE_ID=
STRIPE_ENTERPRISE_PRICE_ID=
STRIPE_ACCOUNT_ADDON_PRICE_ID=
CHECKOUT_RETURN_ORIGINS=
```

`CHECKOUT_RETURN_ORIGINS` is a comma-separated list of additional exact origins.
Wildcard subdomains are not accepted. Keep test and live Stripe keys, price IDs,
and webhook secrets in matching environments.

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

# Reddit
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=
```

Some legacy or narrow integrations reference additional variables. Before
deploying one, search that integration's source for `process.env` and add only
the required values to the deployment secret store.

`NEXT_PUBLIC_API_SECRET` and browser-visible fallback credentials remain in
legacy code. They are not approved secret-storage patterns and must not be used
for new integrations.

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
