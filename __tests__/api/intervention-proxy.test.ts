/** @jest-environment node */

import { POST } from '@/app/api/agents/chat/intervention/route'
import { requireSiteAccess } from '@/lib/auth/api-site-access'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))

const siteId = '00000000-0000-4000-8000-000000000001'
const conversationId = '00000000-0000-4000-8000-000000000002'
const messageId = '00000000-0000-4000-8000-000000000003'
const userId = '00000000-0000-4000-8000-000000000004'
const agentId = '00000000-0000-4000-8000-000000000005'
const leadId = '00000000-0000-4000-8000-000000000006'
const auth = { getSession: jest.fn() }
const from = jest.fn()
const rpc = jest.fn()
const originalApi = process.env.API_SERVER_URL
const originalPublicApi = process.env.NEXT_PUBLIC_API_SERVER_URL

function query(data: unknown, error: unknown = null) {
  const chain = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue({ data, error }) }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

function request(body: unknown = {}, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/agents/chat/intervention', {
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
  from.mockReset().mockReturnValue(query({ id: conversationId, site_id: siteId, agent_id: agentId, lead_id: leadId, visitor_id: null }))
  jest.mocked(fetch).mockReset().mockResolvedValue(Response.json({
    success: true, data: { conversation_id: conversationId, message: { message_id: messageId },
      channel_send: { success: true, method: 'voice_agent_call', callId: 'call-1' } },
  }))
})

