const { createHash, randomBytes } = require('node:crypto');
const { cases } = require('../../scripts/harness-e2e/cases.cjs');
const { evaluateCase, summarize } = require('../../scripts/harness-e2e/evaluate.cjs');

const specs = cases('offline-evaluator-run');
const start = Date.parse('2026-10-14T00:00:00Z');
const iso = seconds => new Date(start + seconds * 1000).toISOString();
const digest = text => createHash('sha256').update(text).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const pathFor = (spec, name) => Object.keys(spec.files).find(path => path.endsWith(`/${name}`));
function pair(id, name, args = {}, result = { ok: true, output: {} }) {
  return [{ role: 'assistant', content: '', toolCalls: [{ id, name, arguments: JSON.stringify(args) }] },
    { role: 'tool', toolCallId: id, content: JSON.stringify(result) }];
}
function exec(id, command, code, extra = {}) {
  return pair(id, 'exec', { command, ...extra }, { ok: code === 0,
    output: { exitCode: code, stdout: '', stderr: code ? 'Synthetic command error' : '' } });
}
function observation(spec, seconds = 100) {
  return { observedAt: iso(seconds), complete: true, errors: [], credits: 10,
    requirement: { id: spec.requirementId, status: 'on-review', created_at: iso(0), backlog: [] },
    mapping: { session_id: 'session-one', generation: 1, last_cycle_id: 'agent:cycle-one' },
    session: { id: 'session-one', status: 'completed', turns: 4, allocatedTokens: 200, activeMs: 2000,
      messages: pair('write', 'apply_patch', { path: Object.keys(spec.files)[0] }),
      workspace: { id: 'workspace-one' }, createdAt: iso(5), updatedAt: iso(seconds) },
    statuses: [{ id: 'status-one', stage: 'completed', cycle: 'agent:cycle-one', created_at: iso(99) }],
    plans: [], files: Object.fromEntries(Object.entries(spec.files).map(([path, text]) =>
      [path, { state: 'read', sha256: digest(text), bytes: Buffer.byteLength(text) }])) };
}
function fixture(index) {
  const spec = specs[index], final = observation(spec);
  if (index === 1) {
    const command = "python3 -c 'from sum import add; assert add(2,3)==5'";
    final.session.messages = [...exec('fail', command, 1), ...pair('fix', 'apply_patch', {}), ...exec('pass', command, 0)];
  }
  if (index === 2) final.session.messages = [...exec('exit7', "python3 -c 'import sys; sys.exit(7)'", 7),
    ...pair('continue', 'apply_patch', { path: pathFor(spec, 'continued.txt') })];
  if (index === 3) {
    final.mapping.last_cycle_id = 'agent:cycle-two';
    final.statuses.push({ id: 'status-two', cycle: 'agent:cycle-two', created_at: iso(80) });
    final.session.messages = [...pair('before', 'apply_patch', { path: pathFor(spec, 'before.txt') }),
      ...exec('sleep', "python3 -c 'import time; time.sleep(70)'", 0, { timeoutMs: 85000 }),
      ...pair('read', 'read_files', { files: [{ path: pathFor(spec, 'before.txt') }] }, { ok: true,
        output: { files: [{ path: pathFor(spec, 'before.txt'), content: 'before\n', truncated: false }] } }),
      ...pair('after', 'apply_patch', { path: pathFor(spec, 'after.txt') })];
  }
  if (index === 4) {
    final.plans = [{ id: spec.planId, status: 'completed', steps: [
      { id: 'first-step', status: 'completed' }, { id: 'second-step', status: 'completed' }] }];
    final.requirement.backlog = { items: [{ id: 'first', status: 'done' }, { id: 'second', status: 'done' }] };
    final.session.messages = ['first', 'second'].flatMap(id => pair(id, 'requirement_progress',
      { planId: spec.planId, stepId: `${id}-step`, itemId: id, status: 'completed' },
      { ok: true, output: { state: 'updated', planId: spec.planId } }));
  }
  return { spec, obs: [final] };
}
const evaluate = ({ spec, obs }) => evaluateCase(spec, obs, start + 110000);
const check = (result, name) => result.checks.find(value => value.name === name);

