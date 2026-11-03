const { createHash, randomBytes } = require('node:crypto');
const { existingAppCases } = require('../../scripts/harness-e2e/existing-app-cases.cjs');
const { evaluateExistingApp, sourceTreeDigest } = require('../../scripts/harness-e2e/existing-app-evidence.cjs');
const { main } = require('../../scripts/harness-e2e/existing-app-evaluate-cli.cjs');

const hash = text => createHash('sha256').update(text).digest('hex');
const iso = seconds => new Date(Date.parse('2026-01-01T00:00:00Z') + seconds * 1000).toISOString();
const file = (path, contents) => ({ path, sha256: hash(contents), bytes: Buffer.byteLength(contents) });
function evidence(index = 0) {
  const spec = existingAppCases()[index];
  const contract = {
    caseId: spec.id, runId: 'offline-existing-app', siteId: 'synthetic-site', userId: 'synthetic-user',
    appId: 'synthetic-app', repositoryId: 'synthetic-repository', requirementId: 'synthetic-requirement',
    actionId: 'new-external-action', sessionId: 'cron-session', originInstanceId: 'interactive-instance',
    runnerInstanceId: 'cron-instance', collectorId: 'trusted-file-collector', verifierId: 'trusted-probe-runner',
    verifierSha256: hash('pre-action read-only verifier'), requestSha256: hash(spec.request),
    allowedChangePaths: ['src/catalog.js', 'src/layout.css'], targetSourcePaths: ['src/catalog.js'],
    protectedPaths: ['public/logo.svg', 'data/prices.json'], deadlineSeconds: 600,
  };
  const identity = Object.fromEntries(['runId', 'siteId', 'userId', 'appId', 'repositoryId', 'requirementId']
    .map(key => [key, contract[key]]));
  const bound = { ...identity, actionId: contract.actionId, sessionId: contract.sessionId, requestSha256: contract.requestSha256 };
  const baseline = { ...identity, origin: 'independent-source-read', collectorId: contract.collectorId,
    complete: true, symlinksAbsent: true, capturedAt: iso(0),
    files: [file('src/catalog.js', 'existing implementation with a gap'), file('public/logo.svg', 'synthetic logo'),
      file('data/prices.json', 'synthetic price data')] };
  baseline.treeSha256 = sourceTreeDigest(baseline.files);
  const finalSource = { ...baseline, ...bound, workspaceId: 'cron-workspace', capturedAt: iso(60),
    files: baseline.files.map(f => f.path === 'src/catalog.js' ? file(f.path, 'extended existing implementation') : { ...f }) };
  finalSource.treeSha256 = sourceTreeDigest(finalSource.files);
  const verification = (phase, snapshot, start, end) => ({ ...bound, phase, id: `probe-${phase}`,
    origin: 'independent-functional-verifier', verifierId: contract.verifierId, verifierSha256: contract.verifierSha256,
    artifactSha256: hash(`synthetic ${phase} assertion artifact`), treeSha256: snapshot.treeSha256,
    complete: true, startedAt: iso(start), completedAt: iso(end),
    checks: [...spec.changeChecks, ...spec.preservationChecks].map(id => ({ id, assertions: 2,
      failures: phase === 'baseline' && id === spec.changeChecks[0] ? 1 : 0 })) });
  return { schemaVersion: 1, contract, complete: true, errors: [], observedAt: iso(90), baseline, finalSource,
    action: { ...bound, instanceId: contract.originInstanceId, origin: 'interactive-assistant', actor: 'external-user',
      status: 'completed', submittedAt: iso(10), completedAt: iso(25) },
    requirementBaseline: { ...identity, requirementType: 'develop', createdAt: '2025-04-01T00:00:00Z',
      observedAt: iso(0), externalUserActionRevision: 4 },
    persistedRequest: { ...bound, origin: 'assistant-tool', operation: 'requirements.update', state: 'applied', appliedAt: iso(28),
      requirementType: 'develop', createdAt: '2025-04-01T00:00:00Z', externalUserActionRevision: 5,
      lastExternalUserActionId: contract.actionId },
    persistenceReceipt: {
      call: { ...bound, id: 'update-call', tool: 'requirements', operation: 'update', at: iso(15) },
      result: { ...bound, callId: 'update-call', ok: true, state: 'queued', at: iso(19) },
    },
    mapping: { ...bound, origin: 'persisted-requirement-run', runnerInstanceId: contract.runnerInstanceId, observedAt: iso(55) },
    execution: { ...bound, instanceId: contract.runnerInstanceId, origin: 'requirement-cron', cycleId: 'new-cron-cycle',
      workspaceId: 'cron-workspace', status: 'completed', requirementStatus: 'on-review', externalUserActionRevision: 5,
      startedAt: iso(30), completedAt: iso(50) },
    verifications: [verification('baseline', baseline, 1, 5), verification('final', finalSource, 65, 80)] };
}
const evaluate = evaluateExistingApp;
const failedCheck = (e, name) => expect(evaluate(e).checks.find(c => c.name === name)?.passed).toBe(false);

