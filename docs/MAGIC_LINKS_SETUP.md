# Team Invitation Email Setup

Team invitations use Supabase authentication email flows. Confirmed users
receive an OTP magic link; new or unconfirmed users receive a Supabase admin
invitation. Both flows return through `/api/auth/callback`.

## Environment

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

The service-role key is required by the server-side invitation route and must
never be exposed to browser code.

## Supabase URL configuration

In **Authentication > URL Configuration**, set the production Site URL and add
the exact callback for every approved application origin:

```text
http://localhost:3000/api/auth/callback
https://<production-origin>/api/auth/callback
```

The normal Google OAuth callback is `/auth/callback`; team invitations use the
separate `/api/auth/callback` route.

## Email templates

Configure Supabase's Magic Link and Invite User templates. Preserve
`{{ .ConfirmationURL }}` as the destination. Presentation metadata such as site
name and role may be displayed in the email, but URL parameters and user
metadata are not authorization.

Invitation acceptance must verify the authenticated email, pending invitation,
site, role, and current membership state on the server.

## Current flow

1. `POST /api/team/invite-member` authorizes the inviter.
2. The route sends either a magic link or an admin invitation.
3. Supabase redirects to `/api/auth/callback` with invitation context.
4. The callback establishes the session and forwards to
   `/auth/team-invitation`.
5. `POST /api/team/accept-invitation` validates and applies membership.

Relevant implementation:

- `app/api/team/invite-member/route.ts`
- `app/api/auth/callback/route.ts`
- `app/auth/team-invitation/page.tsx`
- `app/api/team/accept-invitation/route.ts`
- `app/services/magic-link-invitation-service.ts`

## Verification

- Test existing confirmed, existing unconfirmed, and new users.
- Test an expired or reused link.
- Test an authenticated email that differs from the invited email.
- Test a non-manager attempting to invite.
- Test accepting an invitation for a different site or modified role.
- Verify rate-limit errors do not reveal whether an account exists.
- Confirm callback and error redirects cannot leave approved application
  origins.

Use disposable non-production accounts. Do not log generated links, tokens, or
complete user metadata.