test.each([0, 1, 2, 3, 4])('case %i passes only with independent behavioral evidence', index => {
  const result = evaluate(fixture(index));
  expect(result.state).toBe('passed');
  expect(result.checks.every(value => value.passed)).toBe(true);
});

test('already-completed progress receipts count only when atomic target states confirm completion', () => {
  const input = fixture(4);
  input.obs[0].session.messages = ['first', 'second'].flatMap(id => pair(id, 'requirement_progress',
    { target: 'step', planId: input.spec.planId, stepId: `${id}-step`, itemId: id, status: 'completed' },
    { ok: true, output: { state: 'unchanged', statusChanged: false, plan: { id: input.spec.planId, status: 'completed' },
      step: { id: `${id}-step`, status: 'completed' }, item: { id, status: 'done' } } }));
  expect(evaluate(input).state).toBe('passed');
  const receipt = JSON.parse(input.obs[0].session.messages[1].content);
  receipt.output.step.status = 'pending'; input.obs[0].session.messages[1].content = JSON.stringify(receipt);
  expect(evaluate(input).state).toBe('failed');
});
test('an unchanged generic receipt cannot prove the requested plan progress', () => {
  const input = fixture(4);
  const receipt = JSON.parse(input.obs[0].session.messages[1].content);
  receipt.output = { state: 'unchanged', statusChanged: false }; input.obs[0].session.messages[1].content = JSON.stringify(receipt);
  expect(evaluate(input).state).toBe('failed');
});

test('self-reported completion without tool evidence is blocked', () => {
  const input = fixture(0);
  input.obs[0].session.messages = [{ role: 'assistant', content: 'Everything passed. File is correct.' }];
  expect(evaluate(input).state).toBe('blocked');
});

test('exact file hash and byte size are checked, independently of claims', () => {
  const input = fixture(0), file = Object.values(input.obs[0].files)[0];
  file.sha256 = digest('tampered content');
  expect(evaluate(input).state).toBe('failed');
  file.sha256 = digest(Object.values(input.spec.files)[0]);
  file.bytes++;
  expect(evaluate(input).state).toBe('failed');
});

test('assertion success without preceding nonzero result fails', () => {
  const input = fixture(1);
  input.obs[0].session.messages.splice(0, 2);
  expect(evaluate(input).state).toBe('failed');
});

test('a non-assertion failure cannot stand in for the required assertion failure', () => {
  const input = fixture(1);
  input.obs[0].session.messages[0].toolCalls[0].arguments = JSON.stringify({ command: 'false' });
  expect(evaluate(input).state).toBe('failed');
});

test('repair requires the same test command, ordered after failure', () => {
  const input = fixture(1);
  input.obs[0].session.messages[4].toolCalls[0].arguments = JSON.stringify({ command: "python3 -c 'assert True'" });
  expect(evaluate(input).state).toBe('failed');
  const reordered = fixture(1);
  reordered.obs[0].session.messages = [...reordered.obs[0].session.messages.slice(4), ...reordered.obs[0].session.messages.slice(0, 4)];
  expect(evaluate(reordered).state).toBe('failed');
});