test.each([0, 1, 2])('archetype %i requires the full independent evidence chain', index => {
  const e = evidence(index), copy = JSON.stringify(e);
  expect(evaluate(e).state).toBe('passed');
  expect(evaluate(e).checks.every(c => c.passed)).toBe(true);
  expect(JSON.stringify(e)).toBe(copy);
});

test('case contracts are additive, synthetic, and returned as fresh copies', () => {
  const cases = existingAppCases();
  expect(cases).toHaveLength(3);
  expect(cases.every(c => c.intake === 'interactive-assistant' && c.execution === 'requirement-cron')).toBe(true);
  expect(cases.every(c => c.requirementType === 'develop')).toBe(true);
  expect(cases.map(c => c.changeKind)).toEqual(['design', 'bug', 'feature']);
  cases[0].changeChecks.length = 0;
  expect(existingAppCases()[0].changeChecks.length).toBeGreaterThan(0);
});

test('acknowledgement alone never passes', () => {
  const e = evidence();
  delete e.persistedRequest; delete e.persistenceReceipt; delete e.execution;
  delete e.mapping; delete e.finalSource; e.verifications = [];
  e.assistantText = 'Done. Everything is fixed.';
  expect(evaluate(e).state).toBe('failed');
});

test('requirements update and action_unfinished handoff alone never pass', () => {
  const e = evidence();
  delete e.execution; delete e.mapping; delete e.finalSource; e.verifications = [];
  e.diagnostic = { reason: 'action_unfinished', retryable: true };
  failedCheck(e, 'cron_execution_matches');
  expect(evaluate(e).passed).toBe(false);
});

test('the submitting-turn diagnostic does not veto later independently proven execution', () => {
  const e = evidence(); e.diagnostic = { reason: 'action_unfinished', retryable: true };
  expect(evaluate(e).passed).toBe(true);
});

