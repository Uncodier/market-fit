const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const host = require('./host.cjs');
const fixtures = require('./fixtures.cjs');
const { cases } = require('./cases.cjs');
const { probeSandboxAccess } = require('./provider-preflight.cjs');

function options(args) {
  const result = { mode: args[0] || 'list' }; const seen = new Set();
  if (!['list', 'preflight', 'prepare', 'run', 'observe', 'stop'].includes(result.mode)) throw new Error('Unknown canary mode');
  for (let i = 1; i < args.length; i++) {
    const flag = args[i]; if (seen.has(flag)) throw new Error('Duplicate option'); seen.add(flag);
    if (['--ack-production-canary', '--ack-observer-service-role', '--watch', '--diagnostic-no-files'].includes(flag)) result[flag.slice(2)] = true;
    else if (['--run-id', '--repository', '--site-id', '--max-credits'].includes(flag) && args[i + 1] && !args[i + 1].startsWith('--')) result[flag.slice(2)] = args[++i];
    else throw new Error('Unknown or incomplete canary option');
  }
  if (result.mode !== 'list' && !result['ack-observer-service-role']) throw new Error('Explicit --ack-observer-service-role is required for private read-only execution evidence');
  if (!['list', 'preflight'].includes(result.mode)) host.paths(result['run-id']);
  if (['prepare', 'run', 'stop'].includes(result.mode) && (!result['ack-production-canary'] || !result['site-id'])) throw new Error('Mutation requires --ack-production-canary --site-id UUID');
  if (result.mode === 'prepare' && !result.repository) throw new Error('Explicit --repository is required');
  if (result['max-credits'] !== undefined && (!['prepare', 'run'].includes(result.mode) || !/^[2-6]$/.test(result['max-credits']))) throw new Error('Explicit credit limit must be an integer from 2 through 6 for prepare/run');
  return result;
}
const git = (cwd, ...args) => { const result = spawnSync('git', args, { cwd, encoding: 'utf8' }); return result.status === 0 ? result.stdout.trim() : null; };
async function preflight(settings, connection, dependencies = {}) {
  const checks = { account: true, site: true };
  for (const [table, select] of [['harness_sessions', 'id'], ['harness_requirement_runs', 'requirement_id,session_id,previous_session_id']]) {
    const result = await connection.observer.from(table).select(select).eq('site_id', settings.siteId).limit(0);
    checks[table] = !result.error;
  }
  const credits = await connection.client.from('billing').select('credits_available').eq('site_id', settings.siteId).maybeSingle();
  checks.funded = !credits.error && !!credits.data && Number(credits.data.credits_available) >= 2;
  const transactions = await connection.client.from('credit_transactions').select('amount,metadata').eq('site_id', settings.siteId).limit(0);
  checks.creditObservation = !transactions.error;
  checks.sandboxCredentials = !!settings.credentials.token && !!settings.credentials.teamId && !!settings.credentials.projectId;
  const sandbox = await (dependencies.probeSandboxAccess || probeSandboxAccess)(settings);
  checks.sandboxAccess = sandbox.ready === true;
  return { checks, passed: Object.values(checks).every(Boolean),
    funding: { available: !credits.error && Number.isFinite(credits.data?.credits_available) ? credits.data.credits_available : null, required: 2 },
    sandbox,
    deployedSha: settings.deployedSha, deploymentVerified: false,
    blockers: Object.entries(checks).filter(([, ready]) => !ready).map(([name]) => name),
    note: 'Database presence is not proof of deployed code. The first observed agent session verifies the active execution path.' };
}
function validateManifest(run, settings, userId) {
  host.assertRun(run, settings, userId);
  const expected = cases(run.id);
  if (JSON.stringify(run.cases.map(spec => { const copy = { ...spec }; delete copy.activatedAt; return copy; })) !== JSON.stringify(expected)) throw new Error('Manifest test definitions changed; use a new run');
  if (JSON.stringify(run.repository) !== JSON.stringify(fixtures.repository(run.repository.url)) || !Number.isInteger(run.maxCredits) || run.maxCredits < 2 || run.maxCredits > 6 || run.maxSeconds !== 1500) throw new Error('Manifest safety limits changed');
}
async function observe(run, connection, settings, p) {
  const { observeCase } = require('./observe.cjs'); const { evaluateCase, summarize } = require('./evaluate.cjs');
  const history = fs.existsSync(p.observations) ? JSON.parse(fs.readFileSync(p.observations, 'utf8')) : {};
  const results = [];
  for (const spec of run.cases) {
    if (!spec.activatedAt) { results.push({ id: spec.id, state: 'blocked', checks: [], reason: 'not_activated' }); continue; }
    const observation = await observeCase(spec, run, { ...connection,
      readFiles: run.diagnosticNoFiles ? undefined : host.fileReader(settings), redact: settings.redact });
    (history[spec.id] ||= []).push(observation);
    // A fixed-duration run at 15 seconds retains <=105 samples/case; fail rather than lose evidence.
    if (history[spec.id].length > 150) throw new Error('Observation budget reached');
    results.push(evaluateCase(spec, history[spec.id], Date.now()));
  }
  if (Buffer.byteLength(JSON.stringify(history)) > 16 * 1024 * 1024) throw new Error('Run evidence storage budget reached; previous evidence preserved');
  host.write(p.observations, history);
  const report = summarize(run, results);
  if (run.diagnosticNoFiles) {
    report.mode = 'diagnostic-no-files'; report.healthGreen = false; report.behaviorPassed = false;
    report.independentFileVerification = 'unavailable';
    report.diagnosticCompletedCases = results.filter(result => diagnosticComplete(result)).map(result => result.id);
  }
  host.write(p.report, report);
  return { report, results, history };
}
function diagnosticComplete(result) {
  // Only file-oracle checks can be unavailable. Do not bypass failed commands,
  // missing receipts, ownership, budgets, timeout, or actual task-state checks.
  const ignored = new Set(['independent_exact_files']);
  return result.checks?.length > 0 && result.checks.every(check => ignored.has(check.name) || check.passed === true);
}
function canActivate(ready, diagnosticNoFiles) {
  return ready.passed || (diagnosticNoFiles === true && ready.blockers.every(name => ['sandboxCredentials', 'sandboxAccess'].includes(name)));
}
async function stop(run, client) {
  const errors = [];
  for (const spec of run.cases) if (spec.activatedAt) {
    try { await fixtures.transition(run, spec, client, 'blocked'); } catch { errors.push(spec.id); }
  }
  if (errors.length) throw new Error('One or more run-owned requirements could not be stopped');
}
async function main(args = process.argv.slice(2)) {
  const opts = options(args);
  if (opts.mode === 'list') { console.log(JSON.stringify(cases('canary-preview').map(({ id, title, request, deadlineSeconds }) => ({ id, title, request, deadlineSeconds })), null, 2)); return; }
  const settings = host.config(); const connection = await host.connect(settings);
  if (opts['site-id'] && opts['site-id'] !== settings.siteId) throw new Error('Acknowledged site differs from configured test site');
  if (opts.mode === 'preflight') {
    const result = await preflight(settings, connection); console.log(JSON.stringify(result, null, 2));
    if (opts['run-id']) host.write(host.paths(opts['run-id']).report, { mode: 'preflight', checkedAt: new Date().toISOString(), ...result, healthGreen: false });
    if (!result.passed) process.exitCode = 2; return;
  }
  const p = host.paths(opts['run-id']); const release = host.lock(p);
  let run; let supervising = false; let interrupted = false;
  const onSignal = () => { interrupted = true; };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  try {
    if (opts.mode === 'prepare') {
      if (fs.existsSync(p.manifest)) throw new Error('Run already exists; inspect it, never silently recreate fixtures');
      const ready = await preflight(settings, connection);
      if (!canActivate(ready, opts['diagnostic-no-files'])) { host.write(p.report, { state: 'blocked', preflight: ready, healthGreen: false }); throw new Error('Canary prerequisites unavailable; no fixtures created'); }
      run = fixtures.makeRun({ id: opts['run-id'], settings, userId: connection.userId, repoUrl: opts.repository,
        sourceSha: git(host.root, 'rev-parse', 'HEAD'), apiSourceSha: git(settings.apiRoot, 'rev-parse', 'HEAD'), maxCredits: Number(opts['max-credits'] || 2) });
      run.sourceDirty = !!git(host.root, 'status', '--porcelain');
      run.diagnosticNoFiles = opts['diagnostic-no-files'] === true;
      host.write(p.manifest, run); host.write(p.report, { state: 'preparing', healthGreen: false });
      await fixtures.seed(run, connection); run.state = 'ready'; host.write(p.manifest, run);
      console.log(JSON.stringify({ runId: run.id, state: run.state, requirements: run.cases.map(c => c.requirementId), runnable: false })); return;
    }
    run = JSON.parse(fs.readFileSync(p.manifest, 'utf8')); validateManifest(run, settings, connection.userId);
    if (opts.mode === 'stop') { await stop(run, connection.client); run.state = 'stopped'; host.write(p.manifest, run); console.log('Run-owned requirements stopped; no records deleted'); return; }
    if (opts.mode === 'run') {
      if (run.maxCredits !== Number(opts['max-credits'] || 2)) throw new Error('Activation requires explicit acknowledgement of the prepared credit limit');
      if (run.state !== 'ready') throw new Error('Only a prepared run can be activated; use observe or stop after interruption');
      if (run.diagnosticNoFiles && !opts['diagnostic-no-files']) throw new Error('Diagnostic run requires explicit --diagnostic-no-files acknowledgement');
      const ready = await preflight(settings, connection); if (!canActivate(ready, run.diagnosticNoFiles)) throw new Error('Preflight failed before activation');
      supervising = true; run.state = 'running'; run.executionStartedAt = new Date().toISOString(); host.write(p.manifest, run);
      host.write(p.report, { state: 'running', healthGreen: false, startedAt: run.executionStartedAt });
      for (const spec of run.cases) {
        if (interrupted) throw new Error('Canary interrupted before activation');
        spec.activatedAt = new Date().toISOString(); host.write(p.manifest, run);
        await fixtures.transition(run, spec, connection.client, 'backlog');
        while (true) {
          if (interrupted) throw new Error('Canary interrupted; stopping owned work');
          const { results, history, report } = await observe(run, connection, settings, p);
          const current = results.find(r => r.id === spec.id);
          console.log(JSON.stringify({ runId: run.id, case: spec.id, state: current.state, at: new Date().toISOString(), report: p.report }));
          const latest = Object.values(history).map(samples => samples.at(-1));
          const credits = latest.reduce((sum, s) => sum + (Number.isFinite(s.credits) ? s.credits : 0), 0);
          if (credits >= run.maxCredits || Date.now() - Date.parse(run.executionStartedAt) > run.maxSeconds * 1000) throw new Error('Suite cost/time watchdog reached');
          if (current.state === 'passed' || (run.diagnosticNoFiles && diagnosticComplete(current))) break;
          if (current.state !== 'pending' || latest.some(s => s.errors?.length || (s.session && s.credits === null))) {
            host.write(p.report, { ...report, healthGreen: false, stoppedOn: spec.id }); throw new Error('Canary failed or observation is unavailable; remaining requirements not activated');
          }
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
      }
      run.state = 'finished'; host.write(p.manifest, run); supervising = false;
    } else {
      const until = Date.now() + run.maxSeconds * 1000;
      do {
        const { report, results } = await observe(run, connection, settings, p);
        console.log(JSON.stringify({ runId: run.id, healthGreen: report.healthGreen, cases: results.map(({ id, state }) => ({ id, state })), report: p.report }));
        if (interrupted || !opts.watch || results.every(r => r.state !== 'pending')) break;
        await new Promise(resolve => setTimeout(resolve, 15000));
      } while (Date.now() < until);
    }
    const report = JSON.parse(fs.readFileSync(p.report, 'utf8')); if (!report.healthGreen) process.exitCode = 1;
  } catch (error) {
    let stopped = null;
    if (supervising && run) { try { await stop(run, connection.client); stopped = true; } catch { stopped = false; } }
    if (run && (supervising || run.state !== 'ready')) { run.state = 'blocked'; host.write(p.manifest, run); }
    const previous = fs.existsSync(p.report) ? JSON.parse(fs.readFileSync(p.report, 'utf8')) : {};
    host.write(p.report, { ...previous, state: 'blocked', healthGreen: false, failure: settings.redact(error.message), stopConfirmed: stopped });
    throw error;
  } finally { process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal); release(); }
}
if (require.main === module) main().catch(() => { console.error('Harness canary stopped; inspect its private run report. Raw errors suppressed.'); process.exitCode = 2; });
module.exports = { options, preflight, validateManifest, observe, stop, main, diagnosticComplete, canActivate };