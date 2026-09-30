export type TestTarget = 'local' | 'staging' | 'production';
export type TestSuite = 'smoke' | 'regression' | 'buyer' | 'roles';
export type TestEnvironment = {
  target: TestTarget;
  suite: TestSuite;
  baseURL: string;
  commerceBaseURL: string;
  siteId: string;
  siteName: string;
};

const productionHosts = new Set(['app.makinari.com', 'www.makinari.com', 'makinari.com']);
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required; refusing an unspecified E2E target or fixture`);
  return value;
}

export function requiredUuid(env: Record<string, string | undefined>, name: string): string {
  const value = required(env, name);
  if (!uuid.test(value)) throw new Error(`${name} must be a real fixture UUID, never a demo ID`);
  return value;
}

export function validateOrigin(value: string, target: TestTarget): string {
  const url = new URL(value);
  if (url.hostname.endsWith('.')) throw new Error('E2E hosts must use canonical DNS names without a trailing dot');
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('E2E origins must not contain credentials, paths, queries or fragments');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('E2E origins require HTTP(S)');
  if (target === 'local' && !localHosts.has(url.hostname)) {
    throw new Error('Local E2E runs may only target loopback hosts');
  }
  if (target !== 'local' && (url.protocol !== 'https:' || (url.port && url.port !== '443'))) {
    throw new Error('Remote E2E runs require HTTPS on the standard port');
  }
  if (target === 'production' && !productionHosts.has(url.hostname)) {
    throw new Error('Production E2E runs require an explicitly supported Makinari production host');
  }
  if (target === 'staging' && (productionHosts.has(url.hostname) || localHosts.has(url.hostname))) {
    throw new Error('Staging must not point at production or loopback');
  }
  return url.origin;
}

export function readEnvironment(env: Record<string, string | undefined> = process.env): TestEnvironment {
  const target = required(env, 'TEST_TARGET') as TestTarget;
  const suite = (env.TEST_SUITE || 'smoke') as TestSuite;
  if (!['local', 'staging', 'production'].includes(target)) throw new Error('Invalid TEST_TARGET');
  if (!['smoke', 'regression', 'buyer', 'roles'].includes(suite)) throw new Error('Invalid TEST_SUITE');
  const baseURL = validateOrigin(required(env, 'TEST_BASE_URL'), target);
  const commerceBaseURL = validateOrigin(required(env, 'TEST_COMMERCE_BASE_URL'), target);
  if (target === 'production' && (baseURL !== 'https://app.makinari.com' || commerceBaseURL === baseURL)) {
    throw new Error('Production must exercise app and commerce as separate hosts');
  }
  if (suite === 'regression' || suite === 'roles') assertDisposable(env, target);
  const siteId = requiredUuid(env, 'TEST_SITE_ID');
  const siteName = required(env, 'TEST_SITE_NAME');
  if (env.TEST_WORKERS && env.TEST_WORKERS !== '1') {
    throw new Error('Shared workspace suites require TEST_WORKERS=1');
  }
  return { target, suite, baseURL, commerceBaseURL, siteId, siteName };
}

export function assertDisposable(env: Record<string, string | undefined> = process.env, target = env.TEST_TARGET): void {
  if (!['local', 'staging'].includes(target || '')) {
    throw new Error('Mutating E2E and agent workflows are forbidden in production');
  }
  if (env.TEST_ALLOW_MUTATIONS !== '1' || env.TEST_DISPOSABLE_ENVIRONMENT !== '1') {
    throw new Error('Mutating tests require TEST_ALLOW_MUTATIONS=1 and TEST_DISPOSABLE_ENVIRONMENT=1');
  }
  validateOrigin(required(env, 'TEST_BASE_URL'), target as TestTarget);
  validateOrigin(required(env, 'TEST_COMMERCE_BASE_URL'), target as TestTarget);
}

export function storageStatePath(role: string, env: Record<string, string | undefined> = process.env): string {
  const target = env.TEST_TARGET || 'unconfigured';
  const runId = env.SHIPLIGHT_RUN_ID || 'discovery';
  if (![target, runId, role].every(value => /^[a-zA-Z0-9_-]+$/.test(value))) {
    throw new Error('Invalid auth state namespace');
  }
  return `.auth/${target}/${runId}/${role}.json`;
}