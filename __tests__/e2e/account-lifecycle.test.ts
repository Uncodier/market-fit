/** @jest-environment node */
import { accountLifecyclePolicy, validateAccountLink } from '../../tests/support/account-lifecycle-policy';
import { accountMessageLink, mailboxSnapshot, waitForAccountEmail } from '../../tests/support/account-mailbox';
import preflight from '../../tests/support/preflight';

const now = Date.parse('2030-01-01T00:00:00Z');
const qa = 'qa-123456-abcd';
const run = `${qa}-account-lifecycle-abcd`;
const key = `header.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.signature`;
const env = {
  TEST_TARGET: 'local', TEST_SUITE: 'account-lifecycle', TEST_BASE_URL: 'http://127.0.0.1:3000',
  TEST_COMMERCE_BASE_URL: 'http://127.0.0.1:3000', TEST_SITE_ID: '11111111-1111-4111-8111-111111111111', TEST_SITE_NAME: 'QA',
  TEST_ALLOW_MUTATIONS: '1', TEST_DISPOSABLE_ENVIRONMENT: '1', TEST_ALLOW_ACCOUNT_LIFECYCLE: '1',
  QA_STATUS: 'VERIFIED', QA_ENVIRONMENT_ID: qa, SHIPLIGHT_RUN_ID: run,
  QA_EXPIRES_AT: '2030-01-01T01:00:00Z', TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
  TEST_SUPABASE_ANON_KEY: key, TEST_INBUCKET_URL: 'http://127.0.0.1:54324',
};
const policy = accountLifecyclePolicy(env, now);
function link(kind: 'signup' | 'recovery') {
  const url = new URL('/auth/v1/verify', policy.backend);
  url.search = new URLSearchParams({ token: 'synthetic-only-token', type: kind,
    redirect_to: `${policy.baseURL}/auth/${kind === 'signup' ? 'confirm' : 'reset-password'}?returnTo=%2Fprojects` }).toString();
  return url.href;
}
function message(kind: 'signup' | 'recovery') {
  return { header: { To: [policy.email] }, body: { html: `<a href="${link(kind).replace(/&/g, '&amp;')}">Continue</a>` } };
}

