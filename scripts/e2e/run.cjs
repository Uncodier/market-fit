const c = require('./common.cjs');

function sources(suite) {
  if (suite === 'smoke' || suite === 'roles') return [];
  return c.fs.readdirSync(c.path.join(c.root, 'tests')).filter(file => file.endsWith('.test.yaml') &&
    (suite === 'buyer' ? file === 'buyer-navigation.test.yaml' : !['example.test.yaml', 'buyer-navigation.test.yaml'].includes(file)))
    .sort().map(file => `tests/${file}`);
}
function discover(env, grep) {
  const result = c.command(c.playwright, ['test', '--list', '--reporter=json', ...(grep ? ['--grep', grep] : [])], env, true);
  if (result.status !== 0) throw new Error('Playwright discovery failed; inspect local configuration and source tests');
  // The JSON reporter is the contract; do not infer counts from filenames or human output.
  let report;
  try { report = JSON.parse(result.stdout.slice(result.stdout.indexOf('{'))); }
  catch { throw new Error('Playwright discovery did not produce valid JSON'); }
  if (report.errors?.length) throw new Error('Playwright discovery contained errors');
  return c.model.cases(report);
}
function main() {
  const options = c.parseArgs(process.argv.slice(2));
  const id = c.runId(process.env.SHIPLIGHT_RUN_ID || `run-${Date.now()}-${c.crypto.randomUUID()}`);
  const p = c.paths(id);
  if (c.fs.existsSync(p.dir)) throw new Error('Run directory already exists; choose a new SHIPLIGHT_RUN_ID');
  c.fs.mkdirSync(p.dir, { recursive: true });
  const env = { ...process.env, TEST_SUITE: options.suite, SHIPLIGHT_RUN_ID: id, SHIPLIGHT_REPORT_DIR: p.dir,
    SHIPLIGHT_REPORT_TO_CLOUD: '0', REPORT_TO_CLOUD: '0', SHIPLIGHT_OFFLINE: '1', SHIPLIGHT_TELEMETRY: '0', DO_NOT_TRACK: '1', PWDEBUG: '0', npm_config_offline: 'true' };
  if (options.target) env.TEST_TARGET = options.target;
  delete env.JEST_WORKER_ID;
  delete env.PLAYWRIGHT_JSON_OUTPUT_FILE;
  const manifest = {
    schemaVersion: 1, runId: id, mode: options.list ? 'list' : options.validate ? 'validate' : 'run',
    target: options.target || 'unconfigured', suite: options.suite, filter: options.grep,
    baseURL: null, commerceBaseURL: null, startedAt: new Date().toISOString(),
    repository: process.env.GITHUB_REPOSITORY || c.git('config', '--get', 'remote.origin.url')?.replace(/\/\/[^/]*@/, '//') || null,
    branch: c.git('branch', '--show-current') || process.env.TEST_SOURCE_BRANCH || process.env.GITHUB_REF_NAME || null,
    testSha: c.git('rev-parse', 'HEAD'), dirty: !!c.git('status', '--porcelain'),
    deployedSha: /^[a-f0-9]{40}$/i.test(process.env.TEST_DEPLOYED_SHA || '') ? process.env.TEST_DEPLOYED_SHA : null,
    expected: [], selected: [], selectedSetup: [],
    cloudLimitation: 'Installed CLI publishes local-runs; no supported target/deployed-SHA metadata override. Trigger is labeled; this manifest is authoritative.',
  };
  c.write(p.manifest, manifest);
  const index = c.path.join(c.root, 'shiplight-report', `health-${manifest.target}-${manifest.suite}.json`);
  const previous = c.fs.existsSync(index) ? c.read(index) : {};
  // Persist a non-green attempt before any work: termination must not leave an old green as current.
  c.write(p.summary, { runId: id, mode: manifest.mode, target: manifest.target, suite: manifest.suite,
    state: 'in-progress', healthGreen: false, complete: false, cloud: { status: 'not-attempted' } });
  if (manifest.mode === 'run') c.write(index, {
    lastAttempted: { runId: id, at: manifest.startedAt, state: 'in-progress', healthGreen: false },
    lastComplete: previous.lastComplete || null,
  });
  let exitCode = 1;
  let failure = null;
  let report = null;
  try {
    const yaml = sources(options.suite);
    if (yaml.length) {
      const glob = yaml.length === 1 ? yaml[0] : `tests/{${yaml.map(file => c.path.basename(file)).join(',')}}`;
      if (c.command(c.cli, ['transpile', glob, '--strict'], env).status !== 0) throw new Error('Strict transpilation failed');
    }
    const expected = discover(env);
    const selected = options.grep ? discover(env, options.grep) : expected;
    manifest.expected = expected.filter(item => !item.setup).map(item => item.key);
    manifest.selected = selected.filter(item => !item.setup).map(item => item.key);
    manifest.selectedSetup = selected.filter(item => item.setup).map(item => item.key);
    if (!manifest.expected.length || !manifest.selected.length) throw new Error('Suite selection is empty');
    c.write(p.manifest, manifest);
    console.log(`Run ${id}: ${manifest.selected.length}/${manifest.expected.length} ${options.suite} tests (${manifest.mode})`);
    if (manifest.mode !== 'run') { exitCode = 0; return; }
    const target = require('../../tests/support/environment.ts').readEnvironment(env);
    manifest.baseURL = target.baseURL;
    manifest.commerceBaseURL = target.commerceBaseURL;
    c.write(p.manifest, manifest);
    env.PLAYWRIGHT_JSON_OUTPUT_FILE = p.json;
    // YAML is already strictly transpiled. Avoid the vendor test wrapper's CI
    // action-cache upload, which is independent of REPORT_TO_CLOUD and --offline.
    const result = c.command(c.playwright, ['test', ...(options.grep ? ['--grep', options.grep] : []), ...(options.headed ? ['--headed'] : [])], env);
    exitCode = result.status ?? 1;
    if (c.fs.existsSync(p.json)) report = c.read(p.json);
  } catch (error) {
    failure = error.message;
    console.error(failure);
  } finally {
    const summary = { ...c.model.summarize(manifest.expected, manifest.selected, report, exitCode, !!options.grep, manifest.selectedSetup),
      runId: id, mode: manifest.mode, target: manifest.target, suite: manifest.suite,
      startedAt: manifest.startedAt, endedAt: new Date().toISOString(), exitCode, failure,
      state: failure || !report ? (manifest.mode === 'run' ? 'blocked' : 'discovery') : 'finished',
      provenanceComplete: !!manifest.testSha && !manifest.dirty && (manifest.target === 'local' || !!manifest.deployedSha),
      vendorReportSha256: c.fs.existsSync(p.vendor) ? c.digest(p.vendor) : null,
      cloud: { status: 'not-attempted' },
    };
    summary.healthGreen = summary.healthGreen && summary.provenanceComplete;
    c.write(p.summary, summary);
    if (manifest.mode === 'run') {
      c.write(index, { lastAttempted: { runId: id, at: summary.endedAt, healthGreen: summary.healthGreen },
        lastComplete: summary.complete && summary.scope === 'full' ? { runId: id, at: summary.endedAt, healthGreen: summary.healthGreen } : previous.lastComplete || null });
      // A partial/blocked/flaky pass is not a successful suite health check.
      if (!summary.healthGreen) exitCode = exitCode || 1;
    }
    console.log(`Machine-readable summary: ${p.summary}`);
    process.exitCode = exitCode;
  }
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { sources, discover };