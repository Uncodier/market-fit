/** @jest-environment node */
import { readEnvironment, assertDisposable, storageStatePath, validateOrigin } from '../../tests/support/environment';

const env = {
  TEST_TARGET: 'local', TEST_SUITE: 'smoke',
  TEST_BASE_URL: 'http://localhost:3000', TEST_COMMERCE_BASE_URL: 'http://localhost:3000',
  TEST_SITE_ID: '11111111-1111-4111-8111-111111111111', TEST_SITE_NAME: 'Dedicated E2E',
};

describe('fail-closed E2E environment policy', () => {
  it('does not infer a live target from application dotenv configuration', () => {
    expect(() => readEnvironment({ TEST_BASE_URL: 'https://app.makinari.com' })).toThrow('TEST_TARGET');
  });
  it.each(['TEST_BASE_URL', 'TEST_COMMERCE_BASE_URL', 'TEST_SITE_ID', 'TEST_SITE_NAME'])('requires %s', name => {
    expect(() => readEnvironment({ ...env, [name]: '' })).toThrow(name);
  });
  it('allows a configured read-only local suite without mutation consent', () => {
    expect(readEnvironment(env).suite).toBe('smoke');
  });
  it.each(['regression', 'roles'])('requires disposable consent for %s', suite => {
    expect(() => readEnvironment({ ...env, TEST_SUITE: suite })).toThrow('TEST_ALLOW_MUTATIONS');
    expect(readEnvironment({ ...env, TEST_SUITE: suite, TEST_ALLOW_MUTATIONS: '1', TEST_DISPOSABLE_ENVIRONMENT: '1' }).suite).toBe(suite);
  });
  it('cannot authorize production mutations with an environment switch', () => {
    const production = { ...env, TEST_TARGET: 'production', TEST_BASE_URL: 'https://app.makinari.com', TEST_COMMERCE_BASE_URL: 'https://www.makinari.com', TEST_SUITE: 'regression', TEST_ALLOW_MUTATIONS: '1', TEST_DISPOSABLE_ENVIRONMENT: '1' };
    expect(() => readEnvironment(production)).toThrow('forbidden in production');
    expect(() => readEnvironment({ ...production, TEST_TARGET: 'staging' })).toThrow('Staging must not');
    expect(() => readEnvironment({ ...production, TEST_TARGET: 'local' })).toThrow('loopback');
  });
  it('rejects demo sites and unknown suites', () => {
    expect(() => readEnvironment({ ...env, TEST_SITE_ID: 'demo-e2e' })).toThrow('UUID');
    expect(() => readEnvironment({ ...env, TEST_SUITE: 'all' })).toThrow('Invalid TEST_SUITE');
  });
  it('does not conflate production app and commerce host coverage', () => {
    expect(() => readEnvironment({ ...env, TEST_TARGET: 'production', TEST_BASE_URL: 'https://app.makinari.com', TEST_COMMERCE_BASE_URL: 'https://app.makinari.com' })).toThrow('separate hosts');
  });
  it.each(['https://user:secret@preview.example.com', 'https://preview.example.com/path', 'https://preview.example.com?token=secret', 'http://preview.example.com', 'https://preview.example.com:444', 'https://app.makinari.com.', 'https://www.makinari.com.'])('rejects unsafe origin %s', value => {
    expect(() => validateOrigin(value, 'staging')).toThrow();
  });
  it('guards standalone mutation helpers as well as the Playwright config', () => {
    expect(() => assertDisposable({ ...env, TEST_TARGET: 'production' })).toThrow();
  });
  it('namespaces auth by run, environment and identity and rejects traversal', () => {
    expect(storageStatePath('buyer', { TEST_TARGET: 'staging', SHIPLIGHT_RUN_ID: 'run-123' })).toBe('.auth/staging/run-123/buyer.json');
    expect(() => storageStatePath('../admin', env)).toThrow();
  });
});