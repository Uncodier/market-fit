# Redis/Upstash Availability and Self-Amplification Audit

Captured: 2026-09-20

Status: point-in-time engineering audit. Current code, migrations, and tests
remain authoritative.

## Repository boundary

This document covers only the `market-fit` web application. It does not describe
the current Redis implementation in the separate `API` repository. That
implementation has its own audit in the API repository.

The review covered the canonical middleware, all 132 `app/api/**/route.ts`
files present at capture time, high-cost request paths, and client polling,
retry, SWR, and Realtime paths. No application-wide Redis/Upstash integration
or request rate limiter was found.

## Executive summary

The primary availability risk is the combination of API routes excluded from
middleware authentication, elevated handlers that trust a supplied `siteId`,
one-to-many query fan-out, duplicate polling, large buffered bodies, and retries
without distributed idempotency or concurrency control.

Upstash Redis is appropriate for admission control, short-lived caches,
single-flight coordination, provider budgets, and bounded concurrency. It must
not replace authentication, tenant authorization, webhook signatures, body
limits, or durable financial idempotency.

## Confirmed request boundary

[`app/middleware.ts`](../app/middleware.ts) deliberately skips Supabase
authentication for every `/api/*` request. This is a valid architecture only
when every route performs its own authentication, authorization, and input
validation.

The middleware currently protects browser navigation and performs suspicious
path filtering, but it does not impose request-frequency, concurrency, or byte
budgets on API traffic.

## Findings

### MF-01 — Analytics routes lack an explicit route-local access check

Severity: critical

No `getUser`, `getSession`, `requireSiteAccess`, or equivalent authorization
call was found in the following route groups:

- 14 routes under [`app/api/performance`](../app/api/performance);
- 12 routes under [`app/api/traffic`](../app/api/traffic);
- 3 routes under [`app/api/dashboard`](../app/api/dashboard).

Several underlying handlers instantiate a service-role client and accept
`siteId` from the query string. Representative examples include:

- [`app/api/performance/tokens/route.ts`](../app/api/performance/tokens/route.ts);
- [`app/api/traffic/session-events-combined/route.ts`](../app/api/traffic/session-events-combined/route.ts);
- [`app/api/dashboard/performance/route.ts`](../app/api/dashboard/performance/route.ts);
- [`app/api/dashboard/overview/route.ts`](../app/api/dashboard/overview/route.ts).

Impact:

- unauthorized cross-tenant reads may be possible where service-role access
  bypasses RLS;
- a caller can repeatedly trigger full-table scans and in-process aggregation;
- a small request burst can create a much larger Supabase workload.

Required controls:

1. Call `requireSiteAccess` before elevated access or expensive work.
2. Reject invalid dates and enforce a maximum reporting interval.
3. Move row-level aggregation into bounded SQL/RPC queries.
4. Add user, site, and route-class rate limits.
5. Cache normalized analytics responses for 30–120 seconds.
6. Use a single-flight lock to avoid simultaneous cache regeneration.

### MF-02 — Dashboard aggregation amplifies a single request

Severity: high

[`app/api/dashboard/performance/route.ts`](../app/api/dashboard/performance/route.ts)
invokes 12 route handlers concurrently. The overview batch invokes eight.
[`app/api/dashboard/export/route.ts`](../app/api/dashboard/export/route.ts)
creates six additional HTTP requests back into the same application.

Some child handlers paginate through every matching row in batches of 1,000 and
aggregate in memory. A retry of one batch repeats all child work.

Required controls:

- cache each complete batch using a tenant-scoped canonical key;
- coordinate cache misses with an owner-token lock;
- cap date ranges before constructing the cache key;
- avoid self-HTTP calls inside dashboard export;
- use SQL aggregates or rollups for high-cardinality datasets;
- return stale data briefly when regeneration is already in progress.

### MF-03 — Dynamic quotation processing has dual polling loops

Severity: critical

