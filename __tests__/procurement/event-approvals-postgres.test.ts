/** @jest-environment node */
import { ids, actors, isolatedPostgres, postgresAvailable, installStorageFixture, sqlJson, saveSql } from './storage-fixture'
import { actorSql, migration, uuid } from '../security/isolated-postgres'
import { defaultPolicyDocument, approvalStageSchema, evaluateProcurementPolicy } from '@/app/purchases/procurement/domain'

const describePg = postgresAvailable ? describe : describe.skip
jest.setTimeout(180000)
describePg('publication approval isolation and atomic release', () => {
  const pg = isolatedPostgres()
  const tenderId = uuid(700)
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    installStorageFixture(pg)
    pg.db(`CREATE FUNCTION public.user_can(p_site_id uuid,p_command text) RETURNS boolean LANGUAGE sql AS $$ SELECT public.current_user_site_role(p_site_id) IS NOT NULL $$;
      CREATE TABLE public.procurement_tenders(id uuid PRIMARY KEY,site_id uuid,version integer,status text);
      INSERT INTO public.procurement_tenders VALUES('${tenderId}','${ids.site}',1,'draft');
      CREATE TABLE public.release_log(id uuid PRIMARY KEY,actor_id uuid);
      CREATE FUNCTION public.procurement_materialize_tender_publication(p_site uuid,p_id uuid,p_version integer,p_actor uuid) RETURNS uuid
        LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
        IF NOT EXISTS(SELECT 1 FROM public.procurement_tenders WHERE id=p_id AND site_id=p_site AND version=p_version AND status='draft') THEN
          RAISE EXCEPTION 'Changed tender' USING ERRCODE='40001'; END IF;
        INSERT INTO public.release_log VALUES(p_id,p_actor);
        UPDATE public.procurement_tenders SET status='published' WHERE id=p_id;
        RETURN p_id; END $$;
      REVOKE ALL ON FUNCTION public.procurement_materialize_tender_publication(uuid,uuid,integer,uuid) FROM PUBLIC,anon,authenticated,service_role;`)
    pg.db(migration('20261027172002_procurement_event_approvals.sql'))
    pg.db(migration('20261028200000_procurement_default_manager_decisions.sql'))
    pg.db(migration('20261030160000_procurement_decision_replay.sql'))
  })
  function setup(automatic = false) {
    const document = defaultPolicyDocument()
    document.settings.fallback = { mode: 'approval', stages: [approvalStageSchema.parse({
      id: 'review', name: 'Release review', decisionMode: automatic ? 'automatic_ai' : 'human',
      approverIds: automatic ? [] : [ids.admin], delegatedAgentId: automatic ? uuid(777) : null,
      quorum: { mode: 'first_response' }, rejectionBehavior: 'veto', execution: 'parallel', allowSelfApproval: false, timeoutAction: 'block',
    })] }
    pg.call(saveSql(0, document))
    return evaluateProcurementPolicy(document, { event: 'publication', currency: 'USD', netAmountMinor: 100,
      evaluatedAt: new Date().toISOString(), requesterId: ids.owner })
  }
  const create = (plan: unknown, version=1) => `SELECT public.create_procurement_event_approval('${ids.site}','${tenderId}',${version},'publication','${ids.owner}',1,${sqlJson(plan)});`
  const vote = (approval: string, stage: string, decision='approve') => `SELECT public.decide_procurement_event('${ids.site}','${approval}','${stage}','${decision}','Reviewed');`
  test.each(['policy', 'tender'])('blocks the first quorum vote after a %s revision change', changed => {
    pg.db(migration('20261029120000_procurement_deprecated_approvals.sql'))
    const plan = setup()
    plan.stages[0].approverIds = [ids.admin, ids.owner]
    plan.stages[0].quorum = { mode: 'all' }
    const approval = pg.call(create(plan), ids.owner, 'service_role')
    const stage = pg.db(`SELECT id FROM procurement_event_stages WHERE approval_id='${approval}'`)
    if (changed === 'policy') pg.call(saveSql(1, defaultPolicyDocument()))
    else pg.db(`UPDATE procurement_tenders SET version=2 WHERE id='${tenderId}'`)
    expect(() => pg.call(vote(approval, stage), ids.admin)).toThrow(changed === 'policy' ? /Policy changed/ : /Tender version conflict/)
    expect(pg.db('SELECT count(*) FROM procurement_event_decisions')).toBe('0')
    expect(pg.db(`SELECT status FROM procurement_event_approvals WHERE id='${approval}'`)).toBe('pending')
    expect(pg.db('SELECT count(*) FROM release_log')).toBe('0')
  })
  function generatedDefault(legacy = true, custom = false) {
    const document = defaultPolicyDocument()
    document.settings.fallback = { mode: 'approval', stages: [approvalStageSchema.parse({
      id: legacy ? 'workspace-owner' : 'workspace-managers',
      name: legacy ? 'Workspace owner approval' : 'Workspace owner or admin approval',
      decisionMode: 'human', approverIds: [ids.owner], mandatoryApproverIds: legacy ? [ids.owner] : [],
      quorum: { mode: legacy ? 'all' : 'first_response' }, rejectionBehavior: 'veto',
      execution: 'parallel', allowSelfApproval: true, timeoutAction: 'block',
    })] }
    if (custom) document.settings.allowGlobalListing = true
    pg.call(saveSql(0, document))
    const plan = evaluateProcurementPolicy(document, { event: 'publication', currency: 'USD', netAmountMinor: 100,
      evaluatedAt: new Date().toISOString(), requesterId: ids.owner })
    const approval = pg.call(create(plan), ids.owner, 'service_role')
    const stage = pg.db(`SELECT id FROM public.procurement_event_stages WHERE approval_id='${approval}'`)
    return { approval, stage }
  }
  test.each([true, false])('current admins can explicitly approve generated defaults, legacy=%s', legacy => {
    const { approval, stage } = generatedDefault(legacy)
    const original = pg.db(`SELECT definition FROM public.procurement_event_stages WHERE id='${stage}'`)
    pg.call(vote(approval, stage), ids.admin)
    expect(pg.db('SELECT count(*) FROM public.release_log')).toBe('1')
    expect(pg.db('SELECT actor_id FROM public.procurement_event_decisions')).toBe(ids.admin)
    expect(pg.db(`SELECT definition FROM public.procurement_event_stages WHERE id='${stage}'`)).toBe(original)
  })
  test.each([actors.member, actors.unlicensed, actors.restricted, ids.inactive, ids.foreign])(
    'generated default denies unauthorized actor %s', actor => {
      const { approval, stage } = generatedDefault()
      expect(() => pg.call(vote(approval, stage), actor)).toThrow(/Access denied|current manager/)
      expect(pg.db('SELECT count(*) FROM public.procurement_event_decisions')).toBe('0')
    },
  )
  test('admin cannot bypass a customized owner-only policy even with the generated stage name', () => {
    const { approval, stage } = generatedDefault(true, true)
    expect(() => pg.call(vote(approval, stage), ids.admin)).toThrow(/Ineligible/)
    expect(pg.db('SELECT count(*) FROM public.release_log')).toBe('0')
  })
  test('revoked admin role cannot use an old generated assignment', () => {
    const { approval, stage } = generatedDefault(false)
    pg.db(`UPDATE public.fixture_members SET role='member' WHERE user_id='${ids.admin}'`)
    expect(() => pg.call(vote(approval, stage), ids.admin)).toThrow(/current manager/)
  })
  test('admin rejection of a legacy default does not publish', () => {
    const { approval, stage } = generatedDefault()
    pg.db(`UPDATE public.procurement_tenders SET version=2 WHERE id='${tenderId}'`)
    pg.call(vote(approval, stage, 'reject'), ids.admin)
    expect(pg.db('SELECT status FROM public.procurement_event_approvals')).toBe('rejected')
    expect(pg.db('SELECT count(*) FROM public.release_log')).toBe('0')
  })
  test('the owner can still approve their own generated default explicitly', () => {
    const { approval, stage } = generatedDefault()
    pg.call(vote(approval, stage), ids.owner)
    expect(pg.db('SELECT actor_id FROM public.procurement_event_decisions')).toBe(ids.owner)
    expect(pg.db('SELECT count(*) FROM public.release_log')).toBe('1')
  })
  test('obsolete default policy rolls back the final vote when revision revalidation is installed', () => {
    const { approval, stage } = generatedDefault()
    pg.db(`CREATE OR REPLACE FUNCTION public.finalize_procurement_event(p_id uuid) RETURNS void
      LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
      DECLARE a public.procurement_event_approvals;
      BEGIN
        SELECT * INTO STRICT a FROM public.procurement_event_approvals WHERE id=p_id;
        IF a.policy_revision IS DISTINCT FROM (SELECT max(revision) FROM public.procurement_policy_versions WHERE site_id=a.site_id)
          THEN RAISE EXCEPTION 'Policy changed' USING ERRCODE='40001'; END IF;
        PERFORM public.procurement_materialize_tender_publication(a.site_id,a.target_id,a.target_version,a.actor_id);
      END $$;`)
    pg.call(saveSql(1, defaultPolicyDocument()))
    expect(() => pg.call(vote(approval, stage), ids.admin)).toThrow(/Policy changed/)
    expect(pg.db('SELECT count(*) FROM public.procurement_event_decisions')).toBe('0')
  })
  test('default decision rolls back when the target revision changed', () => {
    const { approval, stage } = generatedDefault()
    pg.db(`UPDATE public.procurement_tenders SET version=2 WHERE id='${tenderId}'`)
    expect(() => pg.call(vote(approval, stage), ids.admin)).toThrow(/Changed tender/)
    expect(pg.db('SELECT count(*) FROM public.procurement_event_decisions')).toBe('0')
  })
  test('assigned human release is atomic, attributed and idempotent', () => {
    const plan = setup()
    const approval = pg.call(create(plan), ids.owner, 'service_role')
    expect(pg.db('SELECT count(*) FROM public.release_log')).toBe('0')
    expect(pg.call(create(plan), ids.owner, 'service_role')).toBe(approval)
    const stage = pg.db(`SELECT id FROM public.procurement_event_stages WHERE approval_id='${approval}'`)
    expect(() => pg.call(vote(approval,stage), ids.owner)).toThrow(/Ineligible/)
    pg.call(vote(approval,stage), ids.admin)
    expect(pg.db('SELECT count(*) FROM public.release_log')).toBe('1')
    expect(pg.db('SELECT actor_id FROM public.release_log')).toBe(ids.owner)
    expect(pg.call(vote(approval,stage), ids.admin)).toBe(approval)
    expect(pg.db('SELECT count(*) FROM public.procurement_event_decisions')).toBe('1')
    expect(pg.db('SELECT count(*) FROM public.release_log')).toBe('1')
  })
  test('concurrent identical votes commit one decision and one release', async () => {
    const approval = pg.call(create(setup()), ids.owner, 'service_role')
    const stage = pg.db(`SELECT id FROM public.procurement_event_stages WHERE approval_id='${approval}'`)
    const results = await Promise.all([pg.concurrent(actorSql(vote(approval, stage), ids.admin)),
      pg.concurrent(actorSql(vote(approval, stage), ids.admin))])
    expect(results).toEqual([approval, approval])
    expect(pg.db('SELECT count(*) FROM public.procurement_event_decisions')).toBe('1')
    expect(pg.db('SELECT count(*) FROM public.release_log')).toBe('1')
  })
  test('replaying a vote in a pending quorum does not count it twice', () => {
    const plan = setup()
    plan.stages[0].approverIds = [ids.admin, ids.owner]
    plan.stages[0].quorum = { mode: 'all' }
    plan.stages[0].allowSelfApproval = true
    const approval = pg.call(create(plan), ids.owner, 'service_role')
    const stage = pg.db(`SELECT id FROM public.procurement_event_stages WHERE approval_id='${approval}'`)
    expect(pg.call(vote(approval, stage), ids.admin)).toBe(approval)
    expect(pg.call(vote(approval, stage), ids.admin)).toBe(approval)
    expect(pg.db('SELECT status FROM public.procurement_event_approvals')).toBe('pending')
    expect(pg.db('SELECT count(*) FROM public.procurement_event_decisions')).toBe('1')
    expect(pg.db('SELECT count(*) FROM public.release_log')).toBe('0')
    pg.db(`UPDATE public.procurement_event_approvals SET status='rejected' WHERE id='${approval}'`)
    expect(() => pg.db(`\\set VERBOSITY verbose\n${actorSql(vote(approval, stage), ids.owner)}`)).toThrow(/PT409.*Approval changed/)
  })
  test('a different decision or reason is a terminal conflict, not a replay', () => {
    const approval = pg.call(create(setup()), ids.owner, 'service_role')
    const stage = pg.db(`SELECT id FROM public.procurement_event_stages WHERE approval_id='${approval}'`)
    pg.call(vote(approval, stage), ids.admin)
    for (const sql of [vote(approval, stage, 'reject'), vote(approval, stage).replace('Reviewed', 'Changed reason')]) {
      expect(() => pg.db(`\\set VERBOSITY verbose\n${actorSql(sql, ids.admin)}`)).toThrow(/PT409/)
    }
    expect(pg.db('SELECT count(*) FROM public.release_log')).toBe('1')
  })
  test('replays preserve tenant and approver authorization', () => {
    const approval = pg.call(create(setup()), ids.owner, 'service_role')
    const stage = pg.db(`SELECT id FROM public.procurement_event_stages WHERE approval_id='${approval}'`)
    pg.call(vote(approval, stage), ids.admin)
    expect(() => pg.call(vote(approval, stage), ids.foreign)).toThrow(/Access denied/)
    expect(() => pg.call(vote(approval, stage), ids.owner)).toThrow(/Ineligible/)
    expect(() => pg.call(vote(approval, stage), ids.admin, 'anon')).toThrow(/permission denied/)
    expect(() => pg.call(vote(approval, uuid(999)), ids.admin)).toThrow(/Stage changed/)
  })
  test('no client can forge a plan or call the private materializer', () => {
    const plan = setup()
    for (const role of ['authenticated','anon']) expect(() => pg.call(create(plan), ids.owner, role)).toThrow(/permission denied/)
    expect(() => pg.call(`SELECT public.procurement_materialize_tender_publication('${ids.site}','${tenderId}',1,'${ids.owner}');`)).toThrow(/permission denied/)
    const approval = pg.call(create(plan),ids.owner,'service_role')
    expect(pg.call(`SELECT count(*) FROM public.procurement_event_approvals WHERE id='${approval}'`,ids.foreign)).toBe('0')
    expect(pg.call(`SELECT count(*) FROM public.procurement_event_approvals WHERE id='${approval}'`,actors.member)).toBe('0')
    expect(() => pg.call('DELETE FROM public.procurement_event_approvals')).toThrow(/permission denied/)
  })
  test('changed target rolls back final approval and decision', () => {
    const approval = pg.call(create(setup()),ids.owner,'service_role')
    const stage = pg.db(`SELECT id FROM public.procurement_event_stages WHERE approval_id='${approval}'`)
    pg.db(`UPDATE public.procurement_tenders SET version=2 WHERE id='${tenderId}'`)
    expect(() => pg.call(vote(approval,stage),ids.admin)).toThrow(/Changed tender/)
    expect(pg.db('SELECT count(*) FROM public.procurement_event_decisions')).toBe('0')
  })
  test('AI stage cannot be completed by a human masquerading as agent', () => {
    const approval = pg.call(create(setup(true)),ids.owner,'service_role')
    const stage = pg.db(`SELECT id FROM public.procurement_event_stages WHERE approval_id='${approval}'`)
    expect(() => pg.call(vote(approval,stage),ids.admin)).toThrow(/Ineligible/)
    expect(pg.db('SELECT count(*) FROM public.release_log')).toBe('0')
  })
  test('rejection never publishes', () => {
    const approval = pg.call(create(setup()),ids.owner,'service_role')
    const stage = pg.db(`SELECT id FROM public.procurement_event_stages WHERE approval_id='${approval}'`)
    pg.call(vote(approval,stage,'reject'),ids.admin)
    expect(pg.call(vote(approval,stage,'reject'),ids.admin)).toBe(approval)
    expect(pg.db('SELECT status FROM public.procurement_event_approvals')).toBe('rejected')
    expect(pg.db('SELECT count(*) FROM public.procurement_event_decisions')).toBe('1')
    expect(pg.db('SELECT count(*) FROM public.release_log')).toBe('0')
  })
})