afterAll(() => {
  if (originalApi === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = originalApi
  if (originalPublicApi === undefined) delete process.env.NEXT_PUBLIC_API_SERVER_URL
  else process.env.NEXT_PUBLIC_API_SERVER_URL = originalPublicApi
})

it('forwards one authenticated intervention using server-owned identities and returns saved/call IDs', async () => {
  const response = await POST(request({ user_id: 'forged-user', agentId: 'forged-agent', lead_id: 'forged-lead', channel: 'voice' }))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(await response.json()).toEqual({ success: true, data: {
    conversation_id: conversationId, message: { message_id: messageId },
    channel_send: { success: true, method: 'voice_agent_call', callId: 'call-1' },
  } })
  expect(fetch).toHaveBeenCalledTimes(1)
  const [url, options] = jest.mocked(fetch).mock.calls[0]
  expect(String(url)).toBe('http://localhost:3001/api/agents/chat/intervention')
  expect(options).toMatchObject({ redirect: 'error', cache: 'no-store', headers: { Authorization: 'Bearer user-token' } })
  expect(options?.headers).not.toHaveProperty('x-api-key')
  expect(JSON.parse(String(options?.body))).toEqual({
    conversationId, conversation_id: conversationId, site_id: siteId, user_id: userId,
    agentId, lead_id: leadId, message: 'Hello',
  })
  expect(rpc).toHaveBeenCalledWith('user_can', { p_site_id: siteId, p_command: 'insert' })
})

it('does not start a voice call or invent a recipient when the inbound conversation has no linked lead', async () => {
  from.mockReturnValueOnce(query({ id: conversationId, site_id: siteId, agent_id: agentId,
    channel: 'voice', lead_id: null, visitor_id: null,
  }))
  const response = await POST(request({ lead_id: leadId, phone: '+15550000000', title: 'Inbound Voice call' }))
  expect(response.status).toBe(409)
  expect(await response.json()).toMatchObject({ success: false, error: { message: expect.stringContaining('No call started. Link this conversation') } })
  expect(fetch).not.toHaveBeenCalled()
})

it('forwards a linked voice intervention, not an internal assistant turn', async () => {
  from.mockReturnValueOnce(query({ id: conversationId, site_id: siteId, agent_id: agentId,
    channel: 'voice', lead_id: leadId, visitor_id: null,
  })).mockReturnValueOnce(query({
    id: leadId, phone: '+12025550123', do_not_call: false,
    voice_call_consent_status: 'granted', voice_call_consent_at: '2026-01-01T00:00:00Z',
  }))
  expect((await POST(request())).status).toBe(200)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(String(jest.mocked(fetch).mock.calls[0][0])).toContain('/api/agents/chat/intervention')
})

it('uses server-only API configuration with the public URL as fallback', async () => {
  process.env.NEXT_PUBLIC_API_SERVER_URL = 'https://api.example.test'
  await POST(request())
  expect(String(jest.mocked(fetch).mock.calls[0][0])).toContain('localhost:3001')
  delete process.env.API_SERVER_URL
  await POST(request())
  expect(String(jest.mocked(fetch).mock.calls[1][0])).toContain('api.example.test')
})

it('denies anonymous, foreign-site, read-only and mismatched session access', async () => {
  jest.mocked(requireSiteAccess).mockResolvedValueOnce({ error: Response.json({}, { status: 401 }) as never })
  expect((await POST(request())).status).toBe(401)
  jest.mocked(requireSiteAccess).mockResolvedValueOnce({ error: Response.json({}, { status: 403 }) as never })
  expect((await POST(request())).status).toBe(403)
  rpc.mockResolvedValueOnce({ data: false, error: null })
  expect((await POST(request())).status).toBe(403)
  auth.getSession.mockResolvedValueOnce({ data: { session: { access_token: 'wrong', user: { id: 'other' } } }, error: null })
  expect((await POST(request())).status).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
})

it('scopes conversations to the authorized site before any upstream side effect', async () => {
  const lookup = query(null)
  from.mockReturnValueOnce(lookup)
  expect((await POST(request())).status).toBe(404)
  expect(lookup.eq).toHaveBeenCalledWith('site_id', siteId)
  expect(lookup.eq).toHaveBeenCalledWith('id', conversationId)
  expect(fetch).not.toHaveBeenCalled()
})

it('rejects malformed, oversized, conflicting and cross-origin input', async () => {
  for (const body of ['{', { message: '' }, { site_id: 'bad' }, { conversation_id: messageId }]) {
    expect((await POST(request(body))).status).toBe(400)
  }
  expect((await POST(request({ padding: 'x'.repeat(256_000) }))).status).toBe(413)
  expect((await POST(request({}, { origin: 'https://evil.test' }))).status).toBe(403)
  expect((await POST(request({}, { 'sec-fetch-site': 'cross-site' }))).status).toBe(403)
  expect((await POST(request({}, { 'content-type': 'text/plain' }))).status).toBe(415)
  expect(fetch).not.toHaveBeenCalled()
})

it('accepts the loopback browser origin when next dev uses a wildcard bind address', async () => {
  const localRequest = new Request('http://0.0.0.0:3000/api/agents/chat/intervention', {
    method: 'POST', headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ site_id: siteId, conversationId, message: 'Hello' }),
  })
  expect((await POST(localRequest)).status).toBe(200)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('retries only the original failed team-member row and original text', async () => {
  const lookup = query({ content: 'Original text', custom_data: { command_status: 'failed' } })
  from.mockReturnValueOnce(query({ id: conversationId, site_id: siteId })).mockReturnValueOnce(lookup)
  expect((await POST(request({ message_id: messageId, message: 'Tampered text' }))).status).toBe(200)
  expect(lookup.eq).toHaveBeenCalledWith('user_id', userId)
  expect(lookup.eq).toHaveBeenCalledWith('role', 'team_member')
  expect(lookup.eq).toHaveBeenCalledWith('conversation_id', conversationId)
  expect(JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({ message: 'Original text', message_id: messageId })
})

it.each([
  { command_status: 'pending' },
  { command_status: 'failed', status: 'placement_unknown' },
  { command_status: 'failed', call_status: 'placement_unknown' },
  { command_status: 'failed', provider_call_id: 'call-1' },
  { command_status: 'failed', status: 'sent' },
  { command_status: 'failed', status: 'queued' },
  { command_status: 'success', status: 'failed' },
  { command_status: 'failed', call_status: 'ringing' },
  { command_status: 'failed', call_status: 'completed' },
])('does not replay active or ambiguous deliveries: %j', async custom_data => {
  from.mockReturnValueOnce(query({ id: conversationId, site_id: siteId }))
    .mockReturnValueOnce(query({ content: 'Original', custom_data }))
  expect((await POST(request({ message_id: messageId }))).status).toBe(409)
  expect(fetch).not.toHaveBeenCalled()
})

it('preserves a saved message ID on a definite API start failure without exposing backend details', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ success: false,
    data: { conversation_id: conversationId, message_id: messageId },
    error: { code: 'WORKFLOW_START_FAILED', message: 'private database detail' },
  }, { status: 500 }))
  const response = await POST(request())
  expect(response.status).toBe(500)
  const body = await response.json()
  expect(body.data.message_id).toBe(messageId)
  expect(JSON.stringify(body)).not.toContain('private database detail')
})

it('preserves placement uncertainty rather than claiming delivery failed', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ success: true, data: {
    conversation_id: conversationId, message: { message_id: messageId },
    channel_send: { success: false, method: 'voice_agent_call', delivery_status: 'placement_unknown' },
  } }))
  const response = await POST(request())
  expect((await response.json()).data.channel_send.delivery_status).toBe('placement_unknown')
})

it('fails closed on an invalid backend response or network failure without claiming a saved row', async () => {
  for (const response of [new Response('<html>error</html>'), Response.json({ not: 'the contract' })]) {
    jest.mocked(fetch).mockResolvedValueOnce(response)
    const result = await POST(request())
    expect(result.status).toBe(502)
    expect(await result.json()).not.toHaveProperty('data')
  }
  jest.mocked(fetch).mockRejectedValueOnce(new Error('network'))
  expect((await POST(request())).status).toBe(502)
  expect(fetch).toHaveBeenCalledTimes(3)
})

it('rejects unconfigured, recursive, credential-bearing or insecure upstream destinations', async () => {
  for (const value of ['', 'http://localhost:3000', 'https://user:secret@api.example.test', 'http://api.example.test', 'https://api.example.test?target=x']) {
    process.env.API_SERVER_URL = value
    expect((await POST(request())).status).toBe(503)
  }
  expect(fetch).not.toHaveBeenCalled()
})