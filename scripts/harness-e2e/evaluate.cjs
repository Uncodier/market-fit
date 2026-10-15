'use strict';

// Pure offline evaluation. Never return transcript text, arguments, file contents or errors.
const { createHash } = require('node:crypto');
const CASE_IDS = ['01-file', '02-repair', '03-continue', '04-resume', '05-plan'];
const hash = value => createHash('sha256').update(value).digest('hex');
const array = value => Array.isArray(value) ? value : [];
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const done = value => ['completed', 'done'].includes(value);
const terminal = observation => observation?.session?.status === 'completed' &&
  ['on-review', 'done'].includes(observation?.requirement?.status);
const identifier = value => typeof value === 'string' ?
  (CASE_IDS.includes(value) || /^[a-f0-9-]{36}$/i.test(value) ? value : `sha256:${hash(value)}`) : null;
function object(value) {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return null; } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function transcript(observations) {
  const calls = new Map();
  let sequence = 0, malformed = 0, messageCount = 0;
  for (const observation of observations) {
    const session = observation.session;
    for (const message of array(session?.messages)) {
      messageCount++;
      if (message.role === 'assistant') for (const call of array(message.toolCalls)) {
        if (!call.id || !call.name) { malformed++; continue; }
        const key = `${session.id}:${call.id}`;
        const args = object(call.arguments);
        if (!args) malformed++;
        if (!calls.has(key)) calls.set(key, { name: call.name, args, order: sequence++, result: null });
        else if (calls.get(key).name !== call.name || JSON.stringify(calls.get(key).args) !== JSON.stringify(args)) malformed++;
      }
      if (message.role === 'tool') {
        const call = calls.get(`${session.id}:${message.toolCallId}`);
        const result = object(message.contentJSON ?? message.content);
        if (!call || !result || typeof result.ok !== 'boolean') { malformed++; continue; }
        if (!call.result) { call.result = result; call.resultOrder = sequence++; }
      }
    }
  }
  return { calls: [...calls.values()], malformed, messageCount };
}
const exitCode = call => Number.isInteger(call.result?.output?.exitCode) ? call.result.output.exitCode :
  Number.isInteger(call.result?.error?.exitCode) ? call.result.error.exitCode : null;
const success = call => call.result?.ok === true && (call.name !== 'exec' || exitCode(call) === 0);
const command = call => typeof call.args?.command === 'string' ? call.args.command : '';
const normalized = call => command(call).trim().replace(/\s+/g, ' ');
const assertion = call => call.name === 'exec' && /\bassert\b|\badd\s*\(\s*2\s*,\s*3\s*\)/.test(command(call));
function sameAssertionAfterRepair(failure, passed) {
  if (failure.args?.cwd !== passed.args?.cwd) return false;
  if (normalized(passed) === normalized(failure)) return true;
  // Narrow observed shell shape, not a shell parser: one literal Python write
  // followed by the unchanged final test invocation. No trailing command, pipes,
  // conditional execution or exception suppression may mask the assertion exit.
  const test = command(failure).trim();
  if (!/^python3 -B - <<'([A-Z][A-Z0-9_]*)'\nfrom sum import add\nassert add\(2,3\)==5\n\1$/.test(test) ||
      !/\bAssertionError\b/.test(failure.result?.output?.stderr || '')) return false;
  const full = command(passed).trim();
  if (!full.endsWith('\n' + test)) return false;
  const prefix = full.slice(0, -(test.length + 1));
  return /^python3 -B - <<'([A-Z][A-Z0-9_]*)'\nfrom pathlib import Path\nPath\('sum\.py'\)\.write_text\('def add\(a, b\): return a \+ b\\n', encoding='utf-8'\)\n\1$/.test(prefix);
}
function verifiedPythonResume(call, before) {
  if (!before || call.name !== 'exec' || !success(call) || call.args?.cwd !== '/vercel/sandbox' || call.args?.background === true) return false;
  const root = before.slice(0, -'/before.txt'.length);
  if (!/^\.harness-e2e\/[a-z0-9-]{8,80}$/.test(root)) return false;
  // A bounded literal straight-line program proves read -> assertion -> write.
  // No executing/parsing model code on the observer host; no arbitrary suffixes,
  // mocked read_text, exceptions, alternate paths or reordered statements.
  const expected = `python3 -c 'from pathlib import Path; p = Path("${root}"); before = (p / "before.txt").read_text(encoding="utf-8"); assert before == "before\\n", repr(before); (p / "after.txt").write_text(before.rstrip("\\n") + "+after\\n", encoding="utf-8"); assert (p / "after.txt").read_text(encoding="utf-8") == "before+after\\n"; print("Verified before.txt and after.txt contents.")'`;
  return command(call).trim() === expected;
}
const forbiddenTool = name => /platform_|deployment_|sandbox_?provision|provision_?sandbox|tracking|source_?archive/i.test(name) ||
  /^sandbox_(?:db_(?:provision|migrate)|storage_ensure|preview_expose|browser_install)$/i.test(name);
