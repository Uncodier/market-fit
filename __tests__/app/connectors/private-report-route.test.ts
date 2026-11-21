/** @jest-environment node */
import { randomUUID, randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { GET as show } from '@/app/connectors/results/[id]/route'
import { GET as list } from '@/app/connectors/results/route'
import { POST as open } from '@/app/connectors/results/[id]/open/route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const owner = randomUUID(), id = randomUUID(), newId = randomUUID(), secret = randomBytes(24).toString('hex')
const params = { params: Promise.resolve({ id }) }, path = `https://app.example.test/connectors/results/${id}`
const fetchMock = jest.fn(), getUser = jest.fn(), getSession = jest.fn(), rpc = jest.fn()
const oldFetch = global.fetch, oldOrigin = process.env.API_SERVER_URL
const reply = (data: unknown, error = null as unknown) => ({ abortSignal: async () => ({ data, error }) })
const report = { title:'Test report', columns:['Label','Value'], rows:[['<script>private result</script>','42']], note:'Bounded result.' }
const post = (body='choice=0', origin='https://app.example.test') => new Request(`${path}/open`, {
  method:'POST', headers:{origin,'content-type':'application/x-www-form-urlencoded'}, body })
beforeEach(() => {
  jest.resetAllMocks(); global.fetch = fetchMock; process.env.API_SERVER_URL = 'https://api.example.test'
  ;(createClient as jest.Mock).mockResolvedValue({ auth:{getUser,getSession}, rpc })
  getUser.mockResolvedValue({ data:{ user:{id:owner,is_anonymous:false} } }); getSession.mockResolvedValue({data:{session:{user:{id:owner},access_token:secret}}})
  rpc.mockReturnValue(reply(report))
})
afterEach(() => { global.fetch = oldFetch; if (oldOrigin === undefined) delete process.env.API_SERVER_URL; else process.env.API_SERVER_URL=oldOrigin })

it('reads using only the real user client and opaque ID; renders an escaped, scriptless, non-cacheable standalone document', async () => {
  const response = await show(new Request(path),params), body = await response.text()
  expect(createClient).toHaveBeenCalledWith(true); expect(rpc).toHaveBeenCalledWith('read_connector_private_result',{p_id:id})
  expect(response.status).toBe(200); expect(body).toContain('&lt;script&gt;private result&lt;/script&gt;'); expect(body).not.toContain('<script')
  expect(body).toContain('cannot summarize'); expect(response.headers.get('cache-control')).toMatch(/private, no-store/)
  expect(response.headers.get('content-security-policy')).toContain("default-src 'none'"); expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  expect(getSession).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled()
})

it('requires a known nonanonymous signed-in user; rejects selectors, malformed UUIDs and arbitrary DTOs', async () => {
  for (const user of [null, {id:owner}, {id:owner,is_anonymous:true}]) {
    getUser.mockResolvedValueOnce({data:{user}}); expect((await show(new Request(path),params)).status).toBe(401)
  }
  expect((await show(new Request(`${path}?user_id=${owner}`),params)).status).toBe(400)
  expect((await show(new Request(path),{params:Promise.resolve({id:'not-an-id'})})).status).toBe(400); expect(rpc).not.toHaveBeenCalled()
  rpc.mockReturnValueOnce(reply(null)); expect((await show(new Request(path),params)).status).toBe(404)
  rpc.mockReturnValueOnce(reply({...report, raw:secret})); const invalid=await show(new Request(path),params)
  expect(invalid.status).toBe(503); expect(await invalid.text()).not.toContain(secret)
})

it('offers current private receipts independently from the final model answer and enables one explicit private selection per form', async () => {
  rpc.mockReturnValueOnce(reply([{id,tool:'SUPABASE_RUN_READ_ONLY_QUERY',created_at:new Date().toISOString()}]))
  expect(await (await list(new Request('https://app.example.test/connectors/results'))).text()).toContain(`/connectors/results/${id}`)
  expect(rpc).toHaveBeenLastCalledWith('list_connector_private_results'); rpc.mockReturnValueOnce(reply({title:'Published reports',columns:['Report name'],
    rows:[['sales_by_currency']],published:true,next_after:'sales_by_currency',note:'Open one.'}))
  const html=await (await show(new Request(path),params)).text(); expect(html).toContain('Open private report'); expect(html).toContain('Next page'); expect(html).toContain('value="0"'); expect(html).not.toContain('value="sales_by_currency"')
})

it('owner follow-up forwards only a row selector; never private report names, rows, account identity or cookie',async()=>{
  rpc.mockReturnValueOnce(reply({user_id:owner,arguments:{view:'private_view'}})); fetchMock.mockResolvedValueOnce(Response.json({id:newId}))
  const response=await open(post(),params); expect(response.status).toBe(303); expect(response.headers.get('location')).toBe(`/connectors/results/${newId}`)
  expect(rpc).toHaveBeenCalledWith('connector_private_report_choice',{p_id:id,p_choice:0}); expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url,init]=fetchMock.mock.calls[0]; expect(String(url)).toBe(`https://api.example.test/api/connectors/private-results/${id}/open`)
  expect(init).toMatchObject({method:'POST',cache:'no-store',redirect:'error',body:'{"choice":0}',headers:{authorization:`Bearer ${secret}`}})
  expect(JSON.stringify(init)).not.toContain('private_view'); expect(init.headers.cookie).toBeUndefined()
})

it('denies cross-origin, oversized and forged choices or session switches; never relays an upstream body on failure',async()=>{
  expect((await open(post('choice=0','https://foreign.example.test'),params)).status).toBe(403)
  expect((await open(post('choice='+'1'.repeat(100)),params)).status).toBe(413)
  for(const bad of ['view=private_view','choice=0&after=x','choice=25','choice=-2']) expect((await open(post(bad),params)).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled(); rpc.mockReturnValueOnce(reply(null)); expect((await open(post(),params)).status).toBe(404)
  rpc.mockReturnValue(reply({user_id:owner})); getSession.mockResolvedValueOnce({data:{session:{user:{id:randomUUID()},access_token:secret}}})
  expect((await open(post(),params)).status).toBe(401); expect(fetchMock).not.toHaveBeenCalled()
  fetchMock.mockResolvedValueOnce(Response.json({id:newId,result:secret})); const rep=await open(post(),params)
  expect(rep.status).toBe(503); expect(await rep.text()).not.toContain(secret); expect(rep.headers.get('location')).toBe(null)
})