function combinedRepair() {
  const input = fixture(1);
  const testCommand = "python3 -B - <<'PY'\nfrom sum import add\nassert add(2,3)==5\nPY";
  const write = "python3 -B - <<'PY'\nfrom pathlib import Path\nPath('sum.py').write_text('def add(a, b): return a + b\\n', encoding='utf-8')\nPY";
  input.obs[0].session.messages = [...exec('fail', testCommand, 1, { cwd: '/vercel/sandbox/case' }),
    ...exec('repair-and-test', write + '\n' + testCommand, 0, { cwd: '/vercel/sandbox/case' })];
  const receipt = JSON.parse(input.obs[0].session.messages[1].content);
  receipt.output.stderr = 'Traceback (most recent call last):\nAssertionError\n';
  input.obs[0].session.messages[1].content = JSON.stringify(receipt);
  return input;
}
test('accepts the identical final assertion after a literal source repair in the same exec', () => {
  expect(evaluate(combinedRepair()).state).toBe('passed');
});
test.each(['suffix', 'cwd', 'missing-assertion-error', 'changed-test', 'unsafe-prefix'])('combined repair rejects %s ambiguity', kind => {
  const input = combinedRepair(), call = input.obs[0].session.messages[2].toolCalls[0];
  const args = JSON.parse(call.arguments);
  if (kind === 'suffix') args.command += '\ntrue';
  if (kind === 'cwd') args.cwd = '/vercel/sandbox/other';
  if (kind === 'changed-test') args.command = args.command.replace('assert add(2,3)==5', 'assert True');
  if (kind === 'unsafe-prefix') args.command = 'false;\n' + args.command;
  if (kind === 'missing-assertion-error') {
    const receipt = JSON.parse(input.obs[0].session.messages[1].content); receipt.output.stderr = 'ImportError';
    input.obs[0].session.messages[1].content = JSON.stringify(receipt);
  }
  call.arguments = JSON.stringify(args);
  expect(evaluate(input).state).toBe('failed');
});

function pythonResume() {
  const input = fixture(3), root = pathFor(input.spec, 'before.txt').slice(0, -'/before.txt'.length);
  const command = `python3 -c 'from pathlib import Path; p = Path("${root}"); before = (p / "before.txt").read_text(encoding="utf-8"); assert before == "before\\n", repr(before); (p / "after.txt").write_text(before.rstrip("\\n") + "+after\\n", encoding="utf-8"); assert (p / "after.txt").read_text(encoding="utf-8") == "before+after\\n"; print("Verified before.txt and after.txt contents.")'`;
  input.obs[0].session.messages = [...input.obs[0].session.messages.slice(0, 4), ...exec('read-write', command, 0, { cwd: '/vercel/sandbox', background: false })];
  return input;
}
test('recognizes actual Python read/assert/write after the sleep in a later tool call', () => {
  expect(evaluate(pythonResume()).state).toBe('passed');
});
test.each(['before-sleep', 'no-read', 'changed-assertion', 'masked-exit', 'cwd', 'same-cycle'])('Python resume rejects %s', kind => {
  const input = pythonResume(), call = input.obs[0].session.messages[4].toolCalls[0];
  const args = JSON.parse(call.arguments);
  if (kind === 'no-read') args.command = args.command.replace('(p / "before.txt").read_text(encoding="utf-8")', '"before\\n"');
  if (kind === 'changed-assertion') args.command = args.command.replace('assert before == "before\\n"', 'assert True');
  if (kind === 'masked-exit') args.command += '; true';
  if (kind === 'cwd') args.cwd = '/tmp';
  call.arguments = JSON.stringify(args);
  if (kind === 'before-sleep') input.obs[0].session.messages = [...input.obs[0].session.messages.slice(4), ...input.obs[0].session.messages.slice(0, 4)];
  if (kind === 'same-cycle') { input.obs[0].mapping.last_cycle_id = 'agent:cycle-one'; input.obs[0].statuses.pop(); }
  expect(evaluate(input).state).toBe('failed');
});

test('exit7 must be observed once and followed by a successful write or command', () => {
  const missing = fixture(2);
  missing.obs[0].session.messages.splice(0, 2);
  expect(evaluate(missing).state).toBe('failed');
  const repeated = fixture(2);
  repeated.obs[0].session.messages.push(...exec('retry', "python3 -c 'import sys; sys.exit(7)'", 7));
  expect(evaluate(repeated).state).toBe('failed');
  const noContinuation = fixture(2);
  noContinuation.obs[0].session.messages.splice(2);
  expect(evaluate(noContinuation).state).toBe('failed');
});

