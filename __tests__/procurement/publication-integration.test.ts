/** @jest-environment node */
import { ids, isolatedPostgres, postgresAvailable, sqlJson } from './storage-fixture'
import { installTendersFixture, saveTender } from './tenders-fixture'
import { migration } from '../security/isolated-postgres'
import { defaultPolicyDocument, approvalStageSchema, evaluateProcurementPolicy } from '@/app/purchases/procurement/domain'

jest.setTimeout(180000)
;(postgresAvailable ? describe : describe.skip)('real tender plus event approval migrations',()=>{
  const pg=isolatedPostgres()
  beforeAll(()=>pg.start())
  afterAll(()=>pg.stop())
  beforeEach(()=>{
    installTendersFixture(pg)
    pg.db(migration('20261027172002_procurement_event_approvals.sql'))
  })
  test('publishes only after independent human approval using actual materializer',()=>{
    const tender=pg.call(saveTender())
    const policy=defaultPolicyDocument(); policy.settings.allowGlobalListing=true
    policy.settings.fallback={mode:'approval',stages:[approvalStageSchema.parse({id:'publish',name:'Publication approval',decisionMode:'human',
      approverIds:[ids.admin],quorum:{mode:'first_response'},execution:'parallel',rejectionBehavior:'veto',allowSelfApproval:false,timeoutAction:'block'})]}
    pg.call(`SELECT public.save_procurement_policy('${ids.site}',1,${sqlJson(policy)})`)
    const plan=evaluateProcurementPolicy(policy,{event:'publication',currency:'USD',netAmountMinor:125000,requesterId:ids.owner,evaluatedAt:new Date().toISOString()})
    const create=`SELECT public.create_procurement_event_approval('${ids.site}','${tender}',1,'publication','${ids.owner}',2,${sqlJson(plan)})`
    const approval=pg.call(create,ids.owner,'service_role')
    expect(pg.db('SELECT count(*) FROM public.procurement_tender_publications')).toBe('0')
    const stage=pg.db(`SELECT id FROM public.procurement_event_stages WHERE approval_id='${approval}'`)
    pg.call(`SELECT public.decide_procurement_event('${ids.site}','${approval}','${stage}','approve','Terms reviewed')`,ids.admin)
    expect(pg.db('SELECT count(*) FROM public.procurement_tender_publications')).toBe('1')
    expect(pg.call(create,ids.owner,'service_role')).toBe(approval)
    expect(pg.call('SELECT count(*) FROM public.public_procurement_tenders()',ids.owner,'anon')).toBe('1')
  })
  test('portal disabled while approval pending rolls back the final vote',()=>{
    const tender=pg.call(saveTender())
    const policy=defaultPolicyDocument(); policy.settings.allowGlobalListing=true
    policy.settings.fallback={mode:'approval',stages:[approvalStageSchema.parse({id:'publish',name:'Review',decisionMode:'human',approverIds:[ids.admin],
      quorum:{mode:'first_response'},execution:'parallel',rejectionBehavior:'veto',allowSelfApproval:false,timeoutAction:'block'})]}
    pg.call(`SELECT public.save_procurement_policy('${ids.site}',1,${sqlJson(policy)})`)
    const plan=evaluateProcurementPolicy(policy,{event:'publication',currency:'USD',netAmountMinor:125000,requesterId:ids.owner,evaluatedAt:new Date().toISOString()})
    const approval=pg.call(`SELECT public.create_procurement_event_approval('${ids.site}','${tender}',1,'publication','${ids.owner}',2,${sqlJson(plan)})`,ids.owner,'service_role')
    const stage=pg.db(`SELECT id FROM public.procurement_event_stages WHERE approval_id='${approval}'`)
    pg.call(`SELECT public.configure_procurement_tender_portal('${ids.site}',false)`)
    expect(()=>pg.call(`SELECT public.decide_procurement_event('${ids.site}','${approval}','${stage}','approve','Reviewed')`,ids.admin)).toThrow()
    expect(pg.db('SELECT count(*) FROM public.procurement_tender_publications')).toBe('0')
    expect(pg.db('SELECT count(*) FROM public.procurement_event_decisions')).toBe('0')
  })
})