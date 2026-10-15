const { randomUUID } = require('node:crypto');
const { cases, fixtureId, MARKER } = require('../../scripts/harness-e2e/cases.cjs');
const { options, validateManifest, preflight } = require('../../scripts/harness-e2e/run.cjs');
const { makeRun, payloads, repository, assertFixture, transition } = require('../../scripts/harness-e2e/fixtures.cjs');

const settings = { url: 'https://testproject.supabase.co', siteId: randomUUID(), deployedSha: null };
const run = () => makeRun({ id: 'canary-offline-123', settings, userId: randomUUID(), repoUrl: 'https://github.com/example/canary.git', sourceSha: 'a'.repeat(40), apiSourceSha: 'b'.repeat(40) });

it('defines exactly five short, unique, scoped requirements and deterministic IDs', () => {
  const specs = cases('canary-offline-123');
  expect(specs).toHaveLength(5); expect(new Set(specs.map(c => c.requirementId)).size).toBe(5);
  for (const spec of specs) {
    expect(spec.request.length).toBeLessThan(500);
    expect(spec.instructions).toContain('Do not push, deploy');
    expect(spec.requirementId).toBe(fixtureId('canary-offline-123', spec.id));
    for (const file of Object.keys(spec.files)) expect(file).toMatch(/^\.harness-e2e\/canary-offline-123\//);
  }
});
it.each(['../escape', 'UPPERCASE', 'short', 'x/y/z/abcdefgh'])('rejects unsafe run IDs: %s', id => expect(() => cases(id)).toThrow());
it.each(['https://evil.invalid/a/b.git', 'http://github.com/a/b.git', 'https://github.com/a/b.git?token=x', 'https://github.com/a/b.git#fragment'])('rejects unintended repository destinations: %s', url => expect(() => repository(url)).toThrow());
it('does not enable the existing mutating browser suites or allow accidental live execution', () => {
  expect(options([])).toEqual({ mode: 'list' });
  expect(() => options(['run', '--run-id', 'canary-offline-123'])).toThrow();
  expect(() => options(['prepare', '--run-id', 'canary-offline-123', '--ack-observer-service-role', '--ack-production-canary'])).toThrow();
  expect(() => options(['observe', '--run-id', '../escape', '--ack-observer-service-role'])).toThrow();
  expect(() => options(['run', '--unknown'])).toThrow();
  expect(options(['observe', '--run-id', 'canary-offline-123', '--ack-observer-service-role'])).toMatchObject({ mode: 'observe' });
});
it('seeds non-runnable requirements and a real existing plan without scheduler execution', () => {
  const r = run();
  for (const spec of r.cases) {
    const p = payloads(r, spec);
    expect(p.requirement.status).toBe('validated'); expect(p.requirement.cron).toBeNull();
    expect(p.requirement.completion_status).toBe('pending');
    expect(p.requirement.metadata.harness_e2e).toEqual({ marker: MARKER, run_id: r.id, case_id: spec.id });
    expect(p.requirement.metadata.runner_instance_id).toBe(p.runner.id);
    if (spec.planId) { expect(p.plan.steps).toHaveLength(2); expect(p.requirement.backlog.items).toHaveLength(2); }
  }
});
it('rejects tampered manifests, foreign scope and changed test definitions', () => {
  const r = run(); expect(() => validateManifest(r, settings, r.userId)).not.toThrow();
  expect(() => validateManifest(r, { ...settings, siteId: randomUUID() }, r.userId)).toThrow();
  r.cases[0].files['.env'] = 'unsafe'; expect(() => validateManifest(r, settings, r.userId)).toThrow();
  const other = run(); other.maxCredits = 200; expect(() => validateManifest(other, settings, other.userId)).toThrow();
});
it('does not touch a foreign or repurposed requirement during stop/activation', async () => {
  const r = run(), spec = r.cases[0], row = payloads(r, spec).requirement;
  expect(() => assertFixture(row, r, spec)).not.toThrow(); row.user_id = randomUUID();
  const update = jest.fn(); const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row }), update };
  await expect(transition(r, spec, { from: () => q }, 'blocked')).rejects.toThrow(); expect(update).not.toHaveBeenCalled();
});
it('reports funding and observer prerequisites as blocked rather than a successful skip', async () => {
  const q = { select: () => q, eq: () => q, limit: async () => ({ data: [] }), maybeSingle: async () => ({ data: { credits_available: 0 } }) };
  const report = await preflight({ ...settings, credentials: {} }, { client: { from: () => q }, observer: { from: () => q } });
  expect(report.passed).toBe(false); expect(report.blockers).toEqual(['funded', 'sandboxCredentials', 'sandboxAccess']);
  expect(report.deploymentVerified).toBe(false);
});