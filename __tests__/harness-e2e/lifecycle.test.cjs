const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { cases, MARKER } = require('../../scripts/harness-e2e/cases.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-canary-unit-'));
const settings = { url: 'https://exampleproject.supabase.co', siteId: randomUUID(), deployedSha: null,
  apiRoot: directory, credentials: { token: randomUUID(), projectId: 'project', teamId: 'team' }, redact: () => 'sanitized failure' };
const identity = { userId: randomUUID() };
const rows = { funded: true };
const q = { select: () => q, eq: () => q, limit: async () => ({ data: [] }),
  maybeSingle: async () => ({ data: { credits_available: rows.funded ? 10 : 0 } }) };
const connection = { ...identity, client: { from: () => q }, observer: { from: () => q } };
const p = { dir: directory, manifest: path.join(directory, 'run.json'), report: path.join(directory, 'report.json'), observations: path.join(directory, 'observations.json') };
const release = jest.fn();
jest.mock('../../scripts/harness-e2e/provider-preflight.cjs', () => ({ probeSandboxAccess: async () => ({ ready: true, code: 'SANDBOX_READ_AUTHORIZED', httpStatus: 200 }) }));
jest.mock('../../scripts/harness-e2e/host.cjs', () => ({ root: directory,
  config: () => settings, connect: async () => connection, paths: () => p, lock: () => release,
  assertRun: () => {}, fileReader: () => async () => ({}),
  write: (file, value) => fs.writeFileSync(file, JSON.stringify(value)) }));
const transition = jest.fn(async () => {});
jest.mock('../../scripts/harness-e2e/fixtures.cjs', () => ({ ...jest.requireActual('../../scripts/harness-e2e/fixtures.cjs'), transition }));
const sample = jest.fn(); const evaluate = jest.fn();
jest.mock('../../scripts/harness-e2e/observe.cjs', () => ({ observeCase: (...args) => sample(...args) }));
jest.mock('../../scripts/harness-e2e/evaluate.cjs', () => ({ evaluateCase: (...args) => evaluate(...args),
  summarize: (run, results) => ({ runId: run.id, healthGreen: results.every(r => r.state === 'passed'), cases: results }) }));
const { main, stop } = require('../../scripts/harness-e2e/run.cjs');
let run;
beforeEach(() => {
  jest.clearAllMocks(); rows.funded = true; process.exitCode = undefined;
  for (const file of [p.manifest, p.report, p.observations]) if (fs.existsSync(file)) fs.unlinkSync(file);
  run = { id: 'canary-lifecycle-offline', marker: MARKER, ...identity, siteId: settings.siteId, backend: settings.url,
    repository: { url: 'https://github.com/example/canary.git', org: 'example', repo: 'canary', kind: 'custom', default_branch: 'main' },
    cases: cases('canary-lifecycle-offline'), state: 'ready', maxCredits: 2, maxSeconds: 1500 };
  fs.writeFileSync(p.manifest, JSON.stringify(run));
  sample.mockResolvedValue({ observedAt: new Date().toISOString(), errors: [], credits: 0.01, session: { id: randomUUID() } });
  evaluate.mockImplementation(spec => ({ id: spec.id, state: 'passed', checks: [] }));
  transition.mockResolvedValue(undefined);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); process.exitCode = undefined; });
afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));
const args = mode => [mode, '--run-id', run.id, '--site-id', settings.siteId, '--ack-production-canary', '--ack-observer-service-role'];

it('activates exactly five sequential fixtures and persists final report; no implicit retry', async () => {
  await main(args('run'));
  expect(transition.mock.calls.map(call => [call[1].id, call[3]])).toEqual(run.cases.map(c => [c.id, 'backlog']));
  expect(JSON.parse(fs.readFileSync(p.manifest)).state).toBe('finished'); expect(release).toHaveBeenCalled();
  await expect(main(args('run'))).rejects.toThrow('Only a prepared run');
  expect(transition).toHaveBeenCalledTimes(5);
});
it('first failure stops the active fixture and never activates the remaining four', async () => {
  evaluate.mockImplementation(spec => ({ id: spec.id, state: 'failed', checks: [] }));
  await expect(main(args('run'))).rejects.toThrow();
  expect(transition.mock.calls.map(call => call[3])).toEqual(['backlog', 'blocked']);
  expect(JSON.parse(fs.readFileSync(p.report))).toMatchObject({ healthGreen: false, stopConfirmed: true });
});
it('read-only observer writes a report without activating or stopping any requirement', async () => {
  run.cases[0].activatedAt = new Date().toISOString(); fs.writeFileSync(p.manifest, JSON.stringify(run));
  await main(['observe', '--run-id', run.id, '--ack-observer-service-role']);
  expect(sample).toHaveBeenCalledTimes(1); expect(transition).not.toHaveBeenCalled();
});
it('unavailable credits or the watchdog threshold stop rather than continue blind', async () => {
  sample.mockResolvedValue({ errors: [], credits: null, session: { id: 'session' } });
  evaluate.mockImplementation(spec => ({ id: spec.id, state: 'pending', checks: [] }));
  await expect(main(args('run'))).rejects.toThrow();
  expect(transition.mock.calls.map(call => call[3])).toEqual(['backlog', 'blocked']);
});
it('stop attempts all activated fixtures even if one stop request fails', async () => {
  run.cases.forEach(spec => { spec.activatedAt = new Date().toISOString(); });
  transition.mockRejectedValueOnce(new Error('unavailable'));
  await expect(stop(run, connection.client)).rejects.toThrow(); expect(transition).toHaveBeenCalledTimes(5);
});
it('diagnostic observation always stays non-green even when all mocked behavior checks pass', async () => {
  run.diagnosticNoFiles = true;
  run.cases.forEach(spec => { spec.activatedAt = new Date().toISOString(); });
  fs.writeFileSync(p.manifest, JSON.stringify(run));
  evaluate.mockImplementation(spec => ({ id: spec.id, state: 'passed', checks: [{ name: 'terminal_completed', passed: true }] }));
  await main(['observe', '--run-id', run.id, '--ack-observer-service-role']);
  const report = JSON.parse(fs.readFileSync(p.report));
  expect(report).toMatchObject({ mode: 'diagnostic-no-files', healthGreen: false, behaviorPassed: false, independentFileVerification: 'unavailable' });
  expect(report.diagnosticCompletedCases).toHaveLength(5);
  expect(sample.mock.calls.every(call => call[2].readFiles === undefined)).toBe(true);
  expect(transition).not.toHaveBeenCalled();
});