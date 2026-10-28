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
  beforeEach(() => {
    jest.clearAllMocks(); role='owner'
    document=defaultPolicyDocument(); document.settings.fallback={ mode:'none' }
    tender={ id:target, site_id:site, version:1, currency:'MXN', net_amount_minor:100,
      requirements:[{id:target,catalog_item_id:null,quantity:1,unit_net_minor:100}] }
    const from=jest.fn((table: string) => {
      const result=()=>({ data:table==='procurement_tenders'?tender:table==='procurement_policy_versions'?{revision:1,document}: {id:target,status:'approved'},error:null })
      const query:Record<string,jest.Mock>={}
      for(const method of ['select','eq','order','limit']) query[method]=jest.fn(()=>query)
      query.maybeSingle=jest.fn(async()=>result()); query.single=jest.fn(async()=>result())
      return query
    })
    jest.mocked(createClient).mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},from,
      rpc:async(name:string)=>({data:name==='current_user_site_role'?role:name==='user_can'?true:false,error:null})} as never)
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
  test.each([null,'collaborator'])('rejects unauthorized %s before privileged access',async value=>{
    role=value
    expect((await POST(request(),context)).status).toBe(403)
    expect(createServiceClient).not.toHaveBeenCalled()
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