/** @jest-environment node */
import { randomUUID } from 'node:crypto'
import { GET } from '@/app/robots/private-answer/[id]/route'
import { GET as inline } from '@/app/robots/private-answer/[id]/inline/route'
import { GET as download } from '@/app/robots/private-answer/[id]/download/route'
import { createClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const id = randomUUID(), owner = randomUUID()
const url = `https://app.example.test/robots/private-answer/${id}`
const getUser = jest.fn(), rpc = jest.fn()
const read = (path = url) => GET(new Request(path), {params:Promise.resolve({id})})
const reply = (data: unknown, error: unknown = null) => ({abortSignal:async () => ({data,error})})

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(createClient).mockResolvedValue({auth:{getUser},rpc} as never)
  getUser.mockResolvedValue({data:{user:{id:owner,is_anonymous:false}}})
})

it('isolates inline content from the workspace and only links to validated, same-origin deliverables', async () => {
  const report = `/connectors/results/${randomUUID()}`
  rpc.mockReturnValue(reply(`![pixel](https://tracker.test/a.png) <img src=x>\n[Table](${report})\n[invalid](${report}?public=1)`))
  const response = await inline(new Request(`${url}/inline`), { params: Promise.resolve({ id }) })
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('private, no-store')
  expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'self'")
  expect(response.headers.get('content-security-policy')).toContain('sandbox ')
  expect(response.headers.get('content-security-policy')).not.toMatch(/allow-same-origin|allow-scripts/)
  const html = await response.text()
  expect(html).not.toMatch(/<img|href="https|href="[^"\n]*\?public/)
  expect(html).toContain(`<a href="${report}" target="_blank" rel="noopener noreferrer">Table</a>`)
  expect(html).toContain(`href="/robots/private-answer/${id}/download"`)
})

it('exports the complete authorized answer, not a provider record; revocation denies every presentation', async () => {
  const params = { params: Promise.resolve({ id }) }
  const text = '# Quarterly analysis\n\nNo saved record is needed.'
  rpc.mockReturnValueOnce(reply(text)).mockReturnValue(reply(null))
  const file = await download(new Request(`${url}/download`), params)
  expect(file.headers.get('content-disposition')).toContain('attachment; filename="private-ask-report.md"')
  expect(await file.text()).toBe(text)
  for (const handler of [inline, download, GET]) {
    const denied = await handler(new Request(url), params)
    expect(denied.status).toBe(404)
    expect(denied.headers.get('content-disposition')).toBeNull()
    expect(await denied.text()).not.toMatch(/Quarterly analysis|Download report/)
  }
  expect(rpc).toHaveBeenCalledTimes(4)
  expect(getUser).toHaveBeenCalledTimes(4)
})

it('renders only the owner RPC response without executing markup or using a shared cache', async () => {
  const record = `/connectors/results/${randomUUID()}`
  rpc.mockReturnValue(reply(`Paid accounts: 12\n<script>not executable</script>\n[Saved table](${record})\n[external](https://example.test)`))
  const response = await read()
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('private, no-store')
  expect(response.headers.get('content-security-policy')).toContain("default-src 'none'")
  expect(createClient).toHaveBeenCalledWith(true)
  expect(rpc).toHaveBeenCalledWith('read_connector_ask_answer',{p_action_id:id})
  const text = await response.text()
  expect(text).toContain('Paid accounts: 12')
  expect(text).toContain('&lt;script&gt;')
  expect(text).not.toContain('<script>')
  expect(text).toContain(`<a href="${record}">Saved table</a>`)
  expect(text).not.toContain('href="https://')
})

it('denies unverified sessions and never returns a Supabase error or a forged body', async () => {
  expect((await read(`${url}?actor=${owner}`)).status).toBe(400)
  for (const user of [null,{id:owner},{id:owner,is_anonymous:true}]) {
    getUser.mockResolvedValueOnce({data:{user}})
    expect((await read()).status).toBe(401)
  }
  expect(rpc).not.toHaveBeenCalled()
  rpc.mockReturnValueOnce(reply(null))
  expect((await read()).status).toBe(404)
  const diagnostic = randomUUID()
  rpc.mockReturnValueOnce(reply(null,{message:diagnostic})).mockReturnValueOnce(reply({body:diagnostic}))
  for (let i=0;i<2;i++) {
    const response = await read()
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain(diagnostic)
  }
})