[`app/components/commerce/pdp/DynamicQuotePdpProvider.tsx`](../app/components/commerce/pdp/DynamicQuotePdpProvider.tsx)
polls every two to four seconds and continues loading the quotation after a
terminal result.

[`app/quotations/dynamic-quote-resolve.ts`](../app/quotations/dynamic-quote-resolve.ts)
starts a second two-second interval while the assistant request is in flight.
Its async interval callback has no in-flight guard, so slow polls can overlap.
[`app/quotations/dynamic-quote-api.ts`](../app/quotations/dynamic-quote-api.ts)
also performs an uncached tunneled log request without a timeout.

Required controls:

- stop polling on terminal states;
- prevent overlapping local polls;
- add a total deadline and abort signals;
- pause or slow polling while the page is hidden;
- prefer Realtime, SSE, or a durable job-status row;
- use a distributed single-flight lock keyed by quotation item while migration
  away from polling is in progress.

### MF-04 — Public proxy and assistant routes can consume large buffers

Severity: critical

[`app/api/assets/proxy/route.ts`](../app/api/assets/proxy/route.ts) is public and
buffers the full upstream response. The default maximum in
[`app/api/assets/proxy-security.ts`](../app/api/assets/proxy-security.ts) is
100 MiB.

[`app/api/robots/instance/assistant/route.ts`](../app/api/robots/instance/assistant/route.ts)
buffers the entire incoming body with `request.arrayBuffer()` before forwarding
it and has no route-local body cap.

Required controls:

- enforce platform/WAF request-size and connection limits;
- stream proxy responses instead of constructing duplicate buffers;
- use substantially smaller route-specific limits;
- apply per-IP and per-host byte budgets;
- apply distributed concurrent-request limits;
- reject requests before opening an upstream connection when admission fails.

Redis should hold counters and semaphore state, not binary content.

### MF-05 — Unsigned webhooks and public service-role mutations

Severity: critical

[`app/api/webhooks/appsumo/route.ts`](../app/api/webhooks/appsumo/route.ts)
accepts mutation events without verifying a provider signature.

[`app/api/agents/whatsapp/route.ts`](../app/api/agents/whatsapp/route.ts) does not
verify `X-Twilio-Signature` before using provider fields.

Other public mutation surfaces include:

- [`app/api/waitlist-signup/route.ts`](../app/api/waitlist-signup/route.ts),
  which can create one lead and two tasks per request;
- [`app/api/whatsapp-setup/route.ts`](../app/api/whatsapp-setup/route.ts), which
  writes through a service-role client without authenticating the caller.

Required controls:

1. Verify provider signatures over the original body.
2. Authenticate and authorize service-role mutations.
3. Add strict schemas, string limits, and body limits.
4. Add durable provider-event idempotency.
5. Add rate limits only after establishing caller authenticity.

### MF-06 — Legacy Stripe routes can amplify provider work

Severity: high

The legacy Stripe routes documented as security debt do not consistently
authenticate the user or authorize the requested site:

- [`app/api/stripe/checkout/credits/route.ts`](../app/api/stripe/checkout/credits/route.ts);
- [`app/api/stripe/checkout/subscription/route.ts`](../app/api/stripe/checkout/subscription/route.ts);
- [`app/api/stripe/portal/route.ts`](../app/api/stripe/portal/route.ts);
- [`app/api/stripe/payment-method/route.ts`](../app/api/stripe/payment-method/route.ts);
- [`app/api/stripe/invoice-url/route.ts`](../app/api/stripe/invoice-url/route.ts).

Repeated calls can create customers or sessions and perform several Stripe
lookups.

Required controls:

- authenticate and authorize the site before contacting Stripe;
- constrain return URLs using the existing checkout URL policy;
- use Stripe idempotency keys for creation calls;
- add a low per-user and per-site request budget;
- use single-flight around customer/session creation.

### MF-07 — Checkout and payout retries are not fully idempotent

Severity: high

