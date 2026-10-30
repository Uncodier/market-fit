const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { cases, MARKER } = require('../../scripts/harness-e2e/cases.cjs');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-budget-unit-'));
const settings = {
  url: 'https://backend.example.test', siteId: randomUUID(), deployedSha: null,
  apiRoot: directory,
  credentials: { token: randomUUID(), projectId: randomUUID(), teamId: randomUUID() },
  redact: () => 'sanitized failure',
};
const query = {
  select: () => query, eq: () => query,
  limit: async () => ({ data: [] }),
  maybeSingle: async () => ({ data: { credits_available: 10 } }),
};
const connection = { userId: randomUUID(), client: { from: () => query }, observer: { from: () => query } };
const p = {
  dir: directory, manifest: path.join(directory, 'run.json'),
  report: path.join(directory, 'report.json'), observations: path.join(directory, 'observations.json'),
};
const release = jest.fn();
const write = jest.fn((file, value) => fs.writeFileSync(file, JSON.stringify(value)));
const probe = jest.fn();
const transition = jest.fn();
const sample = jest.fn();

jest.mock('../../scripts/harness-e2e/host.cjs', () => ({
  root: directory, config: () => settings, connect: async () => connection,
  paths: () => p, lock: () => release, assertRun: () => {},
  fileReader: () => async () => ({}), write,
}));
jest.mock('../../scripts/harness-e2e/provider-preflight.cjs', () => ({
  probeSandboxAccess: (...args) => probe(...args),
}));
jest.mock('../../scripts/harness-e2e/fixtures.cjs', () => ({
  ...jest.requireActual('../../scripts/harness-e2e/fixtures.cjs'), transition,
}));
jest.mock('../../scripts/harness-e2e/observe.cjs', () => ({
  observeCase: (...args) => sample(...args),
}));
jest.mock('../../scripts/harness-e2e/evaluate.cjs', () => ({
  evaluateCase: spec => ({ id: spec.id, state: 'passed', checks: [] }),
  summarize: (run, results) => ({ runId: run.id, healthGreen: results.every(result => result.state === 'passed'), cases: results }),
}));
const { main } = require('../../scripts/harness-e2e/run.cjs');
let run;
let previousExitCode;

beforeEach(() => {
  jest.clearAllMocks();
  previousExitCode = process.exitCode;
  process.exitCode = undefined;
  for (const file of [p.manifest, p.report, p.observations]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  run = {
    id: 'canary-budget-offline', marker: MARKER, userId: connection.userId,
    siteId: settings.siteId, backend: settings.url,
    repository: { url: 'https://github.com/example/canary.git', org: 'example', repo: 'canary', kind: 'custom', default_branch: 'main' },
    cases: cases('canary-budget-offline'), state: 'ready', maxCredits: 6, maxSeconds: 1500,
  };
  fs.writeFileSync(p.manifest, JSON.stringify(run));
  probe.mockResolvedValue({ ready: true, code: 'SANDBOX_READ_AUTHORIZED', httpStatus: 200 });
  transition.mockResolvedValue(undefined);
  sample.mockResolvedValue({ observedAt: new Date().toISOString(), errors: [], credits: 0.01, session: { id: randomUUID() } });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); process.exitCode = previousExitCode; });
afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));

it.each([
  ['absent', []],
  ['mismatching', ['--max-credits', '5']],
])('rejects %s elevated budget acknowledgement without activation, then permits a correct retry', async (_label, budgetArgs) => {
  const args = ['run', '--run-id', run.id, '--site-id', settings.siteId,
    '--ack-production-canary', '--ack-observer-service-role'];
  const preparedManifest = fs.readFileSync(p.manifest, 'utf8');

  await expect(main([...args, ...budgetArgs])).rejects.toThrow('Activation requires explicit acknowledgement of the prepared credit limit');
  expect(transition).not.toHaveBeenCalled();
  expect(sample).not.toHaveBeenCalled();
  expect(probe).not.toHaveBeenCalled();
  expect(write.mock.calls.filter(([file]) => file === p.manifest)).toEqual([]);
  expect(fs.readFileSync(p.manifest, 'utf8')).toBe(preparedManifest);
  expect(JSON.parse(preparedManifest)).toMatchObject({ state: 'ready', maxCredits: 6 });
  expect(JSON.parse(fs.readFileSync(p.report, 'utf8'))).toMatchObject({ state: 'blocked', healthGreen: false, stopConfirmed: null });
  expect(release).toHaveBeenCalledTimes(1);

  await expect(main([...args, '--max-credits', '6'])).resolves.toBeUndefined();
  expect(probe).toHaveBeenCalledTimes(1);
  expect(transition.mock.calls.map(call => [call[1].id, call[3]])).toEqual(run.cases.map(spec => [spec.id, 'backlog']));
  const finished = JSON.parse(fs.readFileSync(p.manifest, 'utf8'));
  expect(finished).toMatchObject({ state: 'finished', maxCredits: 6 });
  expect(finished.cases.every(spec => !!spec.activatedAt)).toBe(true);
  expect(JSON.parse(fs.readFileSync(p.report, 'utf8'))).toMatchObject({ healthGreen: true });
  expect(release).toHaveBeenCalledTimes(2);
});