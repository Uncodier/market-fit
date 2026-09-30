# External API authentication audit — 2026-09-30

## Scope and evidence

This follow-up to the chat `401 UNAUTHORIZED` repair inspected browser fetches,
the shared API client, Server Actions and same-origin proxies. It compared the
web callers with the adjacent API repository's current route and middleware
contracts. The API change `d69ad7dc` removed the browser `Origin` authentication
bypass; an allowed CORS origin no longer substitutes for an authenticated user.

This is a source/history audit with offline Jest regression tests, not a live
production audit. No messages, phone calls, workflows, provider requests,
migrations or deployments were executed. Production deployment versions and
configuration were not verified. Concurrent revenue/dashboard changes are not
part of this repair.

## Repairs in this change

| Surface | Finding | Repair |
| --- | --- | --- |
| Shared `apiClient` | Private requests continued without a token when no session existed; most callers could opt out. Absolute URLs could receive the user's token. | Require a session for private requests across all verbs, even for legacy opt-outs; fail on session errors; restrict credential destinations to the app/configured API; do not follow redirects. |
| `/content/[id]` generation | Direct `content-editor` fetch omitted authentication. | Authenticated same-origin proxy validates permissions and resource scope before forwarding the user's bearer token. |
| `/create-site` setup | Optional setup was skipped unless public API key/secret variables existed. | Same-origin manager-authorized setup proxy derives the user from the verified session. Setup remains non-blocking and is never automatically replayed. |
| `/robots` assistant | Cookie authentication passed locally, but only the browser's incoming bearer was forwarded except for skill imports. | Always derive the bearer from the matching verified session for user requests; remove unverified API keys; preserve the explicit internal-service path. |
| Content social publication | Server Action used a service key without local identity/site authorization. | User-scoped authorization and social account ownership checks before forwarding the user's bearer. No service credential substitution. |
| Legacy connectivity diagnostics | Root probes used public API key/secret variables and placeholder credentials. | Use the explicit public `/api/status` GET without credential headers. These helpers currently have no runtime UI consumer. |

The shared client is used by agents, lead research/follow-up, campaign/segment
builders, channel settings, workflow controls, People/Finder and Control Center
notifications. Most already attached a bearer for a valid session; they are not
all confirmed broken screens. The repair prevents their missing-session fallback
from issuing anonymous private requests.

Explicit anonymous reads supported by the shared client are `/`, `/api/status`
and `/api/public/posts`. Public visitor/browser integration clients remain
separate; do not require a workspace login for storefront visitors. The
`/api/public` namespace also contains protected generation/signing operations,
so it is not an authentication exemption in the client.

## Visitor and image follow-up

The two topic-1 findings below were subsequently repaired in the web application.
See [Public visitor sessions and image delivery](PUBLIC_VISITOR_AND_IMAGE_DELIVERY.md)
for the current contracts, public cache-miss behavior and deployment requirements.
The descriptions below record the original findings, not the current client.

### Visitor tracking and identification: public proof contract

`app/hooks/useSiteTracking.ts` generates local session IDs and sends no visitor
session proof. Its event timestamp is an ISO string, while the API requires a
number; `add_to_cart` is not a supported event discriminator. Identification
sends legacy `lead_data` and `url` fields rejected by the current strict schema.
Both paths ignore unsuccessful HTTP responses.

Affected consumers include Shop, product detail and Checkout. Depending on the
validation stage, the present request fails with `400`; correcting only the
body still leaves a missing visitor-proof `401`/`403`. The next repair must
bootstrap and preserve an API-issued visitor session, match the current event
and identity contracts and retain site isolation. Do not add a service key or
force anonymous shoppers to log in.

### Generated images: delivery and generation are different permissions

`app/lib/image-utils.ts` creates image URLs without `site_id` or signature.
These are used in catalog/POS, records, shop/marketplace, cart and buyer views.
`app/lib/commerce-og.tsx` fetches the same fallbacks server-side without identity
or origin, so the API rejects them before its cache lookup. Open Graph/icon
rendering silently loses those images.

This is **not** a universal failure on the workspace host: the current API
still has a special platform-origin path for `https://app.makinari.com`.
Mapped external origins may read cached images, but cold generation requires
the appropriate authentication/site authorization or signed capability. Local,
preview and public commerce hosts do not share that platform exception.
Records Insights also contains hardcoded historical API hosts.

