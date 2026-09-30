# Support chat identity

The application does not identify signed-in users by calling `chat.identify`
with profile email. Unverified profile attributes are not account credentials,
and automatic initialization must never request an email verification code.

## First-party flow

1. `app/components/TrackingInit.tsx` enables `chat.requireIdentityToken` and
   pins the support site. The compatible SDK does not restore an old account
   from cookies before application authentication has completed.
2. `app/hooks/use-auth.ts` synchronizes the signed-in user with
   `lib/chat/browser-identity.ts`. The coordinator requires the new SDK methods;
   it never falls back to legacy email identification.
3. The browser obtains the signed widget session with `getIdentityContext()` and
   calls the same-origin `POST /api/chat/identity-token` with `{session_id}` and
   `x-visitor-session-token`.
4. The route validates the browser origin, JSON size, and real Supabase user
   (`createClient(true)` bypasses demo mode). It forwards that user's access token
   to the API's `POST /api/visitors/identity/token/current-user` endpoint. It does
   not use a service key, accept user/site/email overrides, or query profiles.
5. The API verifies the Supabase user again, independently verifies the widget
   session proof, and issues a short-lived signed token for the fixed support
   site and stable auth subject. The browser passes only that token to
   `identify({identityToken})`.

The identity token and session proof stay in flight only: no URLs, logs,
localStorage, or persistent application cache. Responses use `no-store` and the
server refuses redirects while forwarding bearer credentials.

The coordinator clears protected chat state on logout/account changes, cancels
stale issuance, and waits for server revocation before identifying the next
account. It rechecks widget sessions and renews active grants after ten minutes.
Background tabs defer identification until visible. Chat failure does not block
normal app authentication or send OTP emails.
Application sign-out waits at most three seconds for optional chat revocation;
the pending revocation still blocks any subsequent account from being bound.
The repaired SDK clears local state immediately but waits for configured startup
before sending revocation. Same-account renewal preserves unsent text, selected
files and the active conversation only after fresh proof confirms the same
lead/site/session; account changes and failures discard that transient draft.

## Deployment requirements

- Deploy the API's forward-only identity-token migration and configure its
  dedicated `VISITOR_IDENTITY_SIGNING_SECRET` and `VISITOR_IDENTITY_SIGNING_KEY_ID`
  before activating issuance. Never reuse encryption or widget-session secrets.
  Apply the follow-up `20260929221000_identity_credential_versions.sql` after
  `20260929210000_visitor_identity_tokens.sql`; the repaired API uses the
  version-fenced exchange RPC. Neither migration is applied by these tests.
- Publish the compatible SDK to the existing tracking script URL, then deploy
  this frontend. No production build, deployment or migration is performed by
  the implementation tests.
- Set `API_SERVER_URL` / `NEXT_PUBLIC_API_SERVER_URL` to the trusted API. HTTPS is
  required except loopback development. The frontend does not need the signing
  secret or a new privileged integration credential.
- Browser origins are the exact built-in Makinari app/www origins plus
  `NEXT_PUBLIC_APP_URL`. Custom frontend deployments must configure that value.
  This does not replace the tracking backend's site/domain allowlist.
- Keep `app.makinari.com` authorized on the support site's domain allowlist.

The API owns stable identity mapping, redemption, session epochs, grant expiry,
and revocation. Existing conversations are not attached by matching arbitrary
profile email. Any historical-contact migration requires a separate verified
linking policy.

## External customer integrations

The API-key creation dialog includes the explicit `identity:issue` permission.
Only the site owner may provision this server-only credential. It is
not implied by read/write/delete scopes or global service credentials. External
backends derive a stable user ID from their own authenticated session and call
the API's site-scoped issuance endpoint. Refer to the API and Script identity
guides for the full contract; never ship this key in frontend code.

Plain SDK `identify({name, email})` is now attributes-only. Explicit visitor
verification uses `requestIdentityVerification(...)` or the user-submitted chat
form; only that flow can request an OTP.

## Offline regression checks

```bash
npm test -- --runInBand __tests__/auth/chat-identity-hook.test.tsx __tests__/api/chat-identity-token.test.ts __tests__/lib/chat/browser-identity.test.ts
```

These tests do not send email, create telemetry, or contact the production API.
Live end-to-end rollout verification must use an explicitly approved target.