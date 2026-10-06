# Public visitor sessions and image delivery

## Boundaries

Anonymous storefront visitors must not need a workspace login or receive a
service credential. Public asset delivery must not silently authorize paid
generation. These flows are separate from the authenticated workspace API
client and preserve the API's visitor proof and site-access checks.

## Storefront visitor tracking

`useSiteTracking` uses one coordinator per site and configured API origin.
Visitor/session IDs are issued by the API; the former global random IDs are not
reused. The proof is scoped to a browser tab in session storage. A cached proof
is checked against the API before writes, and renewal uses the API's PUT session
contract before expiry. Changing site or API origin never reuses another site's
proof. Tracking does not use a Supabase user token.

The app-issued `POST /api/commerce/visitor-session` handles hosted storefront
bootstrap, where the commerce hostname may not match the tenant's external
website URL. It:

1. Requires a JSON request from an authorized commerce-page origin (same-origin,
   or the exact supported www-to-app platform pair), bounded input and
   fail-closed rate admission.
2. Resolves the requested site through the existing public, non-archived shop
   boundary. A nonexistent or archived site cannot receive a session.
3. Calls only the fixed API session-creation endpoint with a server-only service
   credential **after** that public-resource authorization. It never forwards
   client credentials, supplied visitor/session IDs, actor IDs or prior proofs.
4. Returns only the new anonymous visitor/session IDs, session proof and expiry.
   This proof permits visitor activity, not verified lead identity or workspace
   access. No service credential appears in the response/browser bundle.

Subsequent session validation/renewal, events and attribute identification go
to the configured API with `X-Visitor-Session-Token` and `credentials: omit`.
The API must allow its existing public CORS preflight for this header. The local
bootstrap removes the need to register a shared commerce host for every tenant;
it does not alter `allowed_domains` or forge an outbound Origin.

Event timestamps are numeric. `add_to_cart` and `buy_now` are custom events with
`event_name` and `properties`; client properties cannot overwrite session/site
identity. Identification sends the supported top-level `name`, `email`, and
`phone` fields and is explicitly **unverified**. It does not grant lead access.
Page/referrer URLs omit query strings, fragments and known public-token path
values to avoid leaking checkout or document credentials into analytics.

Concurrent bootstrap calls are coalesced. StrictMode replay does not duplicate
the initial pageview. A later customer action is not deduplicated by text.
Failed or ambiguous writes are not automatically replayed; errors are returned
as sanitized structured results and exposed through the hook rather than being
silently treated as success. Checkout itself is not blocked by analytics errors.

## Generated images

`publicPromptImageUrl` creates an app-delivered `/api/images/prompt` URL: relative
on the app/local server, and absolute to app in a www/apex commerce browser.
Items/promotions carry their site ID when available; workspace-only callers can
use the current-site cookie as a **selector**, never as authorization. Legacy
stored `/api/public/image/prompt/...` URLs are normalized without forwarding
their origin, signature, identity overrides or credentials. Records Insights
uses the same helper instead of hardcoded API hosts.

### Makinari navigation icons

Module icons belong to Makinari, not the selected site. Nineteen approved images
from the Makinari site's existing public cache were captured on 2026-09-30 and
promoted to static application assets in `public/images/modules/makinari-2026-09-30`.
They are the existing renders, not newly generated images. The 1024px originals
are resized without cropping to 512px WebP (quality 90), retaining 2x resolution
for the 256px icon component. All 19 files together are approximately 239 KiB.

`app/config/module-image-overrides.ts` selects exactly these shared overrides:
Campaigns, Segments, Price Lists, Leads, Point of Sale, Conversations (`chat`),
Order Lines, Tasks (`controlCenter`), Check In, Inventory, Assets, AI Goals
(`requirements`), AI Activities (`activities`), Workflows, Performance, Cost
Reports, Database, Code (`applicationsRepositories`), and Billing. These images
load directly from static files for every site, without credentials, database
lookups, generation requests, or site-credit charges.

