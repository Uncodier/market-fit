const { randomUUID } = require('node:crypto');
const { fileEvidence } = require('../../scripts/harness-e2e/file-evidence.cjs');
const { cases } = require('../../scripts/harness-e2e/cases.cjs');
const { evaluateCase } = require('../../scripts/harness-e2e/evaluate.cjs');
const path = '.harness-e2e/offline-evidence/hello.txt';
function fixture() {
  const id = randomUUID(), workspace = randomUUID();
  const messages = [
    { role: 'assistant', toolCalls: [{ id: 'write', name: 'exec', arguments: JSON.stringify({ command: "python3 -c 'print(1)'" }) }] },
    { role: 'tool', toolCallId: 'write', content: '{"ok":true}' },
  ];
  const before = { complete: true, mapping: { session_id: id },
    session: { id, status: 'running', workspace: { id: workspace }, messages },
    files: { [path]: { state: 'read', bytes: 13, sha256: 'a'.repeat(64) } } };
  const after = structuredClone(before);
  after.session.status = 'completed';
  after.files[path] = { state: 'unavailable' };
  after.session.messages.push(
    { role: 'assistant', toolCalls: [{ id: 'finish', name: 'finish_task', arguments: '{}' }] },
    { role: 'tool', toolCallId: 'finish', content: '{"ok":true}' });
  return [before, after];
}
test('preserves an independent read after only finish and automatic suspension', () => {
  const samples = fixture();
  expect(fileEvidence(samples, path)).toBe(samples[0]);
});
test.each(['exec', 'apply_patch', 'unknown_tool', 'reconcile_operation'])('rejects evidence before a later %s call', name => {
  const samples = fixture(); samples[1].session.messages[2].toolCalls[0].name = name;
  expect(fileEvidence(samples, path)).toBe(samples[1]);
});
test.each(['(sleep 5; echo wrong > hello.txt) &', 'nohup python writer.py', 'python -c "import subprocess"', 'python -c "import threading"'])('rejects reads while detached writers may remain: %s', command => {
  const samples = fixture();
  samples[0].session.messages[0].toolCalls[0].arguments = JSON.stringify({ command });
  samples[1].session.messages[0] = structuredClone(samples[0].session.messages[0]);
  expect(fileEvidence(samples, path)).toBe(samples[1]);
});
test.each(['workspace', 'session', 'mapping', 'prefix', 'pending', 'incomplete', 'nonterminal'])('rejects %s discontinuity', kind => {
  const samples = fixture();
  if (kind === 'workspace') samples[1].session.workspace.id = randomUUID();
  if (kind === 'session') samples[1].session.id = randomUUID();
  if (kind === 'mapping') samples[1].mapping.session_id = randomUUID();
  if (kind === 'prefix') samples[1].session.messages[0].toolCalls[0].arguments = '{"changed":true}';
  if (kind === 'pending') samples[0].session.messages.pop();
  if (kind === 'incomplete') samples[0].complete = false;
  if (kind === 'nonterminal') samples[1].session.status = 'running';
  expect(fileEvidence(samples, path)).toBe(samples[1]);
});
test.each(['read', 'missing'])('does not replace a newer %s with old matching bytes', state => {
  const samples = fixture(); samples[1].files[path] = { state, bytes: 14, sha256: 'b'.repeat(64) };
  expect(fileEvidence(samples, path)).toBe(samples[1]);
});
test('does not search past a newer missing file', () => {
  const samples = fixture(), missing = structuredClone(samples[0]); missing.files[path] = { state: 'missing' };
  samples.splice(1, 0, missing);
  expect(fileEvidence(samples, path)).toBe(samples[2]);
});

test('evaluator retains exact hash checks after suspension, including literal backslash-n rejection', () => {
  const spec = cases('offline-evidence')[0], samples = fixture();
  const hash = text => require('node:crypto').createHash('sha256').update(text).digest('hex');
  for (const sample of samples) {
    sample.observedAt = '2026-10-29T00:01:00Z';
    sample.requirement = { id: spec.requirementId, status: 'on-review', created_at: '2026-10-29T00:00:00Z' };
    sample.credits = 0;
    Object.assign(sample.session, { turns: 1, allocatedTokens: 100, activeMs: 1000 });
    sample.mapping.last_cycle_id = 'agent:cycle-one';
    sample.session.messages[1].content = '{"ok":true,"output":{"exitCode":0}}';
  }
  samples[0].files[path] = { state: 'read', bytes: Buffer.byteLength('hello harness\n'), sha256: hash('hello harness\n') };
  expect(evaluateCase(spec, samples).state).toBe('passed');
  samples[0].files[path] = { state: 'read', bytes: Buffer.byteLength('hello harness\\n'), sha256: hash('hello harness\\n') };
  expect(evaluateCase(spec, samples).state).toBe('failed');
});

test('canonical nested exit-7 failure remains a failure receipt, not successful work', () => {
  const spec = cases('offline-evidence')[2], samples = fixture();
  const { createHash } = require('node:crypto');
  for (const sample of samples) {
    sample.observedAt = '2026-10-29T00:01:00Z'; sample.credits = 0;
    sample.requirement = { id: spec.requirementId, status: 'on-review', created_at: '2026-10-29T00:00:00Z' };
    Object.assign(sample.session, { turns: 1, allocatedTokens: 100, activeMs: 1000 });
    sample.mapping.last_cycle_id = 'agent:cycle-one';
  }
  const messages = [
    { role: 'assistant', toolCalls: [{ id: 'fail', name: 'exec', arguments: JSON.stringify({ command: "python3 -c 'import sys; sys.exit(7)'" }) }] },
    { role: 'tool', toolCallId: 'fail', content: JSON.stringify({ ok: false, output: { ok: false, output: { exitCode: 7 } }, error: { ambiguous: true } }) },
    { role: 'assistant', toolCalls: [{ id: 'write', name: 'apply_patch', arguments: '{}' }] },
    { role: 'tool', toolCallId: 'write', content: '{"ok":true}' },
  ];
  samples[1].session.messages = messages;
  samples[1].files = Object.fromEntries(Object.entries(spec.files).map(([name, text]) =>
    [name, { state: 'read', bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') }]));
  expect(evaluateCase(spec, [samples[1]]).state).toBe('passed');
  messages[3].content = '{"ok":false,"output":{"ok":true}}';
  expect(evaluateCase(spec, [samples[1]]).state).not.toBe('passed');
});