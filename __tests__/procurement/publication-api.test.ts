/** @jest-environment node */
import { POST } from '@/app/api/procurement/tenders/[id]/publish/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { defaultPolicyDocument } from '@/app/purchases/procurement/domain'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
const site = '11111111-1111-4111-8111-111111111111'
const target = '22222222-2222-4222-8222-222222222222'
const actor = '33333333-3333-4333-8333-333333333333'
const context = { params: Promise.resolve({ id: target }) }
const request = (body: unknown = { expected_version: 1 }, headers: Record<string,string> = {}) => new Request(
  `https://example.test/api/procurement/tenders/${target}/publish?site_id=${site}`, {
    method: 'POST', headers: { cookie: 'session=fixture', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  })

describe('tender publication authorization', () => {
  let role: string | null
  let document: ReturnType<typeof defaultPolicyDocument>
  let serviceRpc: jest.Mock
  let tender: Record<string,unknown>
  let missingPolicy: boolean
  let approvalStatus: string
  let userRpc: jest.Mock
  let ownerId: string
  let adminIds: string[]
  beforeEach(() => {
    jest.clearAllMocks(); role='owner'
    missingPolicy=false; approvalStatus='approved'
    ownerId=actor
    adminIds=[]
    document=defaultPolicyDocument(); document.settings.fallback={ mode:'none' }
    tender={ id:target, site_id:site, version:1, currency:'MXN', net_amount_minor:100,
      requirements:[{id:target,catalog_item_id:null,quantity:1,unit_net_minor:100}] }
    const from=jest.fn((table: string) => {
      const result=()=>({ data:table==='procurement_tenders'?tender:table==='procurement_policy_versions'?(missingPolicy?null:{revision:1,document}):table==='sites'?{user_id:ownerId}:table==='site_members'?adminIds.map(user_id=>({user_id})): {id:target,status:approvalStatus},error:null })
      const query:Record<string,jest.Mock>={}
      for(const method of ['select','eq','order','limit','in']) query[method]=jest.fn(()=>query)
      query.maybeSingle=jest.fn(async()=>result()); query.single=jest.fn(async()=>result())
      query.then=jest.fn(resolve=>Promise.resolve(result()).then(resolve))
      return query
    })
    userRpc=jest.fn(async(name:string, params?:{p_document?:unknown})=>({data:name==='save_procurement_policy'?{revision:1,document:params?.p_document}:name==='current_user_site_role'?role:name==='procurement_inherited_policy'?{inherited_requirements:[],minimum_supplier_proposals:0}:name==='user_can'?true:false,error:null}))
    jest.mocked(createClient).mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},from,
      rpc:userRpc} as never)
    serviceRpc=jest.fn(async()=>({data:target,error:null}))
    jest.mocked(createServiceClient).mockResolvedValue({rpc:serviceRpc} as never)
  })
  test('trusted plan persistence follows explicit authorization and independent publication evaluation',async()=>{
    const response=await POST(request(),context)
    expect(response.status).toBe(200)
    expect(serviceRpc).toHaveBeenCalledWith('create_procurement_event_approval',expect.objectContaining({p_event:'publication',p_actor:actor,p_version:1,p_policy_revision:1,
      p_plan:expect.objectContaining({status:'ready',authorized:false})}))
    expect(await response.json()).toEqual({approval_id:target,status:'published'})
  })
  test('an absent policy persists an owner decision fallback and waits for explicit approval',async()=>{
    missingPolicy=true; approvalStatus='pending'
    const response=await POST(request(),context)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({approval_id:target,status:'pending'})
    expect(userRpc).toHaveBeenCalledWith('save_procurement_policy',expect.objectContaining({
      p_site_id:site,p_expected_revision:0,p_document:expect.objectContaining({rules:[],settings:expect.objectContaining({
        fallback:expect.objectContaining({mode:'approval',stages:[expect.objectContaining({approverIds:[actor],allowSelfApproval:true})]}),
      })}),
    }))
    expect(serviceRpc).toHaveBeenCalledWith('create_procurement_event_approval',expect.objectContaining({
      p_policy_revision:1,p_plan:expect.objectContaining({authorized:false,stages:[expect.objectContaining({approverIds:[actor]})]}),
    }))
  })
  test.each([null,'collaborator'])('rejects unauthorized %s before privileged access',async value=>{
    role=value
    missingPolicy=true
    expect((await POST(request(),context)).status).toBe(403)
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(userRpc.mock.calls.some(([name])=>name==='save_procurement_policy')).toBe(false)
  })
  test('an admin can be an alternative to the owner, with one explicit decision required',async()=>{
    role='admin'; missingPolicy=true; approvalStatus='pending'; ownerId=site
    adminIds=[actor]
    expect((await POST(request(),context)).status).toBe(200)
    expect(serviceRpc).toHaveBeenCalledWith('create_procurement_event_approval',expect.objectContaining({
      p_actor:actor,p_plan:expect.objectContaining({stages:[expect.objectContaining({
        approverIds:[ownerId,actor],mandatoryApproverIds:[],quorum:{mode:'first_response'},allowSelfApproval:true,
      })]}),
    }))
  })
  test('rejects anonymous, cross-origin and forged plans',async()=>{
    expect((await POST(request(undefined,{cookie:''}),context)).status).toBe(401)
    expect((await POST(request(undefined,{origin:'https://evil.test'}),context)).status).toBe(403)
    expect((await POST(request({expected_version:1,plan:{stages:[]}}),context)).status).toBe(400)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  test('blocks missing configured fallback and stale targets',async()=>{
    document.settings.fallback={mode:'block'}
    expect((await POST(request(),context)).status).toBe(409)
    document.settings.fallback={mode:'none'}; tender.version=2
    expect((await POST(request(),context)).status).toBe(409)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  test('blocks malformed saved policy instead of replacing it with defaults',async()=>{
    document.settings.timeZone='invalid'
    expect((await POST(request(),context)).status).toBe(409)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})