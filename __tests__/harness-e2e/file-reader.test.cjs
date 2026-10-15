const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { Readable } = require('node:stream');
const sdk = { get: jest.fn() };
jest.mock('node:module', () => ({ ...jest.requireActual('node:module'), createRequire: () => () => ({ Sandbox: sdk }) }));
const { fileReader } = require('../../scripts/harness-e2e/host.cjs');
const settings = () => ({ apiRoot: '/offline/API', credentials: { token: randomBytes(20).toString('hex'), teamId: 'team', projectId: 'project' } });
const session = () => ({ id: randomUUID(), workspace: { id: 'owned-vm', root: '/vercel/sandbox' } });
const file = '.harness-e2e/canary-offline/hello.txt';
beforeEach(() => jest.resetAllMocks());
it('reads only the fixed canary paths and retains hashes, not potentially secret file content', async () => {
  const s = session(), secret = randomBytes(20).toString('hex'), config = settings();
  const readFile = jest.fn(async () => Readable.from([secret]));
  sdk.get.mockResolvedValue({ status: 'running', tags: { harnessSession: s.id }, readFile });
  const result = await fileReader(config)(s, { files: { [file]: 'expected', '.env': 'blocked' } });
  expect(result[file]).toEqual({ state: 'read', bytes: secret.length, sha256: createHash('sha256').update(secret).digest('hex') });
  expect(JSON.stringify(result)).not.toContain(secret); expect(JSON.stringify(result)).not.toContain(config.credentials.token);
  expect(readFile).toHaveBeenCalledTimes(1); expect(sdk.get).toHaveBeenCalledWith(expect.objectContaining({ resume: false }));
});
it.each(['stopped', 'foreign'])('does not resume or read a %s sandbox', async state => {
  const s = session(), readFile = jest.fn(); sdk.get.mockResolvedValue({ status: state === 'stopped' ? 'stopped' : 'running', tags: { harnessSession: state === 'foreign' ? randomUUID() : s.id }, readFile });
  expect((await fileReader(settings())(s, { files: { [file]: 'x' } }))[file].state).toBe('unavailable'); expect(readFile).not.toHaveBeenCalled();
});
it('does not invoke SDK scope inference when project credentials are incomplete', async () => {
  await fileReader({ ...settings(), credentials: {} })(session(), { files: { [file]: 'x' } }); expect(sdk.get).not.toHaveBeenCalled();
});
it('caps file reads and fails closed rather than hashing truncated content as success', async () => {
  const s = session(); sdk.get.mockResolvedValue({ status: 'running', tags: { harnessSession: s.id }, readFile: async () => Readable.from(['x'.repeat(8193)]) });
  expect((await fileReader(settings())(s, { files: { [file]: 'x' } }))[file].state).toBe('unavailable');
});