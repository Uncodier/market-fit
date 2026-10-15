const { randomBytes, createHash } = require('node:crypto');
const { observeCase } = require('../../scripts/harness-e2e/observe.cjs');
const { cases, MARKER } = require('../../scripts/harness-e2e/cases.cjs');

const run = { id: 'offline-observer-run', siteId: 'site-test', userId: 'user-test', startedAt: '2026-10-14T00:00:00Z' };
const spec = cases(run.id)[0];
const path = Object.keys(spec.files)[0];
const sha256 = createHash('sha256').update(spec.files[path]).digest('hex');

// This mock is intentionally hostile: any unknown table, mutation, RPC, auth or
// control API throws immediately, and every query operation is recorded.
function database(allowed, tables, calls) {
  return new Proxy({}, {
    get(_target, key) {
      if (key !== 'from') throw new Error('Forbidden database capability');
      return table => {
        if (!allowed.includes(table)) throw new Error('Forbidden table');
        const call = { table, operations: [] }; calls.push(call);
        let range;
        const chain = new Proxy({}, {
          get(_object, method) {
            if (method === 'then') return (resolve, reject) => Promise.resolve().then(() => {
              const response = tables[table];
              if (response instanceof Error) throw response;
              if (response?.error) return response;
              const data = typeof response === 'function' ? response(call) : response;
              return { data: range && Array.isArray(data) ? data.slice(range[0], range[1] + 1) : data, error: null };
            }).then(resolve, reject);
            if (!['select', 'eq', 'order', 'range', 'maybeSingle'].includes(method)) throw new Error('Forbidden mutation');
            return (...args) => {
              call.operations.push([method, ...args]);
              if (method === 'range') range = args;
              return chain;
            };
          },
        });
        return chain;
      };
    },
  });
}

function fixture() {
  const tables = {
    requirements: { id: spec.requirementId, site_id: run.siteId, user_id: run.userId, status: 'in-progress',
      created_at: run.startedAt, backlog: [], metadata: { runner_instance_id: spec.instanceId, harness_e2e: { marker: MARKER, run_id: run.id, case_id: spec.id } } },
    harness_requirement_runs: { requirement_id: spec.requirementId, site_id: run.siteId, session_id: 'session-test', generation: 1, last_cycle_id: 'cycle-test' },
    harness_sessions: { snapshot: { id: 'session-test', request: { requirementId: spec.requirementId, objective: 'Private objective' },
      messages: [], status: 'running', turns: 2, allocatedTokens: 300, activeMs: 500,
      createdAt: run.startedAt, updatedAt: run.startedAt, workspace: { id: 'workspace-test', provider: 'vercel', root: '/workspace' } } },
    requirement_status: [{ id: 'status-test', stage: 'in-progress', cycle: 1, created_at: run.startedAt, message: 'Starting' }],
    instance_plans: [], credit_transactions: [{ amount: -2.5 }, { amount: 100 }, { amount: -1 }],
  };
  const userCalls = []; const adminCalls = [];
  const deps = {
    client: database(['requirements', 'requirement_status', 'instance_plans', 'credit_transactions'], tables, userCalls),
    observer: database(['harness_requirement_runs', 'harness_sessions'], tables, adminCalls),
    readFiles: jest.fn(async () => [{ path, state: 'read', sha256, bytes: Buffer.byteLength(spec.files[path]) }]),
    now: () => new Date(run.startedAt), redact: text => text,
  };
  return { tables, deps, userCalls, adminCalls, observe: () => observeCase(spec, run, deps) };
}

test('uses scoped read-only queries, validates session, and reports monetary debits only', async () => {
  const f = fixture(); const result = await f.observe();
  expect(result).toMatchObject({ complete: true, errors: [], credits: 3.5, observedAt: new Date(run.startedAt).toISOString() });
  expect(result.files).toEqual({ [path]: { state: 'read', sha256, bytes: Buffer.byteLength(spec.files[path]) } });
  expect(f.userCalls[0].operations).toEqual([
    ['select', 'id,site_id,user_id,status,created_at,backlog,metadata,cron_lock_run_id,cron_lock_expires_at,cron_lock_active'],
    ['eq', 'id', spec.requirementId], ['eq', 'site_id', run.siteId], ['eq', 'user_id', run.userId], ['maybeSingle'],
  ]);
  expect(f.adminCalls[0].operations).toEqual([
    ['select', 'requirement_id,site_id,session_id,generation,last_cycle_id'],
    ['eq', 'requirement_id', spec.requirementId], ['eq', 'site_id', run.siteId], ['maybeSingle'],
  ]);
  expect(f.adminCalls[1].operations).toEqual([
    ['select', 'snapshot'], ['eq', 'id', 'session-test'], ['eq', 'site_id', run.siteId], ['eq', 'user_id', run.userId], ['maybeSingle'],
  ]);
  expect(f.userCalls.find(call => call.table === 'instance_plans').operations).toEqual([
    ['select', 'id,status,steps'], ['eq', 'site_id', run.siteId], ['eq', 'instance_id', spec.instanceId], ['eq', 'metadata->>requirement_id', spec.requirementId],
  ]);
  expect(f.userCalls.find(call => call.table === 'credit_transactions').operations).toContainEqual(['eq', 'metadata->>session_id', 'session-test']);
  expect(f.deps.readFiles).toHaveBeenCalledWith(result.session, spec);
  expect(result.session.request).toBeUndefined();
});