test.each(['platform_key_provision', 'deployment_create', 'sandbox_provision', 'tracking_install', 'source_archive'])
('external capability %s fails even with a rejected result', name => {
  const input = fixture(0);
  input.obs[0].session.messages.push(...pair('external', name, {}, { ok: false, error: { code: 'REJECTED' } }));
  expect(evaluate(input).state).toBe('failed');
});

test.each(['git -C . push origin HEAD', 'npm install thing', 'python3 -m pip install thing',
  'sh -c "vercel deploy"', 'pnpm add thing', 'npx example', 'git pu"sh"'])('forbidden shell command is detected: %s', command => {
  const input = fixture(0);
  input.obs[0].session.messages.push(...exec('forbidden', command, 0));
  expect(evaluate(input).state).toBe('failed');
});

test('resume counts distinct agent cycles, not duplicate status rows', () => {
  const input = fixture(3);
  input.obs[0].mapping.last_cycle_id = 'agent:cycle-one';
  input.obs[0].statuses[1].cycle = 'agent:cycle-one';
  expect(evaluate(input).state).toBe('failed');
  input.obs[0].requirement.cron_lock_run_id = 'agent:cycle-two';
  expect(evaluate(input).state).toBe('passed');
});

test('resume does not require a poll to catch the first file before the second cycle', () => {
  expect(evaluate(fixture(3)).state).toBe('passed');
});

test('resume requires an actual read of before.txt after sleep and before the next write', () => {
  const input = fixture(3);
  input.obs[0].session.messages.splice(4, 2);
  expect(evaluate(input).state).toBe('failed');
});

test.each(['session', 'workspace'])('changed %s identity fails continuity', kind => {
  const input = fixture(3), earlier = clone(input.obs[0]);
  earlier.observedAt = iso(80);
  if (kind === 'session') { earlier.session.id = 'session-old'; earlier.mapping.session_id = 'session-old'; }
  else earlier.session.workspace.id = 'workspace-old';
  input.obs.unshift(earlier);
  expect(evaluate(input).state).toBe('failed');
});

test.each(['turns', 'allocatedTokens', 'activeMs'])('nonmonotonic %s fails', field => {
  const input = fixture(3), earlier = clone(input.obs[0]);
  earlier.session[field]++;
  input.obs.unshift(earlier);
  expect(evaluate(input).state).toBe('failed');
});

test('initial queued session without workspace does not imply workspace replacement', () => {
  const input = fixture(0), earlier = clone(input.obs[0]);
  earlier.session.status = 'queued';
  earlier.session.workspace = undefined;
  earlier.session.messages = [];
  earlier.observedAt = iso(5);
  input.obs.unshift(earlier);
  expect(evaluate(input).state).toBe('passed');
});

test('unavailable artifact is blocked, missing independently read file fails', () => {
  const input = fixture(0), path = Object.keys(input.spec.files)[0];
  input.obs[0].files[path] = { state: 'unavailable' };
  expect(evaluate(input).state).toBe('blocked');
  input.obs[0].files[path] = { state: 'missing' };
  expect(evaluate(input).state).toBe('failed');
});

test('truncated results without exit code are unknown, never successful', () => {
  const input = fixture(1);
  input.obs[0].session.messages[5].content = JSON.stringify({ ok: true, output: { artifact: 'artifact-one', truncated: true } });
  expect(evaluate(input).state).toBe('blocked');
  input.obs[0].session.messages[5].content = JSON.stringify({ ok: true, output: { exitCode: 0, truncated: true } });
  expect(evaluate(input).state).toBe('passed');
});

test('incomplete terminal evidence is blocked; active evidence remains pending', () => {
  const input = fixture(0);
  input.obs[0].complete = false;
  expect(evaluate(input).state).toBe('blocked');
  input.obs[0].session.status = 'running';
  expect(evaluate(input).state).toBe('pending');
});

