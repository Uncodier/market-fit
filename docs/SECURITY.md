# Security Guide

This guide defines the minimum checks for security-sensitive changes. It is not
a claim that every existing path already satisfies every item.

## Core rules

1. Treat every API route, Server Action, RPC, webhook, and public token endpoint
   as a separate trust boundary.
2. Authenticate on the server and authorize the specific resource and action.
3. Scope access by the trusted tenant/site relationship, not by a client-supplied
   `siteId`, `userId`, email address, or role.
4. Prefer a user-scoped Supabase client and RLS. Use a service-role client only
   after explicit authorization, and keep it in server-only code.
5. Validate all external input, including IDs, URLs, headers, metadata, prices,
   file sizes, MIME types, and state transitions.
6. Keep secrets out of `NEXT_PUBLIC_*`, logs, responses, test fixtures, and
   committed files.
7. Enforce important invariants in the database when concurrent requests could
   violate an application-only check.

## API and Server Action checklist

- Return `401` when no valid identity exists and `403` when identity exists but
  lacks permission.
- Do not depend on `app/middleware.ts` for API authentication; `/api/**` routes
  intentionally perform their own checks.
- For site-scoped route handlers, prefer
  `lib/auth/api-site-access.ts#requireSiteAccess`.
- Select only fields needed by the response. Public responses must use an
  explicit DTO.
- Validate request size before buffering large bodies.
- Avoid user enumeration: authentication recovery/check endpoints should not
  reveal whether an address exists unless the product explicitly requires it.
- Do not return raw provider or database errors to clients.

## Supabase and RLS

- `anon` is an unauthenticated database role, never an administrator.
- `service_role` bypasses RLS. Never expose it to the browser.
- Enable RLS on tables reachable through the Data API, then grant only the
  operations required by named policies.
- Test cross-tenant denial, not only the successful owner path.
- `SECURITY DEFINER` functions must:
  - set an explicit `search_path` such as `public, pg_temp`;
  - schema-qualify sensitive objects;
  - validate the caller or be executable only by `service_role`;
  - revoke execution from `PUBLIC`, `anon`, and `authenticated` unless access is
    intentionally required;
  - handle concurrent updates atomically.
- Never edit an already-applied migration. Add a later timestamped migration.

See [Database migrations](DATABASE_MIGRATIONS.md) for the migration workflow.

## Stripe and money movement

- Create Stripe sessions from server-owned prices and records. Never trust an
  amount, currency, seller, recipient, or entitlement sent by the browser.
- Restrict success and cancel URLs to trusted origins. The current helper is
  `app/api/stripe/checkout/checkout-url-security.ts`.
- Verify webhook signatures against the raw body before parsing or processing.
- Make webhook handling idempotent and concurrency-safe. The current claim flow
  is implemented by `app/api/stripe/webhook/webhook-delivery.ts` and timestamped
  migrations under `supabase/migrations/`.
- Record settlement progress before applying retryable side effects.
- Keep payment, refund, payout, inventory, and entitlement changes atomic when
  they form one business operation.
- Add regression tests for replay, concurrent delivery, partial failure,
  forged identity, untrusted return URLs, and duplicate settlement.

The older subscription, credits, portal, and payment-method Stripe routes are
documented security debt; they are not approved templates for new checkout
work. See [Stripe setup](STRIPE_SETUP.md).

## Public links and anonymous checkout

- Public document URLs must use high-entropy opaque tokens with expiry and
  revocation. Do not expose internal record IDs as authorization.
- Treat each token as a bearer credential: never log it or send it to analytics.
- Legacy rows may have no expiry, so every lifecycle change must account for
  that compatibility behavior explicitly.
- Public token actions must validate the action against the token's document and
  current lifecycle state.
- Return a minimal DTO; do not serialize internal ownership, payment, or contact
  fields by default.
- Anonymous checkout may identify a buyer, but must not allow that identity to
  claim another user's quote, order, or entitlement.

## Outbound requests and file proxies

- Use an explicit hostname allowlist and HTTPS.
- Reject credentials embedded in URLs, unexpected ports, private/link-local IP
  ranges, DNS rebinding targets, and unsafe redirects.
- Apply timeouts and streaming size limits; `Content-Length` alone is not
  sufficient.
- Preserve these controls when modifying
  `app/api/assets/proxy-security.ts` or proxy routes.

## Secrets and environment variables

- Browser-visible variables must be intentionally prefixed `NEXT_PUBLIC_*`.
- Server secrets include Supabase service keys, Stripe secrets, service API
  keys, encryption keys, OAuth client secrets, cron secrets, and test account
  credentials.
- Fail closed when a required production secret is absent. Do not add fallback
  credentials.
- Redact tokens, authorization headers, personal data, provider payloads, and
  bank details from logs.
- Rotate a secret immediately if it is committed or exposed; deleting it from a
  later commit does not revoke it.

## Required validation

Run the smallest relevant Jest suites while iterating, then expand based on
risk:

```bash
npm test -- --runInBand path/to/test.test.ts
npm run lint
```

For security-sensitive changes, include tests for unauthenticated, unauthorized,
cross-tenant, malformed-input, and concurrency/retry behavior. Do not run a
production build unless it is explicitly requested.

## Reporting

Do not place vulnerability details, credentials, or customer data in public
issues or documentation. Use the repository owner's private security channel.
No verified public security contact is currently documented in this repository.
