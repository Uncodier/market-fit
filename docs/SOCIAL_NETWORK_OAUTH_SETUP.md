# Social Network OAuth

Social account connection is proxied through the external Outstand integration.
The application does not exchange provider authorization codes directly.

X is available for new accounts in Settings. The existing `twitter` callback
alias resolves to the Outstand `x` network. Bluesky uses a separate handle and
app-password form, not OAuth. Create an app password in [Bluesky settings](https://bsky.app/settings/app-passwords).
The server verifies site management access and capacity before forwarding the
password. The integration sends Outstand `appPassword` and `tenantId`, strips
tokens from the provider response, and saves only approved account metadata.
Reconnect targets the same handle without turning off the existing account in
the form. Deploy the integration API and web changes together and verify both
connection flows using dedicated accounts before claiming live provider readiness.

## Current flow

1. An authenticated user requests
   `POST /api/social/<network>/auth-url`.
2. The route forwards the request to the external API using
   `SERVICE_API_KEY`.
3. The browser opens the returned Outstand authorization URL.
4. The social provider redirects to Outstand's registered provider callback.
5. Outstand redirects to the application callback:
   `/api/social/callback/<network>`.
6. A callback containing `session` is forwarded to the settings selection flow,
   which calls the pending/finalize route.
7. Providers may instead return without a session token; the callback then
   attempts an authenticated account synchronization for the supplied site.

For Facebook and LinkedIn white-label flows, configure Outstand's callback in
the provider portal. Configure the application's callback with Outstand. Do not
register the application callback as the provider callback unless the provider
and Outstand documentation explicitly require a different flow.

## Environment

```dotenv
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_API_SERVER_URL=
API_SERVER_URL=
SERVICE_API_KEY=
SSH_TUNNEL_URL=
NEXT_PUBLIC_SSH_TUNNEL_URL=
NEXT_PUBLIC_PRODUCTION_URL=
NEXT_PUBLIC_FORCE_PRODUCTION_OAUTH_REDIRECT=
```

`SERVICE_API_KEY` is server-only. Variables prefixed `NEXT_PUBLIC_` are visible
to the browser and must not contain credentials.

The callback uses an explicitly configured HTTPS origin (or the production
fallback). Configure preview or tunnel origins intentionally. Verify callback
behavior in every proxy/deployment topology.

## Provider and Outstand configuration

- Allow the exact provider callback specified by Outstand.
- Allow the exact application callback with Outstand:
  `https://<application-origin>/api/social/callback/<network>`.
- Configure every production, preview, or tunnel origin intentionally.
- Do not rely on an undocumented wildcard.
- Keep provider app credentials in the external integration service, not in
  browser-visible application variables.

## Known authorization risk

The auth-url and finalize routes verify site management access before invoking
Outstand. Validate remaining account-management routes independently before reuse.

## Verification

- Reject an unauthenticated auth-url or finalize request.
- Reject a user attempting to connect an account to another site.
- Verify billing limits from server-owned site data.
- Test provider error, session-based completion, and implicit completion.
- Validate the network against the supported network mapping.
- Ensure callback redirects remain on approved application origins.
- Do not log session tokens, provider tokens, complete query strings, auth
  cookies, or account payloads.

Relevant implementation:

- `app/api/social/[network]/auth-url/route.ts`
- `app/api/social/callback/[network]/route.ts`
- `app/api/social/accounts/pending/[sessionToken]/finalize/route.ts`
- `app/api/social/lib/sync-outstand-accounts.ts`
- `app/api/social/network-map.ts`
- `lib/api-server-url.ts`