test('observation errors and exhausted budgets are blocked', () => {
  const input = fixture(0);
  input.obs[0].errors = ['READ_UNAVAILABLE'];
  expect(evaluate(input).state).toBe('blocked');
  input.obs[0].errors = [];
  input.obs[0].session.reason = 'token_budget_exhausted';
  expect(evaluate(input).state).toBe('blocked');
});

test('deadline is inclusive and measures from requirement creation, not latest poll', () => {
  const input = fixture(0);
  input.obs[0].observedAt = iso(301);
  input.obs[0].session.updatedAt = iso(301);
  expect(evaluate(input).state).toBe('timed_out');
  input.obs[0].session.updatedAt = iso(300);
  expect(evaluate(input).state).toBe('passed');
  expect(evaluate(input).metrics.firstStartMs).toBe(start);
});

test('an active case exceeds its budget without any terminal receipt', () => {
  const input = fixture(0);
  input.obs[0].session.status = 'running';
  expect(evaluateCase(input.spec, input.obs, start + 301000).state).toBe('timed_out');
});

test('plan requires existing plan and original item and step completion receipts', () => {
  const wrongPlan = fixture(4);
  wrongPlan.obs[0].plans[0].id = 'replacement';
  expect(evaluate(wrongPlan).state).toBe('failed');
  const missingReceipt = fixture(4);
  missingReceipt.obs[0].session.messages.splice(2);
  expect(evaluate(missingReceipt).state).toBe('failed');
  const wrongItem = fixture(4);
  wrongItem.obs[0].requirement.backlog.items[0].id = 'replacement';
  expect(evaluate(wrongItem).state).toBe('failed');
});

test('plan recreation is forbidden even when the final IDs look correct', () => {
  const input = fixture(4);
  input.obs[0].session.messages.push(...pair('plan', 'requirement_plan', { planId: input.spec.planId }));
  expect(evaluate(input).state).toBe('failed');
});

test('original plan step IDs remain stable across observations', () => {
  const input = fixture(4), earlier = clone(input.obs[0]);
  earlier.plans[0].steps[0].id = 'original-step';
  input.obs.unshift(earlier);
  expect(evaluate(input).state).toBe('failed');
});

test('stats deduplicate cumulative transcripts and count failed exec receipts', () => {
  const input = fixture(1), earlier = clone(input.obs[0]);
  earlier.session.status = 'running';
  earlier.session.messages = earlier.session.messages.slice(0, 2);
  earlier.credits = 0;
  earlier.observedAt = iso(20);
  input.obs.unshift(earlier);
  expect(evaluate(input).metrics).toMatchObject({ toolCalls: 3, toolReceipts: 3, execCalls: 2,
    failures: 1, turns: 4, allocatedTokens: 200, activeMs: 2000, creditsUsed: 10, elapsedMs: 100000 });
});

test('report output cannot leak synthetic secrets from files, arguments, logs, IDs, or metadata', () => {
  const secret = randomBytes(32).toString('hex');
  const url = new URL('https://reserved.example.test');
  url.username = 'synthetic'; url.password = secret;
  const input = fixture(0);
  input.obs[0].session.messages.push(...pair(secret, `unknown_${secret}`, { text: url.toString() },
    { ok: false, error: { code: secret, message: secret } }));
  input.obs[0].requirement.metadata = { secret };
  input.obs[0].files[secret] = { state: 'read', data: secret };
  input.obs[0].errors = [secret];
  const serialized = JSON.stringify(evaluate(input));
  expect(serialized).not.toContain(secret);
  expect(serialized).not.toContain(url.toString());
  const summary = summarize({ id: secret, cases: specs, sourceSha: `invalid:${secret}`, deployedSha: null }, [evaluate(input)]);
  expect(JSON.stringify(summary)).not.toContain(secret);
});