test.each([
  ['not applied command', e => { e.persistedRequest.state = 'queued'; }, 'persisted_request_matches'],
  ['applied before turn finished', e => { e.persistedRequest.appliedAt = iso(24); }, 'persisted_request_matches'],
  ['execution before apply', e => { e.persistedRequest.appliedAt = iso(31); }, 'cron_execution_matches'],
  ['unchanged revision', e => { e.persistedRequest.externalUserActionRevision = 4; }, 'existing_requirement_revision'],
  ['old action revision', e => { e.persistedRequest.lastExternalUserActionId = 'old-action'; }, 'existing_requirement_revision'],
  ['wrong DB type', e => { e.persistedRequest.requirementType = 'task'; }, 'existing_requirement_revision'],
  ['wrong baseline DB type', e => { e.requirementBaseline.requirementType = 'task'; }, 'existing_requirement_revision'],
  ['new seeded requirement', e => { e.requirementBaseline.createdAt = iso(15); }, 'existing_requirement_revision'],
  ['changed creation date', e => { e.persistedRequest.createdAt = iso(0); }, 'existing_requirement_revision'],
  ['execution of old revision', e => { e.execution.externalUserActionRevision = 4; }, 'cron_execution_matches'],
  ['old call', e => { e.persistenceReceipt.call.at = iso(9); }, 'fresh_persistence_receipt'],
  ['old result', e => { e.persistenceReceipt.result.at = iso(9); }, 'fresh_persistence_receipt'],
  ['mismatched call', e => { e.persistenceReceipt.result.callId = 'another-call'; }, 'fresh_persistence_receipt'],
  ['failed receipt', e => { e.persistenceReceipt.result.ok = false; }, 'fresh_persistence_receipt'],
  ['pre-action files', e => { e.finalSource.capturedAt = iso(9); }, 'fresh_independent_source'],
  ['pre-completion files', e => { e.finalSource.capturedAt = iso(40); }, 'fresh_independent_source'],
  ['future files', e => { e.finalSource.capturedAt = iso(100); }, 'fresh_independent_source'],
  ['old cron', e => { e.execution.startedAt = iso(9); }, 'cron_execution_matches'],
  ['cron before handoff', e => { e.execution.startedAt = iso(24); }, 'cron_execution_matches'],
  ['wrong workspace', e => { e.finalSource.workspaceId = 'old-workspace'; }, 'fresh_independent_source'],
  ['wrong session mapping', e => { e.mapping.sessionId = 'old-session'; }, 'requirement_session_mapping'],
  ['wrong runner', e => { e.execution.instanceId = 'interactive-instance'; }, 'cron_execution_matches'],
  ['wrong origin instance', e => { e.action.instanceId = 'cron-instance'; }, 'external_user_action'],
  ['still unfinished action', e => { e.action.status = 'running'; }, 'external_user_action'],
  ['direct seed', e => { e.persistedRequest.origin = 'direct-db-seed'; }, 'persisted_request_matches'],
  ['agent source claim', e => { e.finalSource.origin = 'assistant'; }, 'fresh_independent_source'],
  ['missing manifest file', e => { e.finalSource.files.pop(); }, 'fresh_independent_source'],
  ['symlink', e => { e.finalSource.symlinksAbsent = false; }, 'fresh_independent_source'],
  ['truncated evidence', e => { e.complete = false; }, 'evidence_complete'],
  ['collection error', e => { e.errors = ['unavailable']; }, 'evidence_complete'],
  ['deadline expired', e => { e.observedAt = iso(700); }, 'deadline'],
])('%s is rejected', (_name, mutate, check) => {
  const e = evidence(); mutate(e); failedCheck(e, check); expect(evaluate(e).passed).toBe(false);
});

test.each(['siteId', 'userId', 'appId', 'repositoryId', 'requirementId', 'actionId', 'sessionId', 'requestSha256'])
  ('execution cannot reuse evidence from another %s', key => {
    const e = evidence(); e.execution[key] = 'unrelated'; failedCheck(e, 'cron_execution_matches');
  });

test('unchanged old files fail even with fresh timestamps and passing probes', () => {
  const e = evidence(); e.finalSource.files = e.baseline.files; e.finalSource.treeSha256 = e.baseline.treeSha256;
  e.verifications[1].treeSha256 = e.finalSource.treeSha256;
  failedCheck(e, 'actual_target_source_diff');
});

test('instructions-only, new receipt-only or CSS-only diff cannot substitute for the required source change', () => {
  for (const name of ['instructions.md', 'receipt.json', 'src/layout.css']) {
    const e = evidence(); e.finalSource.files = [...e.baseline.files, file(name, 'new content')];
    e.finalSource.treeSha256 = sourceTreeDigest(e.finalSource.files);
    failedCheck(e, 'actual_target_source_diff');
  }
});

test.each(['public/logo.svg', 'data/prices.json', 'src/unrelated.js'])('a changed %s fails preservation/scope', name => {
  const e = evidence();
  e.finalSource.files = [...e.finalSource.files.filter(f => f.path !== name), file(name, 'unwanted change')];
  e.finalSource.treeSha256 = sourceTreeDigest(e.finalSource.files);
  failedCheck(e, 'only_allowed_files_changed');
  if (name !== 'src/unrelated.js') failedCheck(e, 'protected_files_preserved');
});