The public commerce route in
[`app/api/commerce/checkout/route.ts`](../app/api/commerce/checkout/route.ts)
does not cap the number of lines or modifiers. Processing performs multiple
queries for each line and modifier.

[`app/commerce/checkout.ts`](../app/commerce/checkout.ts) applies
`clientMutationId` replay handling only to POS checkout. Shop and marketplace
checkout do not receive the same protection.

[`app/api/payouts/request/route.ts`](../app/api/payouts/request/route.ts) invokes
a database function that deducts balance and inserts a request on every
successful call. A retry can create an additional payout request.

Required controls:

- cap lines, modifiers, quantities, and serialized body size;
- require an idempotency key for every checkout source;
- add a unique database constraint and transactional claim;
- add a unique payout idempotency key in Postgres;
- optionally cache the completed response briefly in Redis.

### MF-08 — Exports, embeddings, and bulk mutations need backpressure

Severity: high

- [`app/api/leads/export/route.ts`](../app/api/leads/export/route.ts) loads all
  leads and generates the complete CSV in memory.
- [`app/api/sales/export/route.ts`](../app/api/sales/export/route.ts) loads all
  sales before generating a response.
- [`app/api/records/embed/route.ts`](../app/api/records/embed/route.ts) can wait
  synchronously for the external embedding service for up to 55 seconds.
- Bulk conversation and member routes use large or unbounded `Promise.all`
  fan-out.

Required controls:

- one active export or embedding operation per site/resource;
- bounded queues and worker concurrency;
- object storage for completed export files;
- set-based database mutations instead of per-row updates;
- dead-letter handling and an independently idempotent database sink.

If Redis Streams are used, durable queues should not share the same eviction
policy or capacity budget as expendable caches.

### MF-09 — Provider integrations lack shared budgets and caches

Severity: high

Examples:

- Google trends can perform up to eight sequential upstream queries;
- Reddit requests an OAuth token again for each API call;
- Cloudflare sync accepts an unbounded records array and can perform several
  provider calls per record;
- DNS, route preview, and geocoding can be multiplied using high-cardinality
  inputs.

Relevant paths:

- [`app/api/trends`](../app/api/trends);
- [`app/api/integrations/cloudflare`](../app/api/integrations/cloudflare);
- [`app/api/dns/verify-mx/route.ts`](../app/api/dns/verify-mx/route.ts);
- [`app/api/geocode/route.ts`](../app/api/geocode/route.ts);
- [`app/api/route/preview/route.ts`](../app/api/route/preview/route.ts).

Required controls:

- provider-specific global and per-site budgets;
- canonical positive and negative cache keys;
- token caching using provider expiry;
- one synchronization lock per site/domain;
- strict array limits, timeouts, and bounded concurrency.

Existing HTTP caching for geocode, FX, route preview, and version responses
should be preserved. Redis is useful only where cross-instance coordination or
negative caching is needed.

### MF-10 — Client hooks amplify authentication and data refreshes

Severity: high

[`app/hooks/use-auth.ts`](../app/hooks/use-auth.ts) performs an initial session
lookup, installs an auth listener, queries the profile, and can retry chat
identification ten times. The hook is instantiated directly throughout the
component tree despite the global
[`app/components/auth/auth-provider.tsx`](../app/components/auth/auth-provider.tsx).

Additional amplification sources include:

- deterministic global SWR retries in
  [`app/providers/swr-provider.tsx`](../app/providers/swr-provider.tsx);
- up to four attempts per traffic request in
  [`app/utils/fetch-with-retry.ts`](../app/utils/fetch-with-retry.ts);
- fixed polling in transactions and Zavu setup;
- Realtime events that trigger complete collection reloads;
- robot startup polling combined with log reconciliation polling.

Required controls:

- consume centralized auth context rather than creating independent listeners;
- identify the chat user once per user/session;
- use cancellable retries with jitter and status-aware retry rules;
- coalesce Realtime invalidations;
- apply local in-flight guards and visibility/offline checks.