test('summary requires exactly five distinct passing cases and known matching provenance', () => {
  const results = specs.map((_, index) => evaluate(fixture(index)));
  const run = { id: 'offline-run', cases: specs, sourceSha: digest('source'), apiSourceSha: digest('API source'), deployedSha: null };
  expect(summarize(run, results)).toMatchObject({ behaviorPassed: true, healthGreen: false, provenance: 'unknown', passedCases: 5 });
  run.deployedSha = run.apiSourceSha;
  expect(summarize(run, results)).toMatchObject({ behaviorPassed: true, healthGreen: true, provenance: 'matched' });
  expect(summarize(run, results.slice(0, 4)).behaviorPassed).toBe(false);
  expect(summarize(run, [...results.slice(0, 4), results[0]]).behaviorPassed).toBe(false);
  run.deployedSha = digest('different');
  expect(summarize(run, results).healthGreen).toBe(false);
});

test('summary keeps unknown credit usage unknown and aggregates safe numeric stats', () => {
  const results = specs.map((_, index) => evaluate(fixture(index)));
  results[0].metrics.creditsUsed = null;
  expect(summarize({ cases: specs }, results).metrics).toMatchObject({ failures: 2, turns: 20, creditsUsed: null });
  expect(check(results[1], 'assertion_failure_then_same_test_pass').evidence.failures).toBe(1);
});

test('evaluation is pure and supports contentJSON tool receipts', () => {
  const input = fixture(0);
  input.obs[0].session.messages[1].contentJSON = JSON.parse(input.obs[0].session.messages[1].content);
  delete input.obs[0].session.messages[1].content;
  const snapshot = JSON.stringify(input);
  expect(evaluate(input).state).toBe('passed');
  expect(JSON.stringify(input)).toBe(snapshot);
});

test('observer array-form files are independently hashed', () => {
  const input = fixture(0);
  input.obs[0].files = Object.entries(input.obs[0].files).map(([path, file]) => ({ path, ...file }));
  expect(evaluate(input).state).toBe('passed');
});

test('top-level artifact truncation blocks a seemingly successful patch', () => {
  const input = fixture(2);
  input.obs[0].session.messages[3].content = JSON.stringify({ ok: true, truncated: true, artifact: { id: 'artifact' } });
  expect(evaluate(input).state).toBe('blocked');
});

test('read_files wrapper success with a per-file error cannot prove resume', () => {
  const input = fixture(3);
  input.obs[0].session.messages[5].content = JSON.stringify({ ok: true,
    output: { files: [{ path: pathFor(input.spec, 'before.txt'), error: { code: 'READ_FAILED' } }] } });
  expect(evaluate(input).state).toBe('failed');
});

test('summary cannot substitute passed results from a different requirement run', () => {
  const results = specs.map((_, index) => evaluate(fixture(index)));
  results[0].requirementId = cases('other-offline-run')[0].requirementId;
  expect(summarize({ cases: specs }, results).behaviorPassed).toBe(false);
});

test('activation is the deadline origin when a prepared fixture predates execution', () => {
  const input = fixture(0);
  input.spec = { ...input.spec, activatedAt: iso(90) };
  expect(evaluate(input).metrics).toMatchObject({ firstStartMs: start + 90000, elapsedMs: 10000 });
});

test('dirty source cannot produce green health even with matching deployment SHA', () => {
  const results = specs.map((_, index) => evaluate(fixture(index)));
  const sha = digest('source');
  expect(summarize({ cases: specs, sourceSha: sha, deployedSha: sha, sourceDirty: true }, results))
    .toMatchObject({ behaviorPassed: true, healthGreen: false, provenance: 'dirty' });
});

test('pre-session polling stays pending; missing terminal mapping is blocked', () => {
  const input = fixture(0);
  delete input.obs[0].mapping;
  expect(evaluate(input).state).toBe('blocked');
  delete input.obs[0].session;
  expect(evaluate(input).state).toBe('pending');
});