test.each([
  ['agent claim', p => { p.origin = 'assistant-tool'; }],
  ['other verifier', p => { p.verifierId = 'agent'; }],
  ['modified verifier', p => { p.verifierSha256 = hash('weakened checks'); }],
  ['stale tree', p => { p.treeSha256 = hash('old files'); }],
  ['wrong requirement', p => { p.requirementId = 'other'; }],
  ['old result', p => { p.startedAt = iso(1); p.completedAt = iso(5); }],
  ['future result', p => { p.completedAt = iso(100); }],
  ['missing assertion', p => { p.checks.pop(); }],
  ['duplicate assertion', p => { p.checks[1].id = p.checks[0].id; }],
  ['zero assertions', p => { p.checks[0].assertions = 0; }],
  ['fake pass boolean', p => { delete p.checks[0].failures; p.checks[0].passed = true; }],
  ['truncated result', p => { p.complete = false; }],
])('functional verification rejects %s', (_name, mutate) => {
  const e = evidence(); mutate(e.verifications[1]); failedCheck(e, 'independent_functional_verification');
});

test('passing exit or status cannot mask failed functional assertions', () => {
  const e = evidence(); e.verifications[1].exitCode = 0; e.verifications[1].checks[0].failures = 1;
  failedCheck(e, 'requested_behavior_and_preservation_pass');
});

test('the unchanged app must exhibit a gap and preserve its pre-existing invariants', () => {
  const e = evidence(); e.verifications[0].checks.forEach(c => { c.failures = 0; });
  failedCheck(e, 'baseline_exposes_requested_gap');
  e.verifications[0].checks[0].failures = 1;
  e.verifications[0].checks.at(-1).failures = 1;
  failedCheck(e, 'baseline_exposes_requested_gap');
});

test.each([null, [], 'raw', {}, { contract: null }, { baseline: { files: [null] } }, { verifications: [null] }])
  ('malformed input fails closed without throwing: %j', value => {
    expect(evaluate(value).passed).toBe(false);
  });

test('manifest digest is order-independent and rejects duplicate, escaping and malformed files', () => {
  const files = evidence().baseline.files;
  expect(sourceTreeDigest([...files].reverse())).toBe(sourceTreeDigest(files));
  for (const invalid of [null, [], [null], [...files, files[0]], [file('../escape.js', 'bad')],
    [file('/absolute.js', 'bad')], [{ ...files[0], bytes: -1 }], [{ ...files[0], sha256: 'claim' }]]) {
    expect(sourceTreeDigest(invalid)).toBeNull();
  }
});

test('CLI emits sanitized report and succeeds only with a full passing bundle', () => {
  for (const pass of [true, false]) {
    const e = evidence(); if (!pass) delete e.execution;
    const outputs = [];
    const code = main(['/tmp/synthetic-existing-app.json'], {
      read: () => Buffer.from(JSON.stringify(e)), write: value => outputs.push(value),
    });
    expect(code).toBe(pass ? 0 : 1);
    expect(JSON.parse(outputs[0]).passed).toBe(pass);
  }
});

test('raw secrets, authenticated URLs, IDs and exceptions never appear in reports', () => {
  const secrets = [randomBytes(24).toString('hex'), randomBytes(24).toString('hex')];
  const url = new URL('https://evidence.example.test/private');
  url.username = secrets[0]; url.password = secrets[1];
  const e = evidence(); e.contract.requirementId = secrets[0]; e.assistantText = url.href;
  e.errors = [url.href, secrets[1]]; e.persistenceReceipt.result.error = secrets[1];
  const outputs = [JSON.stringify(evaluate(e))];
  expect(main(['/tmp/synthetic-existing-app.json'], {
    read: () => { throw new Error(url.href); }, write: text => outputs.push(text),
  })).toBe(1);
  for (const output of outputs) {
    for (const secret of secrets) expect(output).not.toContain(secret);
    expect(output).not.toContain(url.href);
  }
});

test.each([[[]], [['relative.json']], [['/tmp/a', '/tmp/b']]])('CLI rejects invalid arguments: %j', args => {
  const read = jest.fn(); const write = jest.fn();
  expect(main(args, { read, write })).toBe(1); expect(read).not.toHaveBeenCalled();
});

test.each(['invalid', 'oversized'])('CLI rejects %s JSON', kind => {
  const bytes = kind === 'invalid' ? Buffer.from('invalid JSON') : Buffer.alloc(4 * 1024 * 1024 + 1);
  expect(main(['/tmp/synthetic-existing-app.json'], { read: () => bytes, write: jest.fn() })).toBe(1);
});