For every other module, `getModuleImageUrl` preserves the shared icon-set URLs
from commit `8ce0124f`: the unchanged prompt and 256-by-256 dimensions go directly to the configured API's
`/api/public/image/prompt/...` endpoint, without `site_id` or credentials. Requests
from `app.makinari.com` therefore use the API's existing platform image cache.
Do not route these icons through `/api/images/prompt`: that proxy selects the
current site and can charge site credits for a new copy of a platform asset.
Switching sites must not change the icon URL. Catalog, promotion and record
images retain the site-scoped authorization and delivery behavior below.

### Public delivery

The image route and Open Graph renderer read only already-public cached bytes
from the configured Supabase `generative_images/prompt_cache` bucket. The cache
key matches the API's current `sha256(lowercase(trim(v2:site:prompt))|WxH)`
contract. No API key, user bearer, fabricated Origin or arbitrary fetch target
is needed for this read. The API's versioned hash/path is an integration
contract: update the helper and regression test together if it changes.

If no site-scoped cached image exists, anonymous visitors see neutral artwork.
The response identifies it as `X-Image-Delivery: placeholder` and is not cached
as a successful generated image. Uploaded photos remain unchanged. Open Graph
converts cached bytes or inline neutral artwork to PNG locally, without a
recursive request to the app, and never triggers generation.

**Intentional behavior change:** browsing the public shop/marketplace no longer
starts a paid AI image workflow on a cache miss. To show a real generated photo
publicly, generate it from an authorized workspace context or persist/upload the
image. A neutral placeholder is not a claim that generation succeeded.

### Authenticated generation

On a cache miss, a same-origin workspace request must pass `requireSiteAccess`,
the site's insert capability and a matching server-verified session. Only then
does the proxy send `Authorization: Bearer <user token>` and the authorized site
to the fixed external image endpoint. It deliberately omits Origin/Referer so
the API uses its authenticated site path, not its platform-origin exception.
It never follows redirects or forwards the browser's API keys.

Inputs, dimensions, response bytes and wait time are bounded. HTML/SVG provider
responses are not accepted as generated raster images. Private responses vary
by cookie to prevent a site switch from reusing an unscoped browser cache.
The API's existing generation lock/rate admission still applies. Errors do not
cause automatic replay of a workflow that may already have started.

## Deployment requirements and validation

- Web server: `API_SERVER_URL` (or public URL fallback), `SERVICE_API_KEY` for
  narrowly authorized anonymous session issuance, and existing Upstash Redis
  configuration. Missing service credentials/admission fail closed.
- Browser: `NEXT_PUBLIC_API_SERVER_URL` for proof-bearing visitor requests.
- Public image cache: `NEXT_PUBLIC_SUPABASE_URL` must point to the same storage
  project as the API; only the configured Supabase host or `db.makinari.com`
  public cache path is accepted. Missing cache configuration yields neutral
  artwork, never an unauthenticated generation request.
- This repository's `next.config.js` includes the exact image and visitor-session
  rewrites when `MARKET_FIT_ORIGIN` is configured. That does not configure a
  separate www deployment; see the production-smoke limitation below.

### Production www routing limitation (2026-10-05 smoke)

Saved traces in `test-results/prod-smoke-20261005-fixtures-verified` show 21
`GET /api/images/prompt` 404s and one `POST /api/commerce/visitor-session` 404,
all on `https://www.makinari.com`. The storefront rerun contains two completed
image 404s. These are route-delivery failures, not proof that public cache reads
or session authorization failed inside the app handlers. The locally inspected
`commercial-site/next.config.js` in the sibling repository forwards commerce
pages but lacks these two exact API rewrites. No remote deployment configuration
was inspected or changed.

Browser callers now reuse `resolveAppApiUrl`: on www/apex, prompt-image URLs and
anonymous session bootstrap target the canonical app deployment directly.
Direct www/apex image URLs add `cache_only=1`, including normalized persisted links,
so unrelated app cookies cannot authorize generation or cause same-site
generation rejection. Unscoped local, app-host and server URL generation remain relative;
uploaded images and existing workspace-generation authorization are unchanged.
Normalization still forwards only prompt, dimensions, site selector and the
cache-only flag, never stored origins, signatures or identity overrides.

