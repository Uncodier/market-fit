# Google Authentication Setup

Google sign-in is configured through Supabase Auth. The application initiates
OAuth with an application callback at `/auth/callback`.

## Application environment

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Supabase configuration

In Supabase Dashboard:

1. Open **Authentication > Providers > Google**.
2. Enable Google and enter the Google OAuth client ID and secret.
3. Open **Authentication > URL Configuration**.
4. Set the production Site URL.
5. Add exact redirect URLs for each approved application origin:

```text
http://localhost:3000/auth/callback
https://<production-origin>/auth/callback
```

Avoid broad wildcard redirect patterns. Add preview origins only when the
deployment workflow requires them and their trust implications are understood.

## Google Cloud configuration

In the Google OAuth client, use Supabase's provider callback as an authorized
redirect URI:

```text
https://<supabase-project-host>/auth/v1/callback
```

The browser returns from Supabase to the application callback configured above.
Do not substitute the application callback for the Google-to-Supabase callback.

## Verification

1. Start from a clean browser session.
2. Sign in through the application.
3. Confirm the callback exchanges the code and redirects only to an allowed
   local path.
4. Verify the session cookie is established.
5. Repeat against every deployed origin configured in Supabase.

If PKCE verification fails, first compare the actual browser origin and callback
URL with Supabase configuration. Do not add cookie-clearing workarounds or
disable PKCE without identifying the mismatch.

Relevant implementation:

- `app/components/auth/auth-form.tsx`
- `app/hooks/use-auth.ts`
- `app/auth/callback/route.ts`
- `lib/auth/post-auth-redirect.ts`
