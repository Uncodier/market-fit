const { MARKER, cases } = require('./cases.cjs');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function repository(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port || url.search || url.hash ||
    !/^\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.git$/.test(url.pathname)) throw new Error('Use an explicitly acknowledged GitHub HTTPS .git repository');
  const [org, repo] = url.pathname.slice(1, -4).split('/');
  return { url: url.href, org, repo, kind: 'custom', default_branch: 'main' };
}
function makeRun({ id, settings, userId, repoUrl, sourceSha, apiSourceSha }) {
  if (!uuid.test(userId)) throw new Error('Invalid authenticated identity');
  return { schemaVersion: 1, marker: MARKER, id, siteId: settings.siteId, userId, backend: settings.url,
    startedAt: new Date().toISOString(), sourceSha, apiSourceSha, deployedSha: settings.deployedSha,
    repository: repository(repoUrl), cases: cases(id), state: 'prepared', maxCredits: 2, maxSeconds: 1500 };
}
function payloads(run, spec) {
  const metadata = { harness_e2e: { marker: MARKER, run_id: run.id, case_id: spec.id },
    git: { kind: run.repository.kind, org: run.repository.org, repo: run.repository.repo, default_branch: run.repository.default_branch },
    runner_instance_id: spec.instanceId };
  const backlog = { items: spec.planId ? ['first', 'second'].map((id, order) => ({ id, title: `Write ${id}.txt`, kind: 'feature', phase_id: 'e2e',
    status: 'pending', attempts: 0, acceptance: [`The ${id}.txt content is exactly ${id} plus one newline.`], order })) : [] };
  return {
    runner: { id: spec.instanceId, name: `harness-e2e-${run.id}-${spec.id}`, instance_type: 'browser', status: 'pending',
      site_id: run.siteId, user_id: run.userId, created_by: run.userId, metadata: { harness_e2e: metadata.harness_e2e } },
    requirement: { id: spec.requirementId, site_id: run.siteId, user_id: run.userId, title: `[Harness E2E ${run.id}] ${spec.title}`,
      description: spec.request, instructions: spec.instructions, status: 'validated', type: 'task', priority: 'low',
      source: 'harness-e2e', completion_status: 'pending', budget: run.maxCredits / 5, cron: null, metadata, backlog },
    plan: spec.planId ? { id: spec.planId, instance_id: spec.instanceId, site_id: run.siteId, user_id: run.userId,
      title: 'Existing two-step harness canary plan', plan_type: 'task', status: 'pending', steps_total: 2, steps_completed: 0,
      metadata: { requirement_id: spec.requirementId, harness_e2e: metadata.harness_e2e }, steps: ['first', 'second'].map((id, order) => ({
        id: `${id}-step`, order, title: `Write ${id}.txt`, description: `Create the exact ${id}.txt fixture and record progress.`,
        status: 'pending', metadata: { backlog_item_id: id } })) } : null,
  };
}
function assertFixture(row, run, spec) {
  const tag = row?.metadata?.harness_e2e;
  if (row?.id !== spec.requirementId || row.site_id !== run.siteId || row.user_id !== run.userId ||
    tag?.marker !== MARKER || tag.run_id !== run.id || tag.case_id !== spec.id || row.metadata.runner_instance_id !== spec.instanceId ||
    row.instructions !== spec.instructions || row.metadata.git?.org !== run.repository.org || row.metadata.git?.repo !== run.repository.repo || row.cron !== null) throw new Error('Fixture collision or changed requirement scope');
}
async function seed(run, { client }) {
  // Never retry ambiguous inserts. All fixtures start non-runnable until explicit activation.
  for (const spec of run.cases) {
    const p = payloads(run, spec);
    const existing = await client.from('requirements').select('id,site_id,user_id,metadata,instructions,cron,status')
      .eq('id', spec.requirementId).eq('site_id', run.siteId).maybeSingle();
    if (existing.error) throw new Error('Fixture lookup failed');
    if (existing.data) { assertFixture(existing.data, run, spec); continue; }
    const runner = await client.from('remote_instances').select('id,site_id,user_id,metadata').eq('id', spec.instanceId).eq('site_id', run.siteId).maybeSingle();
    if (runner.error) throw new Error('Runner lookup failed');
    if (runner.data) {
      if (runner.data.user_id !== run.userId || runner.data.metadata?.harness_e2e?.run_id !== run.id) throw new Error('Runner identity collision');
    } else {
      const result = await client.from('remote_instances').insert(p.runner);
      if (result.error) throw new Error('Runner creation unconfirmed; inspect before rerunning');
    }
    const inserted = await client.from('requirements').insert(p.requirement).select('id,site_id,user_id,metadata,instructions,cron,status').single();
    if (inserted.error || !inserted.data) throw new Error('Requirement creation unconfirmed; inspect before rerunning');
    assertFixture(inserted.data, run, spec);
    if (p.plan) {
      const result = await client.from('instance_plans').insert(p.plan);
      if (result.error) throw new Error('Plan creation unconfirmed; do not activate the partial fixture');
    }
  }
  // Confirm the pre-existing plan, including after a partially successful setup.
  const spec = run.cases.find(c => c.planId);
  const result = await client.from('instance_plans').select('id,steps,metadata').eq('id', spec.planId)
    .eq('site_id', run.siteId).eq('instance_id', spec.instanceId).maybeSingle();
  if (result.error || result.data?.metadata?.requirement_id !== spec.requirementId || result.data?.steps?.length !== 2) throw new Error('Pre-existing plan fixture not confirmed');
}
async function transition(run, spec, client, status) {
  if (!['backlog', 'blocked'].includes(status)) throw new Error('Unsupported fixture transition');
  const current = await client.from('requirements').select('id,site_id,user_id,metadata,instructions,cron,status')
    .eq('id', spec.requirementId).eq('site_id', run.siteId).eq('user_id', run.userId).maybeSingle();
  if (current.error) throw new Error('Fixture state unavailable');
  assertFixture(current.data, run, spec);
  if (status === 'backlog' && current.data.status !== 'validated') throw new Error('Fixture already activated; refuse replay');
  if (status === 'blocked' && ['done', 'on-review', 'cancelled', 'canceled'].includes(current.data.status)) return;
  const result = await client.from('requirements').update({ status }).eq('id', spec.requirementId)
    .eq('site_id', run.siteId).eq('user_id', run.userId).eq('status', current.data.status)
    .eq('metadata->harness_e2e->>run_id', run.id).select('id,status').single();
  if (result.error || result.data?.status !== status) throw new Error('Fixture transition unconfirmed');
}
module.exports = { repository, makeRun, payloads, seed, transition, assertFixture };