function forbiddenCommand(text) {
  // Conservative detection includes wrapped commands and shell sequences, not only prefixes.
  const normalizedText = text.replace(/\\\n/g, '').replace(/["']/g, '').toLowerCase();
  return /\bgit\b[^\n;&|]*\bpush\b|\b(?:deploy|vercel|netlify)\b|\bwrangler\b[^\n;&|]*\b(?:deploy|publish)\b/.test(normalizedText) ||
    /\b(?:npm|pnpm|yarn|bun)\b[^\n;&|]*\b(?:install|add|ci|dlx)\b|\bnpx\b|\b(?:pip\d*|apt(?:-get)?|brew|uv)\b[^\n;&|]*\binstall\b/.test(normalizedText);
}
function cycleIds(observation) {
  return [...array(observation.statuses).map(row => row.cycle), observation.mapping?.last_cycle_id,
    observation.requirement?.cron_lock_run_id].filter(value => typeof value === 'string' &&
      (/^agent:.+/.test(value) || /^agent-cron-.+/.test(value))).map(value => value.replace(/^agent:/, ''));
}
function fileAt(observation, path) {
  return Array.isArray(observation?.files) ? observation.files.find(file => file.path === path) : observation?.files?.[path];
}
function fileMatches(spec, observation, path) {
  const actual = fileAt(observation, path);
  return actual?.state === 'read' && actual.sha256 === hash(spec.files[path]) &&
    actual.bytes === Buffer.byteLength(spec.files[path]);
}

function evaluateCase(spec, observations, nowMs = Date.now()) {
  const obs = array(observations);
  const last = obs.at(-1) || {};
  const checks = [];
  const check = (name, passed, evidence = {}) => checks.push({ name, passed: Boolean(passed), evidence });
  const evidence = transcript(obs);
  const calls = evidence.calls;
  const executions = calls.filter(call => call.name === 'exec');
  const receipts = calls.filter(call => call.result);
  const unknown = calls.filter(call => !call.args || !call.result || call.result.truncated === true ||
    (call.name === 'exec' && exitCode(call) === null));
  const cycles = new Set(obs.flatMap(cycleIds));
  const sessions = obs.map(value => value.session).filter(Boolean);
  const workspaces = sessions.map(session => session.workspace?.id).filter(Boolean);
  const sessionIds = new Set(sessions.map(session => session.id));
  const mappingIds = new Set(obs.map(value => value.mapping?.session_id).filter(Boolean));
  const workspaceIds = new Set(workspaces);
  const errors = obs.reduce((total, value) => total + array(value.errors).length, 0);
  const creditsKnown = number(last.credits);
  const complete = obs.length > 0 && last.complete === true && evidence.malformed === 0 && unknown.length === 0 && creditsKnown;
  const completed = obs.find(terminal);
  const firstStartMs = time(spec.activatedAt) ?? time(spec.startedAt) ?? obs.map(value => time(value.requirement?.created_at)).find(value => value !== null) ??
    sessions.map(value => time(value.createdAt)).find(value => value !== null) ?? time(obs[0]?.observedAt);
  const sessionStarts = sessions.map(value => time(value.createdAt)).filter(value => value !== null);
  const startupMs = firstStartMs !== null && sessionStarts.length && Math.min(...sessionStarts) >= firstStartMs ?
    Math.min(...sessionStarts) - firstStartMs : null;
  const observedCompletion = time(completed?.observedAt);
  const updatedCompletion = time(completed?.session?.updatedAt);
  const completionMs = updatedCompletion !== null && updatedCompletion >= firstStartMs && updatedCompletion <= observedCompletion ?
    updatedCompletion : observedCompletion;
  const completionDurationMs = firstStartMs !== null && completionMs !== null && completionMs >= firstStartMs ?
    completionMs - firstStartMs : null;
  const elapsedMs = firstStartMs === null ? null : Math.max(0, (completionMs ?? nowMs) - firstStartMs);
  const deadlineMs = number(spec.deadlineSeconds) ? spec.deadlineSeconds * 1000 : null;
  const expired = elapsedMs !== null && deadlineMs !== null && elapsedMs > deadlineMs;
  const budget = sessions.some(session => /budget|credit|limit_exhausted/i.test(session.reason || ''));
  const paths = Object.keys(spec.files || {});
  const matchedFiles = paths.filter(path => fileMatches(spec, last, path)).length;
  const unavailableFiles = paths.filter(path => !fileAt(last, path) || fileAt(last, path).state === 'unavailable').length;
  const external = calls.filter(call => forbiddenTool(call.name)).length;
  const forbiddenShell = executions.filter(call => forbiddenCommand(command(call))).length;
  const monotonic = ['turns', 'allocatedTokens', 'activeMs'].every(field => sessions.every((session, index) =>
    number(session[field]) && (index === 0 || session[field] >= sessions[index - 1][field])));
  const mappingMismatch = mappingIds.size > 1 || (sessions.length > 0 && [...mappingIds].some(id => !sessionIds.has(id))) ||
    obs.some(value => value.mapping && value.session && value.mapping.session_id !== value.session.id);
  const identity = sessions.length > 0 && sessionIds.size === 1 && workspaceIds.size === 1 && !mappingMismatch &&
    sessions.every(session => session.id) && Boolean(last.session?.workspace?.id && last.mapping?.session_id) && obs.every(value =>
      (!value.requirement || value.requirement.id === spec.requirementId));
  check('terminal_completed', terminal(last), { completed: terminal(last) });
  check('independent_exact_files', paths.length > 0 && matchedFiles === paths.length,
    { expected: paths.length, matched: matchedFiles, unavailable: unavailableFiles });
  check('evidence_complete', complete && receipts.length > 0, {
    observations: obs.length, receipts: receipts.length, unknown: unknown.length, malformed: evidence.malformed, creditsKnown });
  check('observation_errors_absent', errors === 0, { count: errors });
  check('external_tools_absent', external === 0, { count: external });
  check('forbidden_commands_absent', forbiddenShell === 0, { count: forbiddenShell });
  check('deadline', elapsedMs !== null && deadlineMs !== null && !expired, { elapsedMs, deadlineMs });
  check('budget_available', !budget, { exhausted: budget });
  check('session_workspace_continuity', identity, { sessions: sessionIds.size, workspaces: workspaceIds.size, mappings: mappingIds.size });
  check('monotonic_counters', sessions.length > 0 && monotonic, { samples: sessions.length });
  check('minimum_cycles', cycles.size >= (spec.minimumCycles || 1), { count: cycles.size, minimum: spec.minimumCycles || 1 });

  if (spec.requiredFailure === 'assertion') {
    const failures = executions.filter(call => assertion(call) && exitCode(call) !== null && exitCode(call) !== 0);
    const repaired = failures.some(failure => executions.some(call => assertion(call) && success(call) &&
      call.order > failure.resultOrder && sameAssertionAfterRepair(failure, call)));
    check('assertion_failure_then_same_test_pass', repaired, { failures: failures.length, repaired });
  }
  if (spec.requiredFailure === 'exit7') {
    const failures = executions.filter(call => exitCode(call) === 7);
    const intended = failures.filter(call => /\bsys\.exit\s*\(\s*7\s*\)/.test(command(call)));
    const continued = intended.length === 1 && calls.some(call => ['apply_patch', 'exec'].includes(call.name) &&
      success(call) && call.order > intended[0].resultOrder);
    const attempts = executions.filter(call => /\bsys\.exit\s*\(\s*7\s*\)/.test(command(call))).length;
    check('exit7_once_then_continue', continued && failures.length === 1 && attempts === 1,
      { failures: failures.length, attempts, continued });
  }
  if (spec.id === '04-resume') {
    const before = paths.find(path => path.endsWith('/before.txt'));
    const sleep = executions.find(call => /\btime\.sleep\s*\(\s*70\s*\)/.test(command(call)) &&
      call.args?.background !== true && call.args?.timeoutMs >= 70000 && success(call));
    const reads = calls.filter(call => call.name === 'read_files' && success(call) && sleep &&
      call.order > sleep.resultOrder && array(call.args?.files).some(file => file.path === before) &&
      array(call.result?.output?.files).some(file => file.path === before && !file.error &&
        file.truncated !== true && typeof file.content === 'string' && hash(file.content) === hash(spec.files[before])));
    const writes = calls.filter(call => ['exec', 'apply_patch'].includes(call.name) && success(call) &&
      JSON.stringify(call.args).includes('after.txt'));
    const chronological = reads.some(read => writes.some(write => write.order > read.resultOrder));
    const combined = calls.some(call => sleep && call.order > sleep.resultOrder && verifiedPythonResume(call, before));
    const beforeObserved = before && obs.some(value => fileMatches(spec, value, before));
    check('resume_read_before_then_write_after', Boolean(sleep && (chronological || combined) && beforeObserved),
      { sleep: Boolean(sleep), reads: reads.length + Number(combined), writes: writes.length, beforeObserved: Boolean(beforeObserved) });
  }
  if (spec.id === '05-plan') {
    const plan = array(last.plans).find(value => value.id === spec.planId);
    const initialPlan = obs.flatMap(value => array(value.plans)).find(value => value.id === spec.planId);
    const steps = array(plan?.steps);
    const originalSteps = ['first-step', 'second-step'];
    const backlog = array(last.requirement?.backlog?.items ?? last.requirement?.backlog);
    const originalItems = ['first', 'second'];
    const progress = calls.filter(call => call.name === 'requirement_progress' && success(call) &&
      done(call.args?.status) && (call.result?.output?.state === 'updated' ||
        (call.result?.output?.state === 'unchanged' && call.result.output.statusChanged === false &&
          call.result.output.plan?.id === call.args.planId && call.result.output.step?.id === call.args.stepId &&
          done(call.result.output.step?.status) && call.result.output.item?.id === call.args.itemId && done(call.result.output.item?.status))));
    const replacements = calls.filter(call => call.name === 'requirement_plan').length;
    check('original_plan_completed', Boolean(spec.planId && plan?.status === 'completed' && steps.length === 2 &&
      new Set(steps.map(step => step.id)).size === 2 &&
      array(initialPlan?.steps).every(step => originalSteps.includes(step.id)) &&
      steps.every(step => originalSteps.includes(step.id) && step.status === 'completed')),
    { plans: array(last.plans).length, steps: steps.length });
    check('original_backlog_completed', originalItems.every(id => backlog.some(item => item.id === id && done(item.status))),
      { completed: originalItems.filter(id => backlog.some(item => item.id === id && done(item.status))).length });
    check('original_progress_receipts', originalItems.every(id => progress.some(call => call.args.itemId === id)) &&
      originalSteps.length === 2 && originalSteps.every(id => progress.some(call => call.args.planId === spec.planId && call.args.stepId === id)),
    { receipts: progress.length });
    check('plan_not_replaced', replacements === 0 && array(last.plans).length === 1, { calls: replacements });
  }

  const invariantFailure = external > 0 || forbiddenShell > 0 || sessionIds.size > 1 || workspaceIds.size > 1 || mappingMismatch ||
    (sessions.length > 0 && !monotonic) || obs.some(value => value.requirement && value.requirement.id !== spec.requirementId);
  let state;
  if (errors || budget) state = 'blocked';
  else if (invariantFailure) state = 'failed';
  else if (expired) state = 'timed_out';
  else if (!terminal(last)) state = ['failed', 'cancelled'].includes(last.session?.status) ? 'failed' : 'pending';
  else if (!complete || !receipts.length || unavailableFiles || firstStartMs === null || !last.mapping) state = 'blocked';
  else state = checks.every(value => value.passed) ? 'passed' : 'failed';
  // Observer credits are cumulative absolute session debits, not a site balance.
  const creditsUsed = number(last.credits) ? last.credits : null;
  return { id: identifier(spec.id), requirementId: identifier(spec.requirementId), state, checks,
    metrics: { firstStartMs, completionMs, startupMs, completionDurationMs, elapsedMs, cycles: cycles.size, observations: obs.length,
      toolCalls: calls.length, toolReceipts: receipts.length, execCalls: executions.length,
      failures: calls.filter(call => call.result?.ok === false || (exitCode(call) !== null && exitCode(call) !== 0)).length,
      turns: number(last.session?.turns) ? last.session.turns : null,
      allocatedTokens: number(last.session?.allocatedTokens) ? last.session.allocatedTokens : null,
      activeMs: number(last.session?.activeMs) ? last.session.activeMs : null, creditsUsed } };
}

function summarize(run, caseResults) {
  const results = array(caseResults);
  const specs = array(run.cases);
  const exactFive = specs.length === 5 && results.length === 5 && CASE_IDS.every(id =>
    specs.filter(spec => spec.id === id).length === 1 && results.filter(result => result.id === id).length === 1);
  const behaviorPassed = exactFive && results.every(result => result.state === 'passed' &&
    result.requirementId === identifier(specs.find(spec => spec.id === result.id)?.requirementId) &&
    array(result.checks).length > 0 && result.checks.every(check => check.passed === true));
  const sha = value => typeof value === 'string' && /^[a-f0-9]{40,64}$/i.test(value) ? value : null;
  const sourceSha = sha(run.sourceSha), apiSourceSha = sha(run.apiSourceSha), deployedSha = sha(run.deployedSha);
  const provenance = run.sourceDirty === true ? 'dirty' :
    !sourceSha || !apiSourceSha || !deployedSha ? 'unknown' : apiSourceSha === deployedSha ? 'matched' : 'mismatch';
  const total = name => results.reduce((sum, result) => sum + (number(result.metrics?.[name]) ? result.metrics[name] : 0), 0);
  const names = new Set(['terminal_completed', 'independent_exact_files', 'evidence_complete', 'observation_errors_absent',
    'external_tools_absent', 'forbidden_commands_absent', 'deadline', 'budget_available', 'session_workspace_continuity',
    'monotonic_counters', 'minimum_cycles', 'assertion_failure_then_same_test_pass', 'exit7_once_then_continue',
    'resume_read_before_then_write_after', 'original_plan_completed', 'original_backlog_completed', 'original_progress_receipts', 'plan_not_replaced']);
  const states = ['pending', 'passed', 'failed', 'blocked', 'timed_out'];
  const numeric = value => Object.fromEntries(Object.entries(value || {}).filter(([key, item]) =>
    /^[a-zA-Z]{1,24}$/.test(key) && (item === null || typeof item === 'boolean' || number(item))));
  const safeCases = results.map(result => ({ id: identifier(result.id), requirementId: identifier(result.requirementId),
    state: states.includes(result.state) ? result.state : 'blocked',
    checks: array(result.checks).filter(check => names.has(check.name)).map(check => ({ name: check.name,
      passed: check.passed === true, evidence: numeric(check.evidence) })), metrics: numeric(result.metrics) }));
  return { runId: identifier(run.id), behaviorPassed, healthGreen: behaviorPassed && provenance === 'matched',
    provenance, sourceSha, apiSourceSha, deployedSha, sourceDirty: run.sourceDirty === true, cases: safeCases, totalCases: results.length,
    passedCases: results.filter(result => result.state === 'passed').length,
    states: Object.fromEntries(states.map(state =>
      [state, results.filter(result => result.state === state).length])),
    metrics: { cycles: total('cycles'), toolCalls: total('toolCalls'), toolReceipts: total('toolReceipts'),
      failures: total('failures'), turns: total('turns'), allocatedTokens: total('allocatedTokens'), activeMs: total('activeMs'),
      creditsUsed: results.length > 0 && results.every(result => number(result.metrics?.creditsUsed)) ? total('creditsUsed') : null } };
}

module.exports = { evaluateCase, summarize };