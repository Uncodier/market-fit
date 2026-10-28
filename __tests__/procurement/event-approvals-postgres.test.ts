/** @jest-environment node */
import { ids, actors, isolatedPostgres, postgresAvailable, installStorageFixture, sqlJson, saveSql } from './storage-fixture'
import { migration, uuid } from '../security/isolated-postgres'
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
    expect(() => pg.call(vote(approval,stage), ids.admin)).toThrow(/Approval changed/)
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
    expect(pg.db('SELECT status FROM public.procurement_event_approvals')).toBe('rejected')
    expect(pg.db('SELECT count(*) FROM public.release_log')).toBe('0')
  })
})