These are source-level fixes. Adding Redis without fixing the clients would
preserve unnecessary request volume.

### MF-11 — A hard-coded API key exposes expensive application routes

Severity: critical

[`app/lib/api-keys-config.ts`](../app/lib/api-keys-config.ts) always includes
`market-fit-dev-api-key` and accepts API keys from query parameters.

[`app/api/applications/tables/route.ts`](../app/api/applications/tables/route.ts)
also leaves its tenant access denial commented out before running schema
introspection and count queries.

Required controls:

- remove the built-in key;
- reject secrets in URLs;
- use hashed, revocable server-side API key records;
- restore tenant authorization;
- rate-limit validation attempts by IP and valid keys by key fingerprint;
- cache positive validation briefly and negative validation for a shorter TTL.

## Recommended Redis control plane

### Layer 1 — Platform edge

Use Cloudflare/Vercel controls before a serverless invocation for:

- generic floods and bot challenges;
- connection and request-body limits;
- proxy bandwidth controls;
- malformed or repeatedly invalid webhook traffic.

An application Redis limiter does not prevent the platform invocation or the
first Redis operation.

### Layer 2 — Middleware admission

Add a lightweight Upstash REST admission check before the existing `/api/*`
middleware pass-through. It should use only information available before
authentication:

- trusted client IP;
- HTTP method;
- route class;
- global emergency budget.

Do not add Redis to every page navigation. Authenticated page middleware already
performs Supabase session and membership work.

### Layer 3 — Route-local admission

After authentication and input parsing, enforce the dimensions that middleware
cannot trust:

- authenticated user;
- authorized site;
- provider or operation;
- normalized resource identity;
- request cost, such as record count or expected bytes.

### Layer 4 — Durable correctness

Keep these in Postgres or the external provider:

- financial and inventory idempotency;
- webhook delivery state;
- unique mutation identities;
- transactional balance updates;
- durable job and settlement state.

## Redis primitives by use case

| Use case | Primitive | Example key |
| --- | --- | --- |
| Interactive request admission | Sliding window or token bucket | `rl:v1:analytics:user:<hash>` |
| Provider quota | Fixed budget with atomic increment | `budget:v1:reddit:global:<minute>` |
| Cache regeneration | Owner-token `SET NX PX` lock | `lock:v1:analytics:<key-hash>` |
| Duplicate mutation suppression | Short claim plus response cache | `dedupe:v1:checkout:<idempotency-hash>` |
| Concurrent operation cap | Atomic semaphore | `sem:v1:proxy:ip:<hash>` |
| Shared response cache | JSON value with explicit TTL | `cache:v1:analytics:<key-hash>` |
| Async backpressure | Bounded stream/queue | `queue:v1:exports:pending` |

Use HMAC or SHA-256 for IPs, emails, tokens, and provider IDs. Every dynamic key
must have an expiry unless it belongs to a deliberately durable queue.

## Initial policy candidates

These values are deployment starting points, not product guarantees. Observe
real traffic and adjust before broad enforcement.

| Route class | Suggested initial policy |
| --- | --- |
| Analytics batches | 20/minute/user, 60/minute/site, 60-second cache |
| Public mutations | 5/10 minutes/IP plus resource cooldown |
| Stripe session creation | 5/5 minutes/user and site |
| Provider synchronization | 5/minute/site, one concurrent operation |
| Exports | 2/10 minutes/user, one concurrent export/site |
| Embeddings | one active operation/record, bounded global queue |
| Asset proxy | 10/minute/IP, two concurrent requests, byte budget |
| Assistant proxy | 10/minute/user, one active request/instance |

Use fail-closed behavior in production for public expensive mutations, proxies,
and provider fan-out. Low-cost authenticated reads may fail open if losing Redis
would otherwise make the application unavailable.

## Controls that must not move to Redis