test('separate frontend and API source SHAs do not falsely mismatch deployment provenance', () => {
  const results = specs.map((_, index) => evaluate(fixture(index)));
  const run = { cases: specs, sourceSha: digest('frontend'), apiSourceSha: digest('API'), deployedSha: digest('API') };
  const summary = summarize(run, results);
  expect(summary).toMatchObject({ behaviorPassed: true, healthGreen: true, provenance: 'matched',
    sourceSha: run.sourceSha, apiSourceSha: run.apiSourceSha, deployedSha: run.deployedSha });
  expect(summary.cases).toHaveLength(5);
  expect(summary.cases[0].checks.length).toBeGreaterThan(0);
  delete run.apiSourceSha;
  expect(summarize(run, results).provenance).toBe('unknown');
});

test('summary preserves check evidence but excludes untrusted result fields', () => {
  const secret = randomBytes(24).toString('hex');
  const result = evaluate(fixture(0));
  result.raw = secret;
  result.checks[0].evidence.raw = secret;
  result.metrics.raw = secret;
  result.checks.push({ name: secret, passed: true, evidence: { raw: secret } });
  expect(JSON.stringify(summarize({ cases: specs }, [result]))).not.toContain(secret);
});

test('mapping may precede session creation without permanently failing continuity', () => {
  const input = fixture(0), earlier = clone(input.obs[0]);
  earlier.session = null;
  earlier.credits = null;
  earlier.requirement.status = 'in-progress';
  earlier.observedAt = iso(3);
  input.obs.unshift(earlier);
  expect(evaluateCase(input.spec, [earlier], start + 4000).state).toBe('pending');
  expect(evaluate(input).state).toBe('passed');
  earlier.mapping.session_id = 'different-mapped-session';
  expect(evaluate(input).state).toBe('failed');
});

test.each([null, undefined, NaN, Infinity, -1])('unknown or invalid terminal credits %s block complete evidence', credits => {
  const input = fixture(0);
  input.obs[0].credits = credits;
  const result = evaluate(input);
  expect(result.state).toBe('blocked');
  expect(check(result, 'evidence_complete').evidence.creditsKnown).toBe(false);
});

test('zero cumulative credits are known evidence, not an unavailable balance', () => {
  const input = fixture(0);
  input.obs[0].credits = 0;
  expect(evaluate(input).state).toBe('passed');
});

test('real bare cron cycle and status-prefixed cycle are counted once', () => {
  const input = fixture(3), final = input.obs[0];
  final.mapping.last_cycle_id = 'agent-cron-first';
  final.requirement.cron_lock_run_id = 'agent-cron-first';
  final.statuses = [{ cycle: 'agent:agent-cron-first' }, { cycle: 'unrelated-cycle' }];
  expect(evaluate(input).metrics.cycles).toBe(1);
  expect(evaluate(input).state).toBe('failed');
  final.requirement.cron_lock_run_id = 'agent-cron-second';
  expect(evaluate(input).metrics.cycles).toBe(2);
  expect(evaluate(input).state).toBe('passed');
});

test.each(['sandbox_db_provision', 'sandbox_db_migrate', 'sandbox_storage_ensure',
  'sandbox_preview_expose', 'sandbox_browser_install'])('external sandbox effect %s is forbidden', name => {
  const input = fixture(0);
  input.obs[0].session.messages.push(...pair('external-effect', name));
  expect(evaluate(input).state).toBe('failed');
});

test('startup and completion duration metrics are delays while existing timestamps remain compatible', () => {
  const input = fixture(0);
  input.spec = { ...input.spec, activatedAt: iso(2) };
  expect(evaluate(input).metrics).toMatchObject({ firstStartMs: start + 2000, completionMs: start + 100000,
    startupMs: 3000, completionDurationMs: 98000, elapsedMs: 98000 });
  delete input.obs[0].session.createdAt;
  expect(evaluate(input).metrics.startupMs).toBeNull();
});