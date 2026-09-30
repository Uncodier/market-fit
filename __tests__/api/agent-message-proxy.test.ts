/** @jest-environment node */

import { POST } from '@/app/api/agents/chat/message/route'
import { requireSiteAccess } from '@/lib/auth/api-site-access'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))

const siteId = '00000000-0000-4000-8000-000000000001'
const conversationId = '00000000-0000-4000-8000-000000000002'
const messageId = '00000000-0000-4000-8000-000000000003'
const userId = '00000000-0000-4000-8000-000000000004'
const agentId = '00000000-0000-4000-8000-000000000005'
const leadId = '00000000-0000-4000-8000-000000000006'
const visitorId = '00000000-0000-4000-8000-000000000007'
const auth = { getSession: jest.fn() }
const from = jest.fn()
const rpc = jest.fn()
const originalApi = process.env.API_SERVER_URL
const originalPublicApi = process.env.NEXT_PUBLIC_API_SERVER_URL
const accepted = { success: true, data: { conversation_id: conversationId,
  messages: { assistant: { message_id: messageId, content: 'Hello' } },
} }

function query(data: unknown, error: unknown = null) {
  const chain = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue({ data, error }) }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

function request(body: unknown = {}, headers: Record<string, string> = {}, url = 'http://localhost:3000/api/agents/chat/message') {
  return new Request(url, {
    method: 'POST',
    headers: { cookie: 'sb-test=session', origin: 'http://localhost:3000', 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify({ site_id: siteId, conversationId, message: 'Hello', ...body as object }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = 'http://localhost:3001'
  delete process.env.NEXT_PUBLIC_API_SERVER_URL
  jest.mocked(requireSiteAccess).mockResolvedValue({
    userId, role: 'owner', userEmail: null,
    supabase: { auth, from, rpc } as unknown as Awaited<ReturnType<typeof requireSiteAccess>>['supabase'] & {},
  })
  rpc.mockResolvedValue({ data: true, error: null })
  auth.getSession.mockResolvedValue({ data: { session: { access_token: 'user-token', user: { id: userId } } }, error: null })
  from.mockReset().mockImplementation(table => query(table === 'conversations'
    ? { id: conversationId, site_id: siteId, agent_id: agentId, lead_id: leadId, visitor_id: visitorId }
    : { id: agentId }))
  jest.mocked(fetch).mockReset().mockResolvedValue(Response.json(accepted))
})

afterAll(() => {
  if (originalApi === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = originalApi
  if (originalPublicApi === undefined) delete process.env.NEXT_PUBLIC_API_SERVER_URL
  else process.env.NEXT_PUBLIC_API_SERVER_URL = originalPublicApi
})

it('forwards the verified user token and server-owned identities, never client credentials', async () => {
  const response = await POST(request({
    team_member_id: 'forged-user', user_id: 'forged-user', agentId: 'forged-agent',
    lead_id: 'forged-lead', visitor_id: 'forged-visitor', target: 'https://evil.test',
  }, { authorization: 'Bearer forged-token', 'x-api-key': 'forged-key', 'x-auth-user-id': 'forged-user' }))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store, private')
  expect(await response.json()).toEqual(accepted)
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId)
  expect(rpc).toHaveBeenCalledWith('user_can', { p_site_id: siteId, p_command: 'insert' })
  expect(fetch).toHaveBeenCalledTimes(1)
  const [url, options] = jest.mocked(fetch).mock.calls[0]
  expect(String(url)).toBe('http://localhost:3001/api/agents/chat/message')
  expect(options).toMatchObject({ redirect: 'error', cache: 'no-store', signal: expect.any(AbortSignal) })
  expect(options?.headers).toEqual({ Authorization: 'Bearer user-token', 'Content-Type': 'application/json', Accept: 'application/json' })
  expect(JSON.parse(String(options?.body))).toEqual({
    conversationId, site_id: siteId, team_member_id: userId, agentId, lead_id: leadId, visitor_id: visitorId, message: 'Hello',
  })
})

it('uses server-only API configuration with the public URL as fallback', async () => {
  process.env.NEXT_PUBLIC_API_SERVER_URL = 'https://api.example.test'
  await POST(request())
  expect(String(jest.mocked(fetch).mock.calls[0][0])).toContain('localhost:3001')
  delete process.env.API_SERVER_URL
  await POST(request())
  expect(String(jest.mocked(fetch).mock.calls[1][0])).toBe('https://api.example.test/api/agents/chat/message')
})

it.each([401, 403])('does not contact the API when site access is denied with %i', async status => {
  jest.mocked(requireSiteAccess).mockResolvedValueOnce({ error: Response.json({}, { status }) as never })
  expect((await POST(request())).status).toBe(status)
  expect(from).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('denies read-only access and failed capability checks', async () => {
  for (const result of [{ data: false, error: null }, { data: null, error: { message: 'private detail' } }]) {
    rpc.mockResolvedValueOnce(result)
    expect((await POST(request())).status).toBe(403)
  }
  expect(from).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  { data: { session: null }, error: null },
  { data: { session: { access_token: 'wrong-user', user: { id: 'other' } } }, error: null },
  { data: { session: { access_token: '', user: { id: userId } } }, error: null },
  { data: { session: null }, error: { message: 'expired' } },
])('rejects missing, expired or mismatched sessions', async result => {
  auth.getSession.mockResolvedValueOnce(result)
  expect((await POST(request())).status).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
})

it('scopes conversation and agent lookups to the authorized site', async () => {
  const conversation = query(null)
  from.mockReturnValueOnce(conversation)
  expect((await POST(request())).status).toBe(404)
  expect(conversation.eq).toHaveBeenCalledWith('id', conversationId)
  expect(conversation.eq).toHaveBeenCalledWith('site_id', siteId)
  const agent = query(null)
  from.mockReturnValueOnce(query({ id: conversationId, site_id: siteId, agent_id: agentId })).mockReturnValueOnce(agent)
  expect((await POST(request())).status).toBe(404)
  expect(agent.eq).toHaveBeenCalledWith('id', agentId)
  expect(agent.eq).toHaveBeenCalledWith('site_id', siteId)
  expect(fetch).not.toHaveBeenCalled()
})

it('fails closed on lookup errors or an unassigned agent', async () => {
  from.mockReturnValueOnce(query(null, { message: 'private database detail' }))
  const failure = await POST(request())
  expect(failure.status).toBe(503)
  expect(await failure.text()).not.toContain('private database detail')
  from.mockReturnValueOnce(query({ id: conversationId, site_id: siteId, agent_id: null }))
  expect((await POST(request())).status).toBe(409)
  from.mockReturnValueOnce(query({ id: conversationId, site_id: siteId, agent_id: agentId }))
    .mockReturnValueOnce(query(null, { message: 'private detail' }))
  expect((await POST(request())).status).toBe(503)
  expect(fetch).not.toHaveBeenCalled()
})

it('rejects malformed, oversized and cross-origin input before accessing protected resources', async () => {
  for (const body of ['{', null, [], { message: '' }, { message: ' ' }, { message: 'x'.repeat(20_001) },
    { site_id: 'bad' }, { conversationId: 'bad' }]) {
    const input = body === null || Array.isArray(body) ? JSON.stringify(body) : body
    expect((await POST(request(input))).status).toBe(400)
  }
  expect((await POST(request({ padding: 'x'.repeat(256_000) }))).status).toBe(413)
  expect((await POST(request({}, { origin: 'https://evil.test' }))).status).toBe(403)
  expect((await POST(request({}, { 'sec-fetch-site': 'cross-site' }))).status).toBe(403)
  expect((await POST(request({}, { 'content-type': 'text/plain' }))).status).toBe(415)
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('accepts loopback dev requests through the wildcard bind address', async () => {
  const response = await POST(request({}, { host: 'localhost:3000' }, 'http://0.0.0.0:3000/api/agents/chat/message'))
  expect(response.status).toBe(200)
})

it.each([400, 401, 403, 404, 409, 429, 500, 503])('preserves upstream status %i without exposing backend details or retrying', async status => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({
    success: false, error: { code: 'UNAUTHORIZED', message: 'private backend detail' },
  }, { status }))
  const response = await POST(request())
  expect(response.status).toBe(status)
  const body = await response.json()
  expect(body.success).toBe(false)
  expect(JSON.stringify(body)).not.toContain('private backend detail')
  if (status === 401) expect(body.error.message).toContain('sign in again')
  if (status === 403) expect(body.error.message).toContain('permission')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('exposes only the saved assistant reply, not provider or internal error payloads', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ ...accepted, provider: { secret: 'private' }, data: {
    ...accepted.data, commandId: 'internal', error_details: 'private',
  } }))
  expect(await (await POST(request())).json()).toEqual(accepted)
})

it('rejects incomplete, oversized, mismatched or non-JSON responses and network failures without replay', async () => {
  const responses = [new Response('html'), Response.json({ success: true }),
    Response.json({ success: false }), Response.json({ ...accepted, padding: 'x'.repeat(256_000) }),
    Response.json({ ...accepted, data: { ...accepted.data, conversation_id: siteId } }),
    Response.json({ success: true, data: { messages: { assistant: { content: 'Not saved', message_id: null } } } }),
  ]
  for (const response of responses) {
    jest.mocked(fetch).mockResolvedValueOnce(response)
    expect((await POST(request())).status).toBe(502)
  }
  jest.mocked(fetch).mockRejectedValueOnce(new Error('network'))
  expect((await POST(request())).status).toBe(502)
  expect(fetch).toHaveBeenCalledTimes(responses.length + 1)
})

it('rejects unconfigured, recursive, credential-bearing or insecure upstream destinations', async () => {
  for (const value of ['', 'http://localhost:3000', 'https://user:secret@api.example.test',
    'http://api.example.test', 'https://api.example.test?target=x', 'https://api.example.test/other']) {
    process.env.API_SERVER_URL = value
    expect((await POST(request())).status).toBe(503)
  }
  expect(fetch).not.toHaveBeenCalled()
})