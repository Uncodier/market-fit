const { createHash } = require('node:crypto');

function required(env, key) {
  const value = env[key];
  if (typeof value !== 'string' || !value || value !== value.trim()) throw new Error(`${key} is required without surrounding whitespace`);
  return value;
}

function localOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid local origin'); }
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || (value !== url.origin && value !== `${url.origin}/`)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Only canonical loopback HTTP(S) origins are allowed');
  }
  return url.origin;
}

function keyRole(key) {
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { return null; }
}

function configuration(env, now = Date.now()) {
  if (env.TEST_TARGET !== 'local') throw new Error('QA provisioning requires TEST_TARGET=local');
  const id = required(env, 'QA_ENVIRONMENT_ID');
  if (!/^qa-[a-z0-9][a-z0-9-]{0,59}$/.test(id)) throw new Error('QA_ENVIRONMENT_ID must be a safe qa-* identifier');
  const expiresAt = required(env, 'QA_EXPIRES_AT');
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(expiresAt)
    || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now) throw new Error('QA_EXPIRES_AT must be a future UTC timestamp');
  const url = localOrigin(required(env, 'TEST_SUPABASE_URL'));
  if (localOrigin(required(env, 'NEXT_PUBLIC_SUPABASE_URL')) !== url) throw new Error('Supabase backend origins must match exactly');
  const baseURL = localOrigin(required(env, 'TEST_BASE_URL'));
  const commerceURL = localOrigin(required(env, 'TEST_COMMERCE_BASE_URL'));
  const publicKey = required(env, 'TEST_SUPABASE_ANON_KEY');
  const setupKey = required(env, 'QA_SUPABASE_SERVICE_ROLE_KEY');
  if (!(keyRole(publicKey) === 'anon' || /^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey))) throw new Error('Verification requires a public anon/publishable key');
  if (!(keyRole(setupKey) === 'service_role' || /^sb_secret_[A-Za-z0-9_-]+$/.test(setupKey)) || setupKey === publicKey) throw new Error('Setup requires a separate privileged local key');
  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== publicKey) throw new Error('Application and verification public keys must match');
  return { id, expiresAt, url, baseURL, commerceURL, publicKey, setupKey };
}

function authorizeApply(env) {
  if (env.TEST_ALLOW_MUTATIONS !== '1' || env.TEST_DISPOSABLE_ENVIRONMENT !== '1') {
    throw new Error('Apply requires TEST_ALLOW_MUTATIONS=1 and TEST_DISPOSABLE_ENVIRONMENT=1');
  }
}

function options(args) {
  if (args.length > 1 || args.some(arg => !['--plan', '--apply'].includes(arg))) throw new Error('Usage: provision-qa.cjs [--plan|--apply]');
  return { apply: args[0] === '--apply' };
}

function fixtureId(environmentId, kind) {
  const h = createHash('sha256').update(`market-fit-qa-v1:${environmentId}:${kind}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// Supabase redirects must never move privileged requests off the pinned local origin.
function localFetch(origin, fetchImpl = globalThis.fetch) {
  return (input, init = {}) => {
    const value = typeof input === 'string' || input instanceof URL ? input : input.url;
    if (new URL(value).origin !== origin) throw new Error('Off-origin Supabase request refused');
    return fetchImpl(input, { ...init, redirect: 'error' });
  };
}

module.exports = { required, localOrigin, configuration, authorizeApply, options, fixtureId, localFetch };