test.each(['id', 'site_id', 'user_id', 'marker', 'run_id', 'case_id', 'extra'])('rejects foreign/unmarked requirement %s before any admin read', async field => {
  const f = fixture();
  if (['id', 'site_id', 'user_id'].includes(field)) f.tables.requirements[field] = 'foreign';
  else f.tables.requirements.metadata.harness_e2e[field] = 'foreign';
  const result = await f.observe();
  expect(result.errors).toEqual(['REQUIREMENT_UNVERIFIED']);
  expect(f.adminCalls).toEqual([]); expect(f.deps.readFiles).not.toHaveBeenCalled();
});

test.each(['mapping', 'session', 'snapshot-id'])('rejects foreign %s without reading files', async kind => {
  const f = fixture();
  if (kind === 'mapping') f.tables.harness_requirement_runs.site_id = 'foreign';
  else if (kind === 'session') f.tables.harness_sessions.snapshot.request.requirementId = 'foreign';
  else f.tables.harness_sessions.snapshot.id = 'foreign';
  expect((await f.observe()).complete).toBe(false);
  expect(f.deps.readFiles).not.toHaveBeenCalled();
  if (kind === 'mapping') expect(f.adminCalls).toHaveLength(1);
});

test.each([undefined, 'foreign-instance'])('rejects missing or mismatched runner instance %s before admin access', async instanceId => {
  const f = fixture();
  if (instanceId === undefined) delete f.tables.requirements.metadata.runner_instance_id;
  else f.tables.requirements.metadata.runner_instance_id = instanceId;
  const result = await f.observe();
  expect(result).toMatchObject({ requirement: null, complete: false, errors: ['REQUIREMENT_UNVERIFIED'] });
  expect(f.adminCalls).toEqual([]);
  expect(f.deps.readFiles).not.toHaveBeenCalled();
});

test.each(['harness_requirement_runs', 'harness_sessions'])('pending missing %s is not a permanent error', async table => {
  const f = fixture(); f.tables[table] = null;
  expect(await f.observe()).toMatchObject({ session: null, credits: null, complete: true, errors: [] });
  expect(f.deps.readFiles).not.toHaveBeenCalled();
});

test('missing session table fails closed and never tries private tables', async () => {
  const f = fixture(); f.tables.harness_sessions = { error: { code: '42P01', message: randomBytes(24).toString('hex') } };
  expect(await f.observe()).toMatchObject({ session: null, complete: false, errors: ['SESSION_UNAVAILABLE'] });
  expect(f.adminCalls.map(call => call.table)).toEqual(['harness_requirement_runs', 'harness_sessions']);
});

test('paginates statuses with deterministic scoped ordering and credits up to bounded pages', async () => {
  const f = fixture();
  f.tables.requirement_status = Array.from({ length: 205 }, (_, id) => ({ id: `status-${id}`, stage: 'unknown', created_at: 'unknown', message: 'Unknown log' }));
  f.tables.credit_transactions = Array.from({ length: 201 }, () => ({ amount: -0.5 }));
  const result = await f.observe(); expect(result.statuses).toHaveLength(205); expect(result.credits).toBe(100.5);
  const calls = f.userCalls.filter(call => call.table === 'requirement_status');
  expect(calls.map(call => call.operations.at(-1))).toEqual([['range', 0, 99], ['range', 100, 199], ['range', 200, 299]]);
  calls.forEach(call => {
    expect(call.operations).toContainEqual(['eq', 'site_id', run.siteId]);
    expect(call.operations).toContainEqual(['eq', 'requirement_id', spec.requirementId]);
    expect(call.operations).toContainEqual(['order', 'created_at', { ascending: true }]);
    expect(call.operations).toContainEqual(['order', 'id', { ascending: true }]);
  });
  expect(result.statuses[0]).toMatchObject({ stage: 'unknown', created_at: 'unknown', message: 'Unknown log' });
});

test.each([['requirement_status', 1000, 'STATUSES_UNAVAILABLE_LIMIT'], ['credit_transactions', 500, 'CREDITS_UNAVAILABLE_LIMIT']])('fails closed at %s pagination bound', async (table, count, code) => {
  const f = fixture(); f.tables[table] = Array.from({ length: count }, () => ({ amount: -1 }));
  const result = await f.observe(); expect(result.errors).toContain(code); expect(result.complete).toBe(false);
  expect(f.userCalls.filter(call => call.table === table)).toHaveLength(count / 100);
  if (table === 'credit_transactions') expect(result.credits).toBeNull();
});

