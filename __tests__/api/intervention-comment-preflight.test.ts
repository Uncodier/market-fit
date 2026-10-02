/** @jest-environment node */

import { POST } from '@/app/api/agents/chat/intervention/route'
import { requireSiteAccess } from '@/lib/auth/api-site-access'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))

const siteId = '10000000-0000-4000-8000-000000000001'
const conversationId = '10000000-0000-4000-8000-000000000002'
const targetId = '10000000-0000-4000-8000-000000000003'
const savedId = '10000000-0000-4000-8000-000000000004'
const userId = '10000000-0000-4000-8000-000000000005'
const fields = { source: 'comment', comment_grouping_version: 1, outstand_post_id: 'post-a', publisher_account_id: 'publisher-a', network: 'instagram', author_id: 'author-a' }
const conversation = { id: conversationId, site_id: siteId, channel: 'instagram', custom_data: fields }
const target = { role: 'user', custom_data: { ...fields, platform_comment_id: 'provider-comment' } }
const from = jest.fn()
const originalApi = process.env.API_SERVER_URL

function query(data: unknown, error: unknown = null) {
  const chain = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue({ data, error }) }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

function request(extra: object = {}) {
  return new Request('http://localhost:3000/api/agents/chat/intervention', {
    method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ conversationId, site_id: siteId, message: 'Reply', reply_to_message_id: targetId, ...extra }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = 'http://localhost:3001'
  from.mockReset().mockReturnValueOnce(query(conversation)).mockReturnValue(query(target))
  jest.mocked(requireSiteAccess).mockResolvedValue({ userId, role: 'owner', userEmail: null,
    supabase: { from, rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'user-token', user: { id: userId } } }, error: null }) },
    } as unknown as NonNullable<Awaited<ReturnType<typeof requireSiteAccess>>['supabase']>,
  })
  jest.mocked(fetch).mockReset().mockResolvedValue(Response.json({ success: true, data: { message: { message_id: savedId } } }))
})

afterAll(() => {
  if (originalApi === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = originalApi
})

it('forwards only an explicit authorized same-conversation inbound target', async () => {
  const lookup = query(target)
  from.mockReset().mockReturnValueOnce(query(conversation)).mockReturnValueOnce(lookup)
  expect((await POST(request({ platform_comment_id: 'forged', publisher_account_id: 'forged' }))).status).toBe(200)
  expect(lookup.eq).toHaveBeenCalledWith('conversation_id', conversationId)
  expect(lookup.eq).toHaveBeenCalledWith('id', targetId)
  const payload = JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body))
  expect(payload.reply_to_message_id).toBe(targetId)
  expect(payload).not.toHaveProperty('platform_comment_id')
  expect(payload).not.toHaveProperty('publisher_account_id')
})

it.each([undefined, 'not-a-uuid'])('blocks missing or malformed target %s before delivery', async reply_to_message_id => {
  expect((await POST(request({ reply_to_message_id }))).status).toBe(reply_to_message_id ? 400 : 409)
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  null, { ...target, role: 'assistant' },
  ...['outstand_post_id', 'publisher_account_id', 'network', 'author_id'].map(key => ({ ...target, custom_data: { ...target.custom_data, [key]: 'other' } })),
  { ...target, custom_data: { ...fields } },
  { ...target, custom_data: { ...target.custom_data, source: 'outstand_dm' } },
])('rejects absent/cross-thread/non-inbound targets without sending: %j', async value => {
  from.mockReset().mockReturnValueOnce(query(conversation)).mockReturnValueOnce(query(value))
  const response = await POST(request())
  expect(response.status).toBe(409)
  expect((await response.json()).execution_started).toBe(false)
  expect(fetch).not.toHaveBeenCalled()
})

it('rejects target on a private DM even if comment-looking post metadata exists', async () => {
  from.mockReset().mockReturnValue(query({ ...conversation, custom_data: { ...fields, source: 'outstand_dm' } }))
  expect((await POST(request())).status).toBe(409)
  expect(fetch).not.toHaveBeenCalled()
})

it('allows an explicitly selected persisted comment in a legacy mixed conversation without inferring a target', async () => {
  from.mockReset().mockReturnValueOnce(query({ ...conversation, custom_data: {} })).mockReturnValueOnce(query(target))
  expect((await POST(request())).status).toBe(200)
  expect(JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body)).reply_to_message_id).toBe(targetId)
})

it('derives retry target from saved metadata and rejects retargeting', async () => {
  const saved = { content: 'Original reply', custom_data: { status: 'failed', reply_to_message_id: targetId } }
  from.mockReset().mockReturnValueOnce(query(conversation)).mockReturnValueOnce(query(saved)).mockReturnValueOnce(query(target))
  expect((await POST(request({ message_id: savedId, reply_to_message_id: undefined }))).status).toBe(200)
  expect(JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({ message: 'Original reply', reply_to_message_id: targetId })
  jest.mocked(fetch).mockClear()
  from.mockReset().mockReturnValueOnce(query(conversation)).mockReturnValueOnce(query(saved))
  expect((await POST(request({ message_id: savedId, reply_to_message_id: savedId }))).status).toBe(409)
  expect(fetch).not.toHaveBeenCalled()
})

it('fails closed on a target lookup error', async () => {
  from.mockReset().mockReturnValueOnce(query(conversation)).mockReturnValueOnce(query(null, { message: 'private detail' }))
  const response = await POST(request())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('private detail')
  expect(fetch).not.toHaveBeenCalled()
})

it.each(['sending', 'unknown', 'sent'])('does not restart a public reply with a delivery claim: %s', comment_delivery_status => {
  from.mockReset().mockReturnValueOnce(query(conversation)).mockReturnValueOnce(query({
    content: 'Reply', custom_data: { ...fields, status: 'failed', reply_to_message_id: targetId, comment_delivery_status },
  }))
  return POST(request({ message_id: savedId })).then(response => {
    expect(response.status).toBe(409)
    expect(fetch).not.toHaveBeenCalled()
  })
})