- user authentication and site authorization;
- RLS and service-role boundaries;
- webhook signature verification;
- request and response body limits;
- financial, inventory, payout, and entitlement idempotency;
- binary file storage;
- terminal polling-state decisions;
- permanent secrets or decrypted site credentials.

The existing database-backed Stripe delivery claim in
[`app/api/stripe/webhook/webhook-delivery.ts`](../app/api/stripe/webhook/webhook-delivery.ts)
is stronger than Redis-only deduplication and should remain authoritative.

## Implementation sequence

### Phase 0 — Remove unbounded work before adding Redis

1. Authorize analytics and export routes.
2. Verify AppSumo and Twilio webhook signatures.
3. Remove the built-in API key and restore tenant denial.
4. Add body, date-range, array, line, and modifier limits.
5. Stop Dynamic Quote and other terminal-state polling.
6. Add provider timeouts and client abort handling.

### Phase 1 — Add the shared Upstash foundation

1. Add an edge-compatible REST client with a strict timeout.
2. Add atomic rate-limit, cache, claim, lock, and token-checked release
   primitives.
3. Define route classes centrally.
4. Add 429/503 response helpers and standard rate-limit headers.
5. Make failure behavior explicit per policy.
6. Add metrics for accepted, rejected, unavailable, lock-contention, and cache
   outcomes.

### Phase 2 — Protect the highest-cost routes

1. Dashboard, performance, and traffic cache plus single-flight.
2. Proxy concurrency and byte admission.
3. Stripe and Cloudflare provider budgets.
4. Waitlist and setup-form admission.
5. Trends and provider-token caches.

### Phase 3 — Introduce bounded background work

1. Export jobs with object-storage results.
2. Record embedding queue.
3. Bulk mutation workers where set-based SQL is insufficient.
4. Dead-letter handling and independently idempotent persistence.

## Test requirements

Use Jest and cover:

- unauthenticated and cross-tenant rejection before expensive work;
- per-IP, per-user, per-site, and global limit dimensions;
- Redis unavailable under fail-open and fail-closed policies;
- 429 headers and retry timing;
- cache key tenant isolation and normalized parameter ordering;
- concurrent cache misses producing one computation;
- lock owner mismatch and expired-lock behavior;
- maximum body, date range, line count, and array count;
- duplicate checkout, payout, and provider delivery;
- queue-full and worker-retry behavior;
- polling cleanup after terminal state and component unmount.

Do not rely on a production build as the validation mechanism. Run the smallest
relevant Jest suites and lint checks for each implementation phase.

## Remediation status — 2026-09-20

Implemented in the working tree:

- site authorization, bounded date ranges, and admission controls for analytics;
- signed and size-limited AppSumo and Twilio webhooks;
- removal of the built-in API key and query-string API key transport;
- bounded request and response bodies plus upstream timeouts;
- durable checkout and payout idempotency, including a forward-only migration;
- non-overlapping Dynamic Quote polling with deadlines and cancellation;
- an Upstash REST control plane for rate limits, locks, semaphores, leases, and
  JSON cache single-flight;
- dashboard caches and route-class admission for the highest-cost API paths;
- bounded concurrency for asset proxying, exports, embeddings, and Cloudflare
  synchronization;
- centralized auth consumption and bounded, visibility-aware client retries;
- signed, tenant-authorized Cloudflare OAuth state and bounded provider inputs;
- capability-bound Dynamic Quote progress reads and conditional price writes;
- incremental or coalesced Realtime updates for transactions, robots, assets,
  artifacts, and plans.

Redis uses one credential-bearing `REDIS_URL`; `REDIS_REQUIRED` controls
fail-open versus fail-closed behavior. The payout idempotency schema objects
are present in the connected database, although its migration history does not
record the repository's timestamped migration names consistently.

Deployment still requires configuring the documented Redis and webhook
environment variables. Phase 3's
object-storage export jobs, durable embedding/bulk queues, and dead-letter
handling remain future architecture work; current request-path limits and
semaphores bound those operations but do not turn them into background jobs.