test.each(['credit_transactions', 'instance_plans', 'requirement_status'])('does not bypass RLS on %s errors or expose provider errors', async table => {
  const f = fixture(); const sensitive = randomBytes(24).toString('hex'); f.tables[table] = new Error(sensitive);
  const result = await f.observe(); expect(result.complete).toBe(false); expect(JSON.stringify(result)).not.toContain(sensitive);
  expect(f.adminCalls.map(call => call.table)).toEqual(['harness_requirement_runs', 'harness_sessions']);
  if (table === 'credit_transactions') expect(result.credits).toBeNull();
});

test.each([NaN, Infinity, '-3', null])('invalid monetary amount %s remains unknown', async amount => {
  const f = fixture(); f.tables.credit_transactions = [{ amount }];
  expect(await f.observe()).toMatchObject({ credits: null, complete: false, errors: ['CREDITS_INVALID'] });
});

test('redacts synthetic credentials in messages/logs but strips private request/config/metadata', async () => {
  const f = fixture(); const values = Array.from({ length: 4 }, () => randomBytes(24).toString('hex'));
  const url = new URL('https://observer.example.test/'); url.username = values[0]; url.password = values[1]; url.searchParams.set('token', values[2]);
  f.tables.harness_sessions.snapshot.request.profile = values[3];
  f.tables.harness_sessions.snapshot.config = values[3];
  f.tables.requirements.metadata.private = values[3];
  f.tables.harness_sessions.snapshot.messages = [{ role: 'tool', toolCallId: 'call-test', content: JSON.stringify({ ok: true, output: url.toString() }) }];
  f.tables.requirement_status[0].message = values.join(' ');
  f.deps.redact = text => values.reduce((output, value) => output.replaceAll(value, '[REDACTED]'), text);
  const result = await f.observe(); const serialized = JSON.stringify(result);
  values.forEach(value => expect(serialized).not.toContain(value));
  expect(result.session).not.toHaveProperty('config'); expect(result.session).not.toHaveProperty('request');
  expect(JSON.parse(result.session.messages[0].content).ok).toBe(true);
  expect(result.requirement.metadata).toEqual({ harness_e2e: { marker: MARKER, run_id: run.id, case_id: spec.id } });
});

test('truncated tool receipt is blocked without fetching lease-protected artifacts', async () => {
  const f = fixture(); f.tables.harness_sessions.snapshot.messages = [{ role: 'tool', content: JSON.stringify({ output: { truncated: true, artifact: { id: 'artifact-test' } } }) }];
  expect(await f.observe()).toMatchObject({ complete: false, errors: ['ARTIFACT_UNAVAILABLE'] });
});

test.each(['bytes', 'messages'])('oversized snapshot %s is not silently truncated', async kind => {
  const f = fixture(); f.tables.harness_sessions.snapshot.messages = kind === 'bytes'
    ? [{ role: 'tool', content: 'x'.repeat(4 * 1024 * 1024) }] : Array.from({ length: 10001 }, () => ({ role: 'tool', content: '{}' }));
  expect(await f.observe()).toMatchObject({ session: null, complete: false, errors: ['SESSION_LIMIT'] });
  expect(f.deps.readFiles).not.toHaveBeenCalled();
});

test.each(['workspace', 'missing', 'unavailable', 'throw', 'invalid'])('active file %s observations are transient, content-free states', async kind => {
  const f = fixture();
  if (kind === 'workspace') delete f.tables.harness_sessions.snapshot.workspace;
  else if (kind === 'throw') f.deps.readFiles.mockRejectedValue(new Error(randomBytes(24).toString('hex')));
  else f.deps.readFiles.mockResolvedValue([{ path, state: kind, content: 'Never returned', sha256: 'invalid', bytes: 5 }]);
  const result = await f.observe(); expect(result.complete).toBe(true); expect(result.errors).toEqual([]);
  expect(result.files).toEqual({ [path]: { state: kind === 'missing' ? 'missing' : 'unavailable' } });
  if (kind === 'workspace') expect(f.deps.readFiles).not.toHaveBeenCalled();
});

test('unknown observation time and missing redactor fail closed without database reads', async () => {
  const f = fixture(); f.deps.now = () => 'unknown';
  expect((await f.observe()).complete).toBe(false); expect(f.userCalls).toEqual([]);
  f.deps.now = () => new Date(); delete f.deps.redact;
  expect((await f.observe()).errors).toEqual(['OBSERVATION_INPUT_INVALID']); expect(f.userCalls).toEqual([]);
});

test('normalizes keyed file oracle results and discards extra paths and content', async () => {
  const f = fixture(); const value = randomBytes(24).toString('hex');
  f.deps.readFiles.mockResolvedValue({ [path]: { state: 'read', sha256, bytes: 14, content: value },
    unrelated: { state: 'read', sha256, bytes: 0 } });
  const result = await f.observe();
  expect(result.files).toEqual({ [path]: { state: 'read', sha256, bytes: 14 } });
  expect(JSON.stringify(result)).not.toContain(value);
});