The safe follow-up is persisted public assets/static fallbacks for public
delivery, or site-bound signed image capabilities with a defined generation
policy. Never add a bearer to the generic arbitrary-image fetch or forge an
`Origin` header to recover the old behavior.

## Remaining confirmed authorization findings — not repaired here

### Social account administration: high-priority authorization debt

The social account delete, OAuth URL, Bluesky connect and pending-session
finalize routes under `app/api/social/` still authenticate only a session and
then use `SERVICE_API_KEY` with client-supplied account/site/session inputs.
The current API counterparts do not supply the missing resource authorization.
Publication repair does not fix these separate administrative routes.

The external posts GET/POST handlers also need their own tenant/account
authorization for callers that bypass this web Server Action. JWT validation in
middleware establishes identity, not permission to the supplied tenant. The web
repair does not claim to secure direct requests to those API handlers.

Require verified user identity, manager/capability access to the site and
ownership of the account/OAuth session before privileged forwarding. Test
cross-site IDs, unrelated pending sessions and read-only collaborators.

### Dynamic quotation helpers: high-priority Server Action boundary debt

Internal helpers in `app/quotations/dynamic-quote-apply.ts`,
`dynamic-quote-resolve.ts` and `dynamic-quote-sync.ts` are exported from
`"use server"` modules. They perform generic service-key API calls, start
workflows or apply pricing with a service-role client without independently
validating an action caller. The sync helper accepts prefetched log input.
Token-protected wrappers do not make separately exported actions private.
The progress wrapper also spreads internal `sourceLogs` into its response.

Move private implementation helpers to server-only modules and expose only
narrow authenticated or quotation-token-authorized actions. Derive tenant,
instance, actor, logs and price inputs on the server and return explicit DTOs.
This requires a focused anonymous-buyer quotation regression pass; it is not
addressed by changing the browser API client's credentials.

### Other privileged actions: high-priority authorization debt

- `app/promotions/generate-promotion-image.ts` can spend a provider credential
  without checking the caller's identity, site or mutation capability.
- `app/api/robots/instance/domain/route.ts` verifies login but does not use the
  supplied site ID to authorize the operation before calling Vercel with a
  global project credential. Domain/site ownership must be enforced.

No exploit attempts were made. These findings need separate resource-specific
repairs; this audit is not a claim that all privileged APIs are secure.

## Reviewed paths without the reported missing-bearer issue

- Live instance logs already require a session token and send `Authorization`.
- Voice resync forwards a user token; its API validates site access.
- Skills proxies check site access before forwarding; writes use user identity.
- Finder already uses its same-origin authenticated proxy.
- The chat availability root probe is public liveness, not an auth test.
- The legacy team invitation helper sends a bearer and has no current runtime
  importer; it is not evidence of a broken invitation screen.
- Record embedding sends a server-only service key; a present key does not
  establish a full audit of every caller's operation authorization.

## Rollout and validation

Remove `NEXT_PUBLIC_API_KEY`/`NEXT_PUBLIC_API_SECRET` from public configuration.
If they ever contained real service secrets, rotate the corresponding secrets;
removing source references does not revoke already published credentials.
No new secret is needed by these user-session repairs.

Run the focused client/proxy/content regression tests and `npm run typecheck`.
New auth tests cover missing/expired sessions, foreign tenants, forged actors,
untrusted destinations, permission denial, malformed responses and no replay.
The shared client and create-site page retain existing explicit-`any` lint
debt; do not suppress rules or claim a clean baseline for those legacy files.

The focused run passed 404 tests in 26 suites. The full `npm test -- --runInBand`
run passed 5,562 tests in 614 suites, and `npm run typecheck` passed.
All new modules and focused auth changes outside those two legacy files passed
targeted ESLint. The old lint findings were reproduced from `HEAD`.

Existing content autosave still swallows some save failures, and accepted
scheduled/pending social posts are still labeled published by the current UI.
These persistence/delivery lifecycle limitations were not changed by the auth
repair. No automatic publication or workflow replay was added.

Live verification requires an approved disposable target and suitable accounts.
Public storefront tracking/image fixes still need deployment/live verification;
the privileged-action authorization findings above remain unresolved.