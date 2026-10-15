const { createHash } = require('node:crypto');

const MARKER = 'requirement-harness-canary-v1';
function fixtureId(runId, name) {
  if (!/^[a-z0-9-]{8,80}$/.test(runId)) throw new Error('Invalid canary run ID');
  const h = createHash('sha256').update(`${MARKER}:${runId}:${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function cases(runId) {
  const root = `.harness-e2e/${runId}`;
  const common = `Synthetic harness test. Work only under ${root}/. Do not push, deploy, install packages, provision services, contact anyone, or change files outside that directory. Use only local Python/standard library if needed. Do not fabricate command results. Finish with finish_task when the requested work is saved.`;
  const specs = [
    { id: '01-file', title: 'Write one exact file',
      request: `Create ${root}/hello.txt with exactly "hello harness\\n" (one trailing newline).`,
      files: { 'hello.txt': 'hello harness\n' }, deadlineSeconds: 300, requiredFailure: null, minimumCycles: 1 },
    { id: '02-repair', title: 'Fix addition after a failing test',
      request: `Write ${root}/sum.py initially as "def add(a, b): return a - b\\n". Run a Python assertion add(2,3)==5 and observe its failure. Replace the file with exactly "def add(a, b): return a + b\\n" and rerun the same assertion successfully.`,
      files: { 'sum.py': 'def add(a, b): return a + b\n' }, deadlineSeconds: 420, requiredFailure: 'assertion', minimumCycles: 1 },
    { id: '03-continue', title: 'Continue after a command error',
      request: `Run "python3 -c 'import sys; sys.exit(7)'" once. Despite exit 7, create ${root}/continued.txt with exactly "continued\\n". Do not repair or retry the intentionally failing command.`,
      files: { 'continued.txt': 'continued\n' }, deadlineSeconds: 300, requiredFailure: 'exit7', minimumCycles: 1 },
    { id: '04-resume', title: 'Resume after a cron boundary',
      request: `Create ${root}/before.txt containing "before\\n". Next run a foreground command "python3 -c 'import time; time.sleep(70)'" with timeoutMs=85000. Only in a subsequent tool call read before.txt and create ${root}/after.txt containing "before+after\\n". Keep the files; do not combine the sleep and the second write.`,
      files: { 'before.txt': 'before\n', 'after.txt': 'before+after\n' }, deadlineSeconds: 480, requiredFailure: null, minimumCycles: 2 },
    { id: '05-plan', title: 'Use the existing two-step plan',
      request: `Use the existing plan/backlog, without replacing them. Write ${root}/first.txt as "first\\n", mark its existing step/item done with requirement_progress, then write ${root}/second.txt as "second\\n" and mark the second existing step/item and plan completed.`,
      files: { 'first.txt': 'first\n', 'second.txt': 'second\n' }, deadlineSeconds: 420, requiredFailure: null, minimumCycles: 1 },
  ];
  return specs.map(spec => ({ ...spec, instructions: `${spec.request}\n${common}`, requirementId: fixtureId(runId, spec.id),
    instanceId: fixtureId(runId, `${spec.id}:instance`), planId: spec.id === '05-plan' ? fixtureId(runId, 'plan') : null,
    files: Object.fromEntries(Object.entries(spec.files).map(([name, content]) => [`${root}/${name}`, content])) }));
}
module.exports = { MARKER, fixtureId, cases };