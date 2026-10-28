import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { accountLifecyclePolicy } from '../support/account-lifecycle-policy';
import { mailboxSnapshot, waitForAccountEmail } from '../support/account-mailbox';
import { boundSessionToken } from '../support/project-lifecycle-policy';
import { dismissConsent } from '../support/workspace';
import { accountButton } from '../support/account-ui';

test('new user signs up, confirms email, logs in, logs out and recovers their password', async ({ page }, testInfo) => {
  const policy = accountLifecyclePolicy();
  const initialPassword = `Qa!I6${randomBytes(24).toString('hex')}`;
  const password = `Qa!A7${randomBytes(24).toString('hex')}`;
  const replacement = `Qa!B8${randomBytes(24).toString('hex')}`;
  const evidence = { qaId: policy.qaId, runId: policy.runId, userId: null as string | null,
    signup: false, confirmation: false, initialPasswordSetup: false, login: false, logout: false, recovery: false,
    passwordChanged: false, oldPasswordDenied: false, newPasswordLogin: false,
    stage: 'before-signup', failureKind: null as string | null,
    cleanup: { method: 'exact-disposable-environment-destruction', completed: false, expiresAt: policy.expiresAt } };
  const directory = path.resolve('.auth', 'local', policy.runId);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const persist = () => writeFile(path.join(directory, 'account-lifecycle-journal.json'), JSON.stringify(evidence, null, 2), { mode: 0o600 });
  await persist();
  const client = createClient(policy.backend, policy.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const onBackend = (value: string, endpoint: string) => {
    const url = new URL(value);
    return url.origin === policy.backend && url.pathname === `/auth/v1/${endpoint}`;
  };
  const identity = async () => {
    const token = boundSessionToken(await page.context().cookies(policy.baseURL), policy.backend);
    const result = await client.auth.getUser(token);
    if (result.error || !result.data.user || result.data.user.email !== policy.email) {
      throw new Error('Browser session must belong to the exact newly created QA account');
    }
    if (evidence.userId && evidence.userId !== result.data.user.id) throw new Error('QA account identity changed');
    return result.data.user;
  };
  const login = async (secret: string, success: boolean) => {
    evidence.stage = success ? 'password-login-requested' : 'old-password-login-requested';
    await persist();
    await page.goto('/auth?returnTo=%2Fprojects', { waitUntil: 'domcontentloaded' });
    await dismissConsent(page);
    await page.locator('input[name="email"]').fill(policy.email);
    await page.locator('input[name="password"]').fill(secret);
    const result = page.waitForResponse(response => onBackend(response.url(), 'token') && response.request().method() === 'POST');
    await accountButton(page, ['auth.signInBtn']).click();
    const response = await result;
    if (!success) {
      expect(response.status(), 'Old password must be rejected by real Auth').toBe(400);
      await expect(page.locator('input[name="password"]')).toBeVisible();
      expect(new URL(page.url()).pathname).toBe('/auth');
      return;
    }
    expect(response.ok(), 'Password login must succeed').toBe(true);
    await page.waitForURL(url => url.origin === policy.baseURL && url.pathname === '/projects');
    await identity();
  };
  const logout = async () => {
    // Exercise the app's real logout route, then prove workspace navigation is denied.
    evidence.stage = 'logout-requested';
    await persist();
    await page.goto('/api/auth/logout', { waitUntil: 'load' });
    await page.waitForURL(url => url.origin === policy.baseURL && url.pathname === '/auth');
    evidence.stage = 'logout-returned-to-auth';
    await persist();
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(url => url.origin === policy.baseURL && url.pathname === '/auth');
    await expect(page.locator('input[name="password"]')).toBeVisible();
  };
  const openEmail = async (link: string) => {
    // The link has already been bound to the local Auth origin and app redirect.
    // SSR renders the confirmation button before its client click handler loads.
    try { await page.goto(link, { waitUntil: 'load' }); }
    catch { throw new Error('QA email action navigation failed; bearer URL is not reported'); }
    if (new URL(page.url()).pathname === '/auth/confirm') {
      // Custom local templates lead to the app's explicit confirmation action.
      const confirm = accountButton(page, ['auth.flows.confirm.signIn', 'auth.flows.reset.title']);
      try { await confirm.click(); }
      catch { throw new Error('QA email confirmation action unavailable; bearer URL is not reported'); }
    }
  };
  try {
    const beforeSignup = await mailboxSnapshot(policy);
    expect(beforeSignup.size, 'A new run must not adopt a pre-existing mailbox').toBe(0);
    await page.goto('/auth?returnTo=%2Fprojects', { waitUntil: 'domcontentloaded' });
    await dismissConsent(page);
    await accountButton(page, ['auth.signUpLink']).click();
    await page.locator('input[name="name"]').fill(`QA ${policy.runId}`);
    await page.locator('input[name="email"]').fill(policy.email);
    await page.locator('input[name="password"]').fill(initialPassword);
    const inserted = page.waitForResponse(response => onBackend(response.url(), 'signup') && response.request().method() === 'POST');
    await accountButton(page, ['auth.getStarted', 'auth.signUpBtn']).click();
    const signup = await inserted;
    expect(signup.ok(), 'Actual public signup must create the account').toBe(true);
    const created = await signup.json();
    const user = created.user || created;
    if (!/^[a-f0-9-]{36}$/i.test(user.id || '') || user.email !== policy.email) {
      throw new Error('Signup must return the exact new QA user');
    }
    evidence.userId = user.id;
    evidence.signup = true;
    evidence.stage = 'signup-created-awaiting-email';
    await persist();
    if (user.email_confirmed_at) throw new Error('QA signup must require real email confirmation; enable email confirmations');
    await openEmail(await waitForAccountEmail(policy, 'signup', beforeSignup));
    evidence.stage = 'confirmation-clicked-awaiting-identity';
    await persist();
    // Confirmation is proved by Auth, not just a UI toast or a delivered email.
    await expect.poll(async () => {
      try { return Boolean((await identity()).email_confirmed_at); } catch { return false; }
    }, { timeout: 45_000 }).toBe(true);
    evidence.confirmation = true;
    evidence.stage = 'confirmed-awaiting-initial-password';
    await persist();
    // Current signup confirmation requires the app's initial password-set step.
    // Do not mark password_set through metadata or bypass this onboarding screen.
    await page.waitForURL(url => url.origin === policy.baseURL && url.pathname === '/auth/set-password');
    await page.locator('#password').fill(password);
    await page.locator('#confirmPassword').fill(password);
    const configured = page.waitForResponse(response => onBackend(response.url(), 'user') && response.request().method() === 'PUT');
    await page.locator('button[type="submit"]').click();
    expect((await configured).ok(), 'Initial password setup must persist through real Auth').toBe(true);
    await page.waitForURL(url => url.origin === policy.baseURL && ['/projects', '/auth'].includes(url.pathname));
    evidence.initialPasswordSetup = true;
    evidence.stage = 'initial-password-set';
    await persist();
    await logout();
    await login(password, true);
    evidence.login = true;
    await logout();
    evidence.logout = true;
    evidence.stage = 'login-logout-verified';
    await persist();
    const beforeRecovery = await mailboxSnapshot(policy);
    await page.goto('/auth?returnTo=%2Fprojects', { waitUntil: 'domcontentloaded' });
    await accountButton(page, ['auth.forgotPassword']).click();
    await page.locator('input[name="email"]').fill(policy.email);
    const requested = page.waitForResponse(response => onBackend(response.url(), 'recover') && response.request().method() === 'POST');
    await accountButton(page, ['auth.sendResetLink']).click();
    expect((await requested).ok(), 'Real recovery request must succeed').toBe(true);
    evidence.stage = 'recovery-requested-awaiting-email';
    await persist();
    await openEmail(await waitForAccountEmail(policy, 'recovery', beforeRecovery));
    await page.waitForURL(url => url.origin === policy.baseURL && url.pathname === '/auth/set-password');
    await identity();
    evidence.recovery = true;
    evidence.stage = 'recovery-confirmed';
    await persist();
    await page.locator('#password').fill(replacement);
    await page.locator('#confirmPassword').fill(`${replacement}-mismatch`);
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    await page.locator('#confirmPassword').fill(replacement);
    const updated = page.waitForResponse(response => onBackend(response.url(), 'user') && response.request().method() === 'PUT');
    await page.locator('button[type="submit"]').click();
    expect((await updated).ok(), 'Password update must persist through real Auth').toBe(true);
    evidence.passwordChanged = true;
    evidence.stage = 'replacement-password-set';
    await persist();
    await page.waitForURL(url => url.origin === policy.baseURL && ['/projects', '/auth'].includes(url.pathname));
    await logout();
    await login(password, false);
    evidence.oldPasswordDenied = true;
    await login(replacement, true);
    evidence.newPasswordLogin = true;
    evidence.stage = 'all-account-checkpoints-verified';
    await logout();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    evidence.failureKind = message.startsWith('QA email recipient') ? 'mail-recipient-mismatch'
      : message.startsWith('Unexpected or unscoped') ? 'mail-response-invalid'
      : message.startsWith('QA local mailbox') ? 'mail-transport-failure'
      : message.startsWith('QA email action') ? 'mail-link-navigation'
      : message.startsWith('QA email confirmation') ? 'confirmation-control-unavailable'
      : message.includes('Unable to bind') ? 'browser-session-binding'
      : 'assertion-or-product-failure';
    // Engine failures may include the current bearer-link URL in their call log.
    throw new Error('Account lifecycle failed; inspect safe checkpoints in the private run journal');
  } finally {
    await client.auth.signOut({ scope: 'local' });
    await persist();
    // No password, email action URL, token, cookies, or provider payload is attached.
    await testInfo.attach('account-lifecycle-evidence', { body: JSON.stringify(evidence), contentType: 'application/json' });
  }
});

test('invalid login does not establish an authenticated workspace session', async ({ page }) => {
  const policy = accountLifecyclePolicy();
  await page.goto('/auth?returnTo=%2Fprojects', { waitUntil: 'domcontentloaded' });
  await dismissConsent(page);
  await page.locator('input[name="email"]').fill(`missing-${policy.runId.slice(-32)}@example.invalid`);
  await page.locator('input[name="password"]').fill(`Qa!${randomBytes(24).toString('hex')}`);
  const denied = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.origin === policy.backend && url.pathname === '/auth/v1/token' && response.request().method() === 'POST';
  });
  await accountButton(page, ['auth.signInBtn']).click();
  expect((await denied).status()).toBe(400);
  await expect(page.getByRole('alert').filter({ hasText: /Invalid login credentials|Credenciales de inicio de sesión no válidas/ }).first()).toBeVisible();
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(url => url.origin === policy.baseURL && url.pathname === '/auth');
  await expect(page.locator('input[name="password"]')).toBeVisible();
});

test('a reset URL without a recovery token cannot expose the password form', async ({ page }) => {
  const policy = accountLifecyclePolicy();
  await page.goto('/auth/reset-password?returnTo=%2Fprojects', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#confirmPassword')).toHaveCount(0);
  await page.waitForURL(url => url.origin === policy.baseURL && url.pathname === '/auth');
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await expect(page.locator('#confirmPassword')).toHaveCount(0);
  expect(new URL(page.url()).origin).toBe(policy.baseURL);
});