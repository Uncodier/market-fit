import { assertDisposable, readEnvironment, required, validateOrigin } from './environment';

type Environment = Record<string, string | undefined>;

/** Account creation/recovery is confined to the installer's local disposable stack. */
export function accountLifecyclePolicy(env: Environment = process.env, now = Date.now()) {
  const config = readEnvironment(env);
  assertDisposable(env, config.target);
  if (config.suite !== 'account-lifecycle' || config.target !== 'local') {
    throw new Error('Account lifecycle requires its isolated local QA suite');
  }
  if (env.TEST_ALLOW_ACCOUNT_LIFECYCLE !== '1' || env.QA_STATUS !== 'VERIFIED') {
    throw new Error('Account lifecycle requires explicit consent and verified QA fixtures');
  }
  const qaId = required(env, 'QA_ENVIRONMENT_ID');
  const runId = required(env, 'SHIPLIGHT_RUN_ID');
  if (!/^qa-[a-zA-Z0-9_-]{1,80}$/.test(qaId) ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(runId) || !runId.startsWith(`${qaId}-account-lifecycle-`)) {
    throw new Error('Account lifecycle requires an installer-owned run namespace');
  }
  const expiresAt = required(env, 'QA_EXPIRES_AT');
  if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) - now < 1_200_000) {
    throw new Error('Account lifecycle requires 20 minutes before automatic QA destruction');
  }
  const backend = validateOrigin(required(env, 'TEST_SUPABASE_URL'), 'local');
  const mailbox = validateOrigin(required(env, 'TEST_INBUCKET_URL'), 'local');
  const key = required(env, 'TEST_SUPABASE_ANON_KEY');
  if (!key.startsWith('sb_publishable_')) {
    let role: unknown;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* Reject below. */ }
    if (role !== 'anon') throw new Error('Account lifecycle requires a public key, never service role');
  }
  // Keep the entire unique run ID: truncation or case folding could alias a mailbox.
  if (runId.length > 64 || runId !== runId.toLowerCase()) throw new Error('Account run ID must be lowercase and at most 64 characters');
  const email = `${runId}@example.invalid`;
  if (['ADMIN', 'BUYER', 'COLLABORATOR', 'MARKETING', 'FOREIGN']
    .some(role => env[`TEST_${role}_EMAIL`]?.toLowerCase() === email)) {
    throw new Error('Account journey must not reuse a provisioned fixture identity');
  }
  return { ...config, backend, mailbox, key, qaId, runId, expiresAt, email };
}

export type AccountLifecyclePolicy = ReturnType<typeof accountLifecyclePolicy>;

/** Never follow an email's external origin, untrusted redirect, or wrong action. */
export function validateAccountLink(value: string, kind: 'signup' | 'recovery', policy: AccountLifecyclePolicy): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Invalid QA email action link'); }
  if (url.username || url.password || url.hash) throw new Error('Invalid QA email action link');
  const redirect = url.searchParams.get('redirect_to');
  const expectedPath = kind === 'signup' ? '/auth/confirm' : '/auth/reset-password';
  const backendLink = url.origin === policy.backend && url.pathname === '/auth/v1/verify' &&
    url.searchParams.get('type') === kind && Boolean(url.searchParams.get('token'));
  const appLink = url.origin === policy.baseURL && url.pathname === '/auth/confirm' &&
    ['email', 'signup', 'recovery'].includes(url.searchParams.get('type') || '') &&
    (kind === 'recovery' ? url.searchParams.get('type') === kind : url.searchParams.get('type') !== 'recovery') &&
    Boolean(url.searchParams.get('token_hash'));
  if (!backendLink && !appLink) throw new Error('QA email action does not match the trusted origin/action');
  if (backendLink && !redirect) throw new Error('QA email action requires its app redirect');
  if (redirect) {
    let target: URL;
    try { target = new URL(redirect); } catch { throw new Error('Invalid QA email redirect'); }
    if (target.origin !== policy.baseURL || target.pathname !== expectedPath || target.username || target.password ||
      target.hash || target.searchParams.get('returnTo') !== '/projects' ||
      [...target.searchParams.keys()].some(key => key !== 'returnTo')) throw new Error('Untrusted QA email redirect');
  }
  const allowedKeys = backendLink ? ['token', 'type', 'redirect_to'] : ['token_hash', 'type', 'returnTo'];
  if ([...url.searchParams.keys()].some(key => !allowedKeys.includes(key)) ||
    [...url.searchParams.keys()].some(key => url.searchParams.getAll(key).length !== 1)) {
    throw new Error('Unexpected QA email action parameters');
  }
  const returnTo = url.searchParams.get('returnTo');
  if ((appLink || returnTo) && returnTo !== '/projects') throw new Error('Untrusted QA email return destination');
  return url.href;
}