it('binds a new synthetic account to the exact disposable run', () => {
  expect(policy.email).toBe(`${run}@example.invalid`);
  expect(policy.backend).toBe(env.TEST_SUPABASE_URL);
});
it.each(['TEST_ALLOW_MUTATIONS', 'TEST_DISPOSABLE_ENVIRONMENT', 'TEST_ALLOW_ACCOUNT_LIFECYCLE', 'QA_STATUS', 'TEST_INBUCKET_URL'])(
  'rejects missing %s before creating an account', field => {
    expect(() => accountLifecyclePolicy({ ...env, [field]: '' }, now)).toThrow();
  },
);
it.each(['production', 'staging'])('forbids %s account mutations', target => {
  expect(() => accountLifecyclePolicy({ ...env, TEST_TARGET: target }, now)).toThrow();
});
it.each(['https://app.makinari.com', 'http://169.254.169.254', 'http://127.0.0.1:54324/messages', 'http://name:secret@localhost:54324'])(
  'rejects untrusted mailbox %s', mailbox => {
    expect(() => accountLifecyclePolicy({ ...env, TEST_INBUCKET_URL: mailbox }, now)).toThrow();
  },
);
it('rejects expired or inadequate lifetimes', () => {
  expect(() => accountLifecyclePolicy(env, Date.parse(env.QA_EXPIRES_AT))).toThrow();
  expect(() => accountLifecyclePolicy({ ...env, QA_EXPIRES_AT: 'not-a-date' }, now)).toThrow();
});
it('rejects privileged keys', () => {
  const service = `a.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.c`;
  expect(() => accountLifecyclePolicy({ ...env, TEST_SUPABASE_ANON_KEY: service }, now)).toThrow('public key');
});
it.each(['latest', 'discovery', `${qa}-other-abcd`, `${qa}-account-lifecycle-UPPER`])('rejects unsafe run %s', id => {
  expect(() => accountLifecyclePolicy({ ...env, SHIPLIGHT_RUN_ID: id }, now)).toThrow();
});
it('rejects reusing fixture identities', () => {
  expect(() => accountLifecyclePolicy({ ...env, TEST_ADMIN_EMAIL: policy.email }, now)).toThrow('reuse');
});
it.each(['signup', 'recovery'] as const)('accepts only the exact received %s action', kind => {
  expect(accountMessageLink(message(kind), kind, policy)).toBe(link(kind));
  expect(validateAccountLink(link(kind), kind, policy)).toBe(link(kind));
});
it('never uses another recipient or ambiguous actions', () => {
  expect(() => accountMessageLink({ ...message('signup'), header: { To: ['someone@example.invalid'] } }, 'signup', policy)).toThrow('recipient');
  expect(() => accountMessageLink({ header: { To: [policy.email] }, body: { text: `${link('signup')} ${link('signup').replace('synthetic-only-token', 'another-token')}` } }, 'signup', policy)).toThrow('Ambiguous');
});
it.each(['https://evil.invalid', 'https://app.makinari.com', 'http://169.254.169.254'])(
  'rejects action origin %s without fetching it', origin => {
    expect(() => validateAccountLink(link('signup').replace(policy.backend, origin), 'signup', policy)).toThrow();
  },
);
it('rejects wrong action and external redirect without leaking the token', () => {
  expect(() => validateAccountLink(link('recovery'), 'signup', policy)).toThrow('trusted origin/action');
  const external = new URL(link('signup'));
  external.searchParams.set('redirect_to', 'https://evil.invalid/auth/confirm?returnTo=/projects');
  expect(() => validateAccountLink(external.href, 'signup', policy)).toThrow('Untrusted');
});
it.each(['signup', 'recovery'] as const)('accepts the app-template %s link only with its fixed return destination', kind => {
  const url = `${policy.baseURL}/auth/confirm?token_hash=synthetic-only&type=${kind === 'signup' ? 'email' : 'recovery'}&returnTo=%2Fprojects`;
  expect(validateAccountLink(url, kind, policy)).toBe(url);
  expect(() => validateAccountLink(`${url}&redirect_to=https%3A%2F%2Fevil.invalid`, kind, policy)).toThrow();
  expect(() => validateAccountLink(`${url}&returnTo=%2Fbuyer`, kind, policy)).toThrow();
  expect(() => validateAccountLink(url.replace('&returnTo=%2Fprojects', ''), kind, policy)).toThrow();
});
it('ignores unrelated emails without inventing an action', () => {
  expect(accountMessageLink({ header: { To: [policy.email] }, body: { text: 'Welcome' } }, 'signup', policy)).toBeNull();
});
it('uses an empty browser suite without requiring seeded admin credentials', async () => {
  const original = process.env;
  process.env = { ...env, QA_EXPIRES_AT: new Date(Date.now() + 3_600_000).toISOString(), NODE_ENV: 'test' };
  try { await expect(preflight()).resolves.toBeUndefined(); }
  finally { process.env = original; }
});
it('reads only a new mailbox message, never latest or a preexisting token', async () => {
  const original = global.fetch;
  const fetcher = jest.fn().mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify([{ id: 'old' }, { id: 'new' }]) })
    .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify(message('recovery')) });
  global.fetch = fetcher;
  try {
    await expect(waitForAccountEmail(policy, 'recovery', new Set(['old']))).resolves.toBe(link('recovery'));
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      `${policy.mailbox}/api/v1/mailbox/${run}`, `${policy.mailbox}/api/v1/mailbox/${run}/new`,
    ]);
  } finally { global.fetch = original; }
});
it('sanitizes mailbox transport errors', async () => {
  const original = global.fetch;
  global.fetch = jest.fn().mockRejectedValue(new Error('synthetic-only-token'));
  try { await expect(mailboxSnapshot(policy)).rejects.toThrow('QA local mailbox read failed'); }
  finally { global.fetch = original; }
});
it('supports Supabase Mailpit only after a genuine Inbucket 404 and preserves exact recipient/action binding', async () => {
  const original = global.fetch;
  const alternate = { ...policy, mailbox: 'http://127.0.0.1:54325' };
  const fetcher = jest.fn().mockResolvedValueOnce({ status: 404, ok: false })
    .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ messages_count: 1,
      messages: [{ ID: 'mailpit-new', To: [{ Address: policy.email }] }] }) })
    .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({
      To: [{ Address: policy.email }], HTML: message('recovery').body.html,
    }) });
  global.fetch = fetcher;
  try {
    await expect(waitForAccountEmail(alternate, 'recovery', new Set())).resolves.toBe(link('recovery'));
    const url = new URL(fetcher.mock.calls[1][0]);
    expect(url.pathname).toBe('/api/v1/search');
    expect(url.searchParams.get('query')).toBe(`to:${policy.email}`);
    expect(fetcher.mock.calls[2][0]).toBe(`${alternate.mailbox}/api/v1/message/mailpit-new`);
  } finally { global.fetch = original; }
});
it('never falls back on mailbox auth failures or uses an unscoped Mailpit search result', async () => {
  const original = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ status: 403, ok: false });
  try { await expect(mailboxSnapshot({ ...policy, mailbox: 'http://127.0.0.1:54326' })).rejects.toThrow('QA local mailbox read failed'); }
  finally { global.fetch = original; }
  global.fetch = jest.fn().mockResolvedValueOnce({ status: 404, ok: false })
    .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ messages_count: 1,
      messages: [{ ID: 'foreign', To: [{ Address: 'foreign@example.invalid' }] }] }) });
  try { await expect(mailboxSnapshot({ ...policy, mailbox: 'http://127.0.0.1:54327' })).rejects.toThrow('unscoped'); }
  finally { global.fetch = original; }
});