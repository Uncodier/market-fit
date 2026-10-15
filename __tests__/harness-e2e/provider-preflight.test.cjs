const { randomBytes } = require('node:crypto');
const { probeSandboxAccess } = require('../../scripts/harness-e2e/provider-preflight.cjs');
const { preflight } = require('../../scripts/harness-e2e/run.cjs');
const settings = () => ({ credentials: { token: randomBytes(32).toString('hex'), teamId: 'team', projectId: 'project' } });

it('does not infer project scope or start the SDK with missing credentials', async () => {
  const list = jest.fn();
  expect(await probeSandboxAccess({ credentials: {} }, { Sandbox: { list } })).toMatchObject({ ready: false, code: 'SANDBOX_CONFIGURATION_MISSING' });
  expect(list).not.toHaveBeenCalled();
});
it.each([401, 402, 403])('marks configured but denied credentials HTTP %s as unavailable without leaking secrets', async status => {
  const config = settings();
  const list = jest.fn().mockRejectedValue({ response: { statusCode: status }, message: config.credentials.token });
  const result = await probeSandboxAccess(config, { Sandbox: { list } });
  expect(result).toEqual({ ready: false, code: 'SANDBOX_ACCESS_UNAVAILABLE', httpStatus: status });
  expect(JSON.stringify(result)).not.toContain(config.credentials.token); expect(list).toHaveBeenCalledTimes(1);
});
it('authorizes only one filtered list page, not workspace creation/resume or unrelated enumeration', async () => {
  const list = jest.fn(async () => ({ sandboxes: [] }));
  expect((await probeSandboxAccess(settings(), { Sandbox: { list } })).ready).toBe(true);
  expect(list).toHaveBeenCalledWith(expect.objectContaining({ limit: 1, tags: { harnessE2ePreflight: expect.any(String) }, signal: expect.any(AbortSignal) }));
});
it('does not treat malformed successful responses as valid access', async () => {
  expect((await probeSandboxAccess(settings(), { Sandbox: { list: async () => ({}) } })).ready).toBe(false);
});
it('rejects provider writes and redirects before sending any request', async () => {
  const request = jest.fn();
  const list = async input => { await input.fetch('https://api.vercel.com/v1/projects', { method: 'POST' }); };
  expect((await probeSandboxAccess(settings(), { Sandbox: { list }, fetch: request })).ready).toBe(false);
  expect(request).not.toHaveBeenCalled();
});
it('uses the installed SDK sandbox endpoint rather than assuming the deployment API host', async () => {
  const request = jest.fn(async () => ({ ok: true }));
  const list = async input => { await input.fetch('https://vercel.com/api/v2/sandboxes', { method: 'GET' }); return { sandboxes: [] }; };
  expect((await probeSandboxAccess(settings(), { Sandbox: { list }, fetch: request })).ready).toBe(true);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith('https://vercel.com/api/v2/sandboxes', expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }));
});
it('preflight blocks live fixtures on denied sandbox access even with ample funding', async () => {
  const q = { select: () => q, eq: () => q, limit: async () => ({ data: [] }), maybeSingle: async () => ({ data: { credits_available: 5 } }) };
  const result = await preflight(settings(), { client: { from: () => q }, observer: { from: () => q } }, {
    probeSandboxAccess: async () => ({ ready: false, code: 'SANDBOX_ACCESS_UNAVAILABLE', httpStatus: 403 }),
  });
  expect(result.checks.sandboxCredentials).toBe(true); expect(result.checks.sandboxAccess).toBe(false);
  expect(result.passed).toBe(false); expect(result.blockers).toEqual(['sandboxAccess']);
});