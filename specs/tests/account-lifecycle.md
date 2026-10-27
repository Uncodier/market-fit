# Disposable QA account lifecycle

## Status

Authored, offline validated; live browser verification pending. This is not a
passing QA certificate. No production account creation or password changes.

## Goal and scope

Exercise the real public UI and Supabase Auth, not installer-created accounts:

1. Open `/auth?returnTo=/projects` with an empty browser context.
2. Register a unique run-owned synthetic identity using the Sign up form.
3. Require an initially unconfirmed user and an actual confirmation email in
   local Inbucket. Follow only the trusted action for that exact recipient.
4. Verify confirmed identity through public-key Auth using the browser session.
   Complete the app's actual initial password-set screen; do not initialize
   `password_set` metadata through an administrative shortcut.
5. Log out through the real application logout route; prove protected navigation
   returns to login. Login with the original password and verify the same user.
6. Submit Forgot password through the UI. Receive a new recovery email, excluding
   messages present before submission. Follow the real link and verify identity.
7. Require mismatched password confirmation to disable submission; then persist
   the replacement password through Supabase Auth from the app's form.
8. Prove the original password is rejected and replacement login succeeds for the
   same user, then log out. No API-based auto-confirm, generated reset links, or
   mocked provider responses may replace these steps.
9. Separate negative tests cover an invalid login and missing-token recovery URL.

Project creation/selection/cancellation/password-confirmed archival remains the
existing `project-lifecycle` browser journey. Run it separately on the provisioned
QA admin; do not infer that registration proves project creation.

## Target and authority

The installer supplies explicit loopback app, Supabase and Inbucket origins.
`account-lifecycle` is **local-only**, with `TEST_ALLOW_ACCOUNT_LIFECYCLE=1`, both
disposable mutation flags, `QA_STATUS=VERIFIED`, exact QA/run namespace and expiry.
It uses only `TEST_SUPABASE_ANON_KEY` and creates its own new identity. Seeded admin,
buyer and role accounts are not modified. Missing prerequisites fail preflight.

Fresh QA must enable email confirmations and provide signup/recovery templates
compatible with `/auth/confirm?token_hash=...&type=email|recovery&returnTo=/projects`.
Inbox API is read only. No actual customer email, SMS, OAuth or paid operation.

## Evidence and cleanup

Passwords are generated in memory, never committed, printed or saved. Recording,
video and screenshots are disabled for the account suite because email links and
password requests are bearer-secret surfaces. Reports attach only user ID, QA/run
IDs and individual confirmed checkpoints. A private mode-0600 journal under
`.auth/local/<run-id>/` is created before signup and updated after creation.

Account cleanup is **exact resource-group destruction by the QA lifecycle**, not
a service-role deletion or global database reset. Until group absence is verified,
the journal states `cleanup.completed=false`. Failed partial signup is retained
for diagnosis on the disposable environment; never adopt or delete unknown IDs.
Export the safe journal/summary before expiry. This does not test an account-delete
product flow.

## Execution and limitations

Run provision → account-lifecycle → project-lifecycle → smoke → buyer → roles →
regression sequentially, with the installer's safe lifetime window for each suite.
The account suite has a 20-minute global timeout and the installer requires at
least 25 minutes remaining. The previous Azure environment lacks that window;
new infrastructure requires explicit approval.

```sh
npm run test:e2e -- --suite account-lifecycle --list
npm test -- --runInBand __tests__/e2e/account-lifecycle.test.ts __tests__/e2e/discovery.test.ts
```

Source-derived locators and email-link contracts require live validation before
claiming success. Logout is currently exercised through the actual app endpoint,
not the profile-menu click. Expired/replayed token, duplicate-signup enumeration,
Google OAuth and team-invitation journeys remain separate coverage requirements.

## Validation recorded — 2026-10-27

- Frontend E2E support/regression tests: **595 passed**, 24 Jest suites.
- Installer: **85 passed**, seven Jest suites, including temporary-copy email
  configuration safety and requested-suite authorization boundaries.
- Playwright discovery includes exactly three account acceptance tests, with no
  admin auth setup; all six suite selections pass offline discovery checks.
- Targeted ESLint and `git diff --check` pass. Typecheck still reports the prior
  `manual-reservation-contract.test.ts:96` uninitialized `row`; authored account
  files have no reported TypeScript diagnostics.
- Fresh installer packaging enables confirmations and creates local token-hash
  email templates only in its temporary Supabase config copy. Original schema
  config/manifest/migrations remain unchanged. Packaging now requires Python 3.11+
  for standard-library TOML parsing, along with the existing Node 22 requirement.
- No authored account acceptance test has run against a fresh deployment. The
  prior QA expired at 22:35:34 UTC; status still reported `groupExists=true` at
  approximately 22:39 UTC, then confirmed **`groupExists=false`** after 22:40 UTC.
  No new test was started there. Earlier passing seeded-user suites are not
  signup/recovery evidence.