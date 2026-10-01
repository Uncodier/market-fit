/** @jest-environment node */

import { POST } from '@/app/api/agents/chat/intervention/route'
import { requireSiteAccess } from '@/lib/auth/api-site-access'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))

const siteId = '00000000-0000-4000-8000-000000000001'
const conversationId = '00000000-0000-4000-8000-000000000002'
const leadId = '00000000-0000-4000-8000-000000000003'
const messageId = '00000000-0000-4000-8000-000000000004'
const userId = '00000000-0000-4000-8000-000000000005'
const eligibleLead = {
  id: leadId, phone: '+1 (202) 555-0123', do_not_call: false,
  voice_call_consent_status: 'granted', voice_call_consent_at: '2026-01-01T00:00:00Z',
}
const from = jest.fn()
const originalApi = process.env.API_SERVER_URL

function query(data: unknown, error: unknown = null) {
  const chain = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue({ data, error }) }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

function setup(lead: unknown = eligibleLead, leadError: unknown = null, channel = 'voice') {
  const leadQuery = query(lead, leadError)
  from.mockImplementation(table => {
    if (table === 'leads') return leadQuery
    if (table === 'messages') return query({ content: 'Original greeting', custom_data: { command_status: 'failed' } })
    return query({ id: conversationId, site_id: siteId, lead_id: leadId, channel })
  })
  return leadQuery
}

function request(retry = false) {
  return new Request('http://localhost:3000/api/agents/chat/intervention', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({
      site_id: siteId, conversationId, message: 'Greeting', message_id: retry ? messageId : undefined,
      // Client-provided call preferences, recipient and channel must never authorize a call.
      channel: 'web', phone: '+12025550123', lead_id: 'forged-lead',
      voice_call_consent_status: 'granted', voice_call_consent_at: '2026-01-01T00:00:00Z', do_not_call: false,
    }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = 'http://localhost:3001'
  jest.mocked(requireSiteAccess).mockResolvedValue({
    userId, role: 'owner', userEmail: null,
    supabase: {
      from, rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'user-token', user: { id: userId } } } }) },
    } as unknown as Awaited<ReturnType<typeof requireSiteAccess>>['supabase'] & {},
  })
  jest.mocked(fetch).mockReset().mockResolvedValue(Response.json({ success: true, data: {
    message: { message_id: messageId }, channel_send: { success: true, method: 'voice_agent_call', callId: 'call-1' },
  } }))
})

afterAll(() => {
  if (originalApi === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = originalApi
})

it.each([
  [{ voice_call_consent_status: 'revoked', voice_call_consent_at: null }, 'VOICE_DO_NOT_CALL', 403],
  [{ voice_call_consent_status: 'denied' }, 'VOICE_DO_NOT_CALL', 403],
  [{ do_not_call: true }, 'VOICE_DO_NOT_CALL', 403],
  [{ phone: null }, 'VOICE_PHONE_REQUIRED', 409],
  [{ phone: '5550123' }, 'VOICE_PHONE_REQUIRED', 409],
])('rejects ineligible calls before upstream persistence: %j', async (overrides, code, status) => {
  const lookup = setup({ ...eligibleLead, ...overrides })
  const response = await POST(request())
  expect(response.status).toBe(status)
  expect(await response.json()).toMatchObject({ success: false, execution_started: false, error: { code } })
  expect(lookup.eq).toHaveBeenCalledWith('id', leadId)
  expect(lookup.eq).toHaveBeenCalledWith('site_id', siteId)
  expect(fetch).not.toHaveBeenCalled()
})

it('fails closed when the linked lead is missing or belongs to another site', async () => {
  setup(null)
  const response = await POST(request())
  expect(response.status).toBe(409)
  expect(await response.json()).toMatchObject({ execution_started: false, error: { code: 'VOICE_LEAD_REQUIRED' } })
  expect(fetch).not.toHaveBeenCalled()
})

it('does not mistake a failed lookup for an eligible lead or expose database details', async () => {
  setup(null, { message: 'private database detail' })
  const response = await POST(request())
  expect(response.status).toBe(503)
  const body = await response.json()
  expect(body).toMatchObject({ execution_started: false, error: { code: 'VOICE_ELIGIBILITY_UNAVAILABLE' } })
  expect(JSON.stringify(body)).not.toContain('private database detail')
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  { voice_call_consent_status: 'revoked' },
  { voice_call_consent_status: 'denied' },
  { do_not_call: true },
])('rechecks explicit opt-outs before retrying a saved failed row: %j', async overrides => {
  setup({ ...eligibleLead, ...overrides })
  const response = await POST(request(true))
  expect(response.status).toBe(403)
  const body = await response.json()
  expect(body.execution_started).toBe(false)
  expect(body.error.code).toBe('VOICE_DO_NOT_CALL')
  expect(body).not.toHaveProperty('message_id')
  expect(body).not.toHaveProperty('data')
  expect(fetch).not.toHaveBeenCalled()
})

describe.each([false, true])('voice preflight with retry=%s', retry => {
  it.each([
    { voice_call_consent_status: 'unknown', voice_call_consent_at: null },
    { voice_call_consent_status: null, voice_call_consent_at: null },
    { voice_call_consent_status: undefined, voice_call_consent_at: undefined },
    { voice_call_consent_at: null },
    { voice_call_consent_at: 'invalid' },
  ])('forwards a call without requiring explicit consent: %j', async overrides => {
    setup({ ...eligibleLead, ...overrides })
    expect((await POST(request(retry))).status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body))
    expect(body.lead_id).toBe(leadId)
    expect(body.message).toBe(retry ? 'Original greeting' : 'Greeting')
    expect(body).not.toHaveProperty('voice_call_consent_status')
    expect(body).not.toHaveProperty('voice_call_consent_at')
    expect(body).not.toHaveProperty('do_not_call')
  })
})

it('forwards an eligible call once and keeps provider safety checks in the API', async () => {
  setup()
  expect((await POST(request())).status).toBe(200)
  expect(fetch).toHaveBeenCalledTimes(1)
  const body = JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body))
  expect(body.lead_id).toBe(leadId)
  expect(body).not.toHaveProperty('voice_call_consent_status')
  expect(body).not.toHaveProperty('phone')
})

it('does not require outbound-call consent for other conversation channels', async () => {
  setup(null, null, 'email')
  expect((await POST(request())).status).toBe(200)
  expect(from).not.toHaveBeenCalledWith('leads')
})