The app visitor-session handler supports a narrowly scoped OPTIONS preflight and
response CORS for the exact HTTPS www/apex commerce origins calling app. It
allows only POST and Content-Type, never wildcard origins or credentialed CORS.
The client still omits credentials and bootstrap proofs. Existing commerce-page
validation, public/non-archived site lookup, bounded bodies, fail-closed rate
admission and server-only service credentials remain mandatory. Subsequent
proof-bearing requests still use the configured external visitor API.

### Initial-document image routing repair (2026-10-06)

The public `/shop`, `/marketplace`, `/cart` and `/book` layouts now use
`PublicImageLayout` to resolve a delivery policy from asynchronous Next.js
`headers()` and serialize it through `PublicImageDelivery`. Exact www/apex/app
hosts select `https://app.makinari.com`; this also handles rewrites that retain
the app host. The first forwarded host takes precedence over Host. Local,
preview, demo, custom, missing and nonstandard-port hosts remain relative.
Origin/Referer and arbitrary request values cannot supply a delivery origin.
Using request headers makes these public layouts request-rendered; existing
data-cache/revalidation policies are not changed.

`ProgressiveImage` applies this explicit policy to every responsive candidate.
The native `PromptImage` wrapper also covers public PDP galleries, variants,
modifiers, promotions, booking and cart/order-summary images. Prompt requests
in these layouts always carry `cache_only=1`, including on app/local/preview
hosts with workspace cookies. SSR `src`/`srcset` and hydrated attributes agree;
there is no effect-time repair or dependence on JavaScript to change the URL.
Uploaded URLs remain unchanged. Unscoped workspace and authenticated buyer
callers retain their existing routing and generation contracts.

This in-repository image repair does not require a sibling www image rewrite.
It must still be rolled out by the deployment owner before production changes.
The visitor-session browser path continues using direct-app delivery and scoped
CORS. Do not add a broad API proxy or relax authentication as a workaround.

Regression tests in `public-image-ssr.test.tsx` render actual public layouts,
listing images and PDP galleries without `window`, then use `hydrateRoot` on
www/apex/local/preview documents to assert identical image requests and no
hydration warnings. `public-image-delivery.test.ts` covers exact-host selection,
public-only cache semantics, tenant selectors and legacy-query sanitization.
Local validation passed 125 tests in 15 focused Jest suites and a no-emit
TypeScript check. Core helpers/layouts/tests have no ESLint errors (one native
image warning); direct callers retain 34 pre-existing errors, confirmed against
HEAD without reverting files. No production build or deployment was run.

After an authorized rollout, verify both initial document image requests and
direct-app session preflight/POST on www/apex with strict smoke assertions. These
local changes and tests do not establish that production is fixed. The repair
session reran production smoke against the existing deployment; application
fixes were not deployed, no build was run, and no fixtures were rewritten.
Public session/tracking activity remains normal application behavior, not
evidence of paid generation or checkout coverage.

Local routing regression validation: 151 tests passed in 15 focused Jest suites,
including exact apex/www routing, SSR/preview isolation and the CORS header types;
ESLint passed for all touched routing/test files. Repository-wide `npm run lint`
reported 3,571 errors and 2,233 warnings in unrelated existing code; no lint rules
were disabled and no auto-fixes were applied.

Focused Jest coverage lives in the visitor-tracking hook suites, commerce
visitor-session route suite, prompt-image route/cache/URL suites, commerce
metadata/PNG rendering tests and Records Insights suites. Tests use isolated
transports; no events, visitor sessions or provider images are created remotely.
Live verification and deployment still require an approved target.

Validation on 2026-09-30: the integrated focused run passed 221 tests in 30
suites; the full Jest run passed 5,706 tests in 628 suites. `npm run typecheck`
passed. Targeted ESLint reported no errors and four existing native-image
warnings in ProgressiveImage/commerce Open Graph rendering. No production build
was run.

This resolves topic 1 of the external API auth audit. The separate privileged
action authorization findings in that audit remain out of scope.