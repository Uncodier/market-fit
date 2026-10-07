/** @jest-environment node */

import { GET, POST } from '@/app/api/site/setup/route'
import { requireSiteAccess } from '@/lib/auth/api-site-access'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
const siteId = '00000000-0000-4000-8000-000000000001'
const userId = '00000000-0000-4000-8000-000000000002'
const rpc = jest.fn()
const getSession = jest.fn()
const originalApi = process.env.API_SERVER_URL
const originalPublicApi = process.env.NEXT_PUBLIC_API_SERVER_URL
const workflowId = `site-setup-${siteId}-1791331200000`
const accepted = { success: true, data: { workflow_id: workflowId, site_id: siteId,
  status: 'accepted', setup_status: 'pending', cause: 'WORKFLOW_ACCEPTED' } }

function request(body: unknown = { site_id: siteId }, headers = {}) {
  return new Request('http://localhost:3000/api/site/setup', {
    method: 'POST', headers: { cookie: 'session', origin: 'http://localhost:3000', 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = 'http://localhost:3001'
  delete process.env.NEXT_PUBLIC_API_SERVER_URL
  rpc.mockResolvedValue({ data: true, error: null })
  getSession.mockResolvedValue({ data: { session: { access_token: 'user-token', user: { id: userId } } }, error: null })
  jest.mocked(requireSiteAccess).mockResolvedValue({
    userId, role: 'owner', userEmail: null,
    supabase: { auth: { getSession }, rpc } as unknown as Awaited<ReturnType<typeof requireSiteAccess>>['supabase'] & {},
  })
  jest.mocked(fetch).mockReset().mockResolvedValue(Response.json(accepted))
})

afterAll(() => {
  if (originalApi === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = originalApi
  if (originalPublicApi === undefined) delete process.env.NEXT_PUBLIC_API_SERVER_URL
  else process.env.NEXT_PUBLIC_API_SERVER_URL = originalPublicApi
})

it('requires manager access and forwards only the authenticated actor and authorized site', async () => {
  const response = await POST(request({ site_id: siteId, user_id: 'forged', setup_type: 'forged' }, { 'x-api-key': 'forged' }))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(accepted)
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId, { requireManager: true })
  expect(rpc).toHaveBeenCalledWith('user_can', { p_site_id: siteId, p_command: 'update' })
  const [url, options] = jest.mocked(fetch).mock.calls[0]
  expect(String(url)).toBe('http://localhost:3001/api/site/setup')
  expect(options).toMatchObject({ redirect: 'error', cache: 'no-store', signal: expect.any(AbortSignal) })
  expect(options?.headers).toEqual({ Authorization: 'Bearer user-token', 'Content-Type': 'application/json', Accept: 'application/json' })
  expect(JSON.parse(String(options?.body))).toEqual({ site_id: siteId })
})

it.each([401, 403])('denies missing authentication or foreign/non-manager access (%i)', async status => {
  jest.mocked(requireSiteAccess).mockResolvedValueOnce({ error: Response.json({}, { status }) as never })
  expect((await POST(request())).status).toBe(status)
  expect(fetch).not.toHaveBeenCalled()
})

it('denies missing mutation permission and mismatched sessions', async () => {
  rpc.mockResolvedValueOnce({ data: false, error: null })
  expect((await POST(request())).status).toBe(403)
  getSession.mockResolvedValueOnce({ data: { session: { access_token: 'other-token', user: { id: 'other' } } }, error: null })
  expect((await POST(request())).status).toBe(401)
  getSession.mockResolvedValueOnce({ data: { session: null }, error: null })
  expect((await POST(request())).status).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
})

it('rejects invalid, oversized and cross-site input before auth or forwarding', async () => {
  for (const body of ['{', {}, { site_id: 'bad' }]) expect((await POST(request(body))).status).toBe(400)
  expect((await POST(request({ site_id: siteId, padding: 'x'.repeat(5_000) }))).status).toBe(413)
  expect((await POST(request(undefined, { origin: 'https://evil.test' }))).status).toBe(403)
  expect((await POST(request(undefined, { 'content-type': 'text/plain' }))).status).toBe(415)
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([401, 403, 409, 429, 503])('preserves upstream %i without replay or raw error exposure', async status => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ error: 'private backend detail' }, { status }))
  const response = await POST(request())
  expect(response.status).toBe(status)
  expect(await response.text()).not.toContain('private backend detail')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('rejects ambiguous success, network failure and missing configuration', async () => {
  for (const value of [{ success: true }, { ...accepted, data: { ...accepted.data, site_id: userId } }]) {
    jest.mocked(fetch).mockResolvedValueOnce(Response.json(value))
    expect((await POST(request())).status).toBe(502)
  }
  jest.mocked(fetch).mockRejectedValueOnce(new Error('private network details'))
  expect((await POST(request())).status).toBe(502)
  process.env.API_SERVER_URL = ''
  expect((await POST(request())).status).toBe(503)
  expect(fetch).toHaveBeenCalledTimes(3)
})

it('preserves safe billing and ambiguous start feedback, never backend secrets', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ success: false,
    error: { code: 'BILLING_INITIALIZATION_FAILED', message: 'private' } }, { status: 503 }))
  const billing = await POST(request())
  expect((await billing.json()).error).toEqual({ code: 'BILLING_INITIALIZATION_FAILED',
    message: 'Background setup was not started because billing could not be confirmed.' })
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ success: false,
    error: { code: 'SETUP_UNCONFIRMED', message: 'private' }, data: { workflow_id: workflowId, setup_status: 'unconfirmed' } }, { status: 503 }))
  expect((await (await POST(request())).json()).data.workflow_id).toBe(workflowId)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('reads status only for an authorized embedded site with bearer session and no writes', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ success: true, data: {
    ...accepted.data, status: 'completed', setup_status: 'partial', cause: 'SETUP_PARTIAL',
    steps: { agents: 'completed', segments: 'skipped', private: 'secret' }, private: 'secret',
  } }))
  const response = await GET(new Request(`http://localhost:3000/api/site/setup?workflow_id=${workflowId}&site_id=${userId}`, {
    headers: { cookie: 'session' },
  }))
  expect(response.status).toBe(200)
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId, { requireManager: true })
  expect(jest.mocked(fetch).mock.calls[0][1]).toMatchObject({ method: 'GET' })
  expect(jest.mocked(fetch).mock.calls[0][1]?.body).toBeUndefined()
  expect(await response.text()).not.toContain('secret')
})

it('rejects unrelated or duplicated status workflow identifiers', async () => {
  for (const query of ['workflow_id=other', `workflow_id=${workflowId}&workflow_id=${workflowId}`]) {
    expect((await GET(new Request(`http://localhost:3000/api/site/setup?${query}`))).status).toBe(400)
  }
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('fails safely when authorization or session lookup unexpectedly throws', async () => {
  jest.mocked(requireSiteAccess).mockRejectedValueOnce(new Error('private auth detail'))
  const access = await POST(request())
  expect(access.status).toBe(503)
  expect(await access.text()).not.toContain('private auth detail')
  getSession.mockRejectedValueOnce(new Error('private session detail'))
  const session = await POST(request())
  expect(session.status).toBe(503)
  expect(await session.text()).not.toContain('private session detail')
  expect(fetch).not.toHaveBeenCalled()
})