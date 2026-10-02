/** @jest-environment node */

import { POST } from '@/app/api/conversations/accept-message/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { ApprovalConversation, Metadata } from '@/app/api/conversations/accept-message/comment-approval'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))

const siteId = '10000000-0000-4000-8000-000000000001'
const conversationId = '10000000-0000-4000-8000-000000000002'
const messageId = '10000000-0000-4000-8000-000000000003'
const targetId = '10000000-0000-4000-8000-000000000004'
const otherId = '10000000-0000-4000-8000-000000000005'
const fields = {
  source: 'comment', network: 'instagram', channel: 'instagram',
  publisher_account_id: 'publisher-a', outstand_post_id: 'post-a', author_id: 'author-a',
  platform_post_id: 'provider-post',
}
const from = jest.fn()
const rpc = jest.fn()
const getUser = jest.fn()

function query(data: unknown, error: unknown = null) {
  const result = { data, error }
  const chain = {
    select: jest.fn(), eq: jest.fn(), is: jest.fn(), update: jest.fn(), limit: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  for (const fn of [chain.select, chain.eq, chain.is, chain.update, chain.limit]) fn.mockReturnValue(chain)
  return chain
}

function fixture() {
  const conversation: ApprovalConversation = {
    id: conversationId, site_id: siteId, channel: 'instagram', status: 'pending',
    custom_data: { ...fields, comment_grouping_version: 1 },
  }
  const saved: Metadata = {
    ...fields, status: 'pending', reply_to_message_id: targetId, reply_to_comment_id: 'provider-comment',
    publisher_username: 'publisher', parent_comment_id: 'original-parent',
    platform_post_url: 'https://www.instagram.com/p/post-a', custom_workflow: { keep: true },
  }
  const message = { id: messageId, conversation_id: conversationId, content: 'A reply', role: 'assistant', custom_data: saved, conversations: conversation }
  const target = { id: targetId, conversation_id: conversationId, role: 'user', custom_data: { ...fields, platform_comment_id: 'provider-comment' } as Metadata, conversations: { site_id: siteId } }
  const read = query(message)
  const targetRead = query(target)
  const update = query({ id: messageId })
  const conversationUpdate = query(null)
  from.mockReset().mockReturnValueOnce(read).mockReturnValueOnce(targetRead)
    .mockReturnValueOnce(update).mockReturnValueOnce(conversationUpdate)
  return { conversation, message, target, read, targetRead, update, conversationUpdate }
}

function request(body: unknown = { messageId }, extraHeaders: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/conversations/accept-message', {
    method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: otherId } }, error: null })
  rpc.mockResolvedValue({ data: true, error: null })
  jest.mocked(createClient).mockResolvedValue({ from, rpc, auth: { getUser } })
})

afterEach(() => {
  expect(createServiceClient).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('approves the exact authorized inbound target and preserves every saved routing field', async () => {
  const f = fixture()
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ success: true, updatedCustomData: { ...f.message.custom_data, status: 'accepted' } })
  expect(response.headers.get('cache-control')).toBe('no-store, private')
  expect(createClient).toHaveBeenCalledWith(true)
  expect(getUser.mock.invocationCallOrder[0]).toBeLessThan(from.mock.invocationCallOrder[0])
  expect(rpc).toHaveBeenCalledWith('user_can', { p_site_id: siteId, p_command: 'update' })
  expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(f.update.update.mock.invocationCallOrder[0])
  expect(f.targetRead.eq.mock.calls).toEqual([
    ['id', targetId], ['conversation_id', conversationId], ['conversations.site_id', siteId], ['role', 'user'],
  ])
  expect(f.update.eq).toHaveBeenCalledWith('custom_data', JSON.stringify(f.message.custom_data))
  expect(f.update.eq).toHaveBeenCalledWith('custom_data->>status', 'pending')
  expect(f.update.eq).toHaveBeenCalledWith('content', 'A reply')
  expect(f.update.eq).toHaveBeenCalledWith('role', 'assistant')
  expect(f.update.eq).toHaveBeenCalledWith('conversation_id', conversationId)
  expect(f.conversationUpdate.eq).toHaveBeenCalledWith('site_id', siteId)
  expect(f.conversationUpdate.eq).toHaveBeenCalledWith('status', 'pending')
})

it.each([null, { id: otherId }])('rejects an anonymous or invalid session before any database access: %j', async user => {
  fixture()
  getUser.mockResolvedValue({ data: { user }, error: user ? { message: 'Invalid token' } : null })
  expect((await POST(request())).status).toBe(401)
  expect(from).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})

it.each([false, null, 'true'])('requires the site update capability, not just read access: %j', async data => {
  const f = fixture()
  rpc.mockResolvedValue({ data, error: null })
  expect((await POST(request())).status).toBe(403)
  expect(from).toHaveBeenCalledTimes(1)
  expect(f.update.update).not.toHaveBeenCalled()
})

it('fails closed when authorization lookup errors', async () => {
  fixture()
  rpc.mockResolvedValue({ data: true, error: { message: 'private detail' } })
  const response = await POST(request())
  expect(response.status).toBe(403)
  expect(await response.text()).not.toContain('private detail')
})

it('does not expose a message hidden by cross-site RLS', async () => {
  const f = fixture()
  f.read.maybeSingle.mockResolvedValue({ data: null, error: null })
  expect((await POST(request())).status).toBe(404)
  expect(rpc).not.toHaveBeenCalled()
  expect(f.update.update).not.toHaveBeenCalled()
})

it.each([null, [], {}, { messageId: 'bad' }, { messageId, site_id: otherId }, { messageId, reply_to_message_id: otherId }])(
  'rejects malformed input and client-controlled routing: %j', async body => {
    fixture()
    expect((await POST(request(body))).status).toBe(400)
    expect(createClient).not.toHaveBeenCalled()
  },
)

it('rejects invalid JSON', async () => {
  fixture()
  const response = await POST(new Request('http://localhost:3000/api/conversations/accept-message', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
  }))
  expect(response.status).toBe(400)
  expect(createClient).not.toHaveBeenCalled()
})

it.each([
  [{ origin: 'https://other.example' }, 403], [{ 'sec-fetch-site': 'cross-site' }, 403],
  [{ 'content-type': 'text/plain' }, 415], [{ 'content-length': '4097' }, 413],
] as const)('rejects unsafe request headers %j', async (extraHeaders, status) => {
  fixture()
  expect((await POST(request({ messageId }, extraHeaders))).status).toBe(status)
  expect(createClient).not.toHaveBeenCalled()
})

it('limits the actual streamed body even without a Content-Length', async () => {
  fixture()
  expect((await POST(request({ messageId, padding: 'a'.repeat(4096) }))).status).toBe(413)
  expect(createClient).not.toHaveBeenCalled()
})

it.each(['reply_to_message_id', 'reply_to_comment_id'])('blocks missing %s without inferring a latest target', async key => {
  const f = fixture()
  delete f.message.custom_data[key]
  f.message.custom_data.platform_comment_id = 'legacy-provider-comment'
  expect((await POST(request())).status).toBe(409)
  expect(from).toHaveBeenCalledTimes(1)
  expect(f.update.update).not.toHaveBeenCalled()
})

it.each(['publisher_account_id', 'outstand_post_id', 'author_id', 'network', 'platform_post_id', 'platform_comment_id'])('rejects a target with a different %s', async key => {
  const f = fixture()
  f.target.custom_data[key] = 'other'
  expect((await POST(request())).status).toBe(409)
  expect(f.update.update).not.toHaveBeenCalled()
})

it.each(['publisher_account_id', 'outstand_post_id', 'author_id', 'network'])('requires the canonical conversation %s to match the target', async key => {
  const f = fixture()
  ;(f.conversation.custom_data as Metadata)[key] = 'other'
  expect((await POST(request())).status).toBe(409)
  expect(f.update.update).not.toHaveBeenCalled()
})

it.each(['site', 'conversation', 'role', 'id', 'private-dm', 'absent'])('rejects an invalid persisted inbound target: %s', async kind => {
  const f = fixture()
  if (kind === 'site') f.target.conversations.site_id = otherId
  if (kind === 'conversation') f.target.conversation_id = otherId
  if (kind === 'role') f.target.role = 'assistant'
  if (kind === 'id') f.target.id = otherId
  if (kind === 'private-dm') f.target.custom_data.source = 'outstand_dm'
  if (kind === 'absent') f.targetRead.maybeSingle.mockResolvedValue({ data: null, error: null })
  expect((await POST(request())).status).toBe(409)
  expect(f.update.update).not.toHaveBeenCalled()
})

it.each(['user', 'system'])('never approves an inbound or system message (%s)', async role => {
  const f = fixture()
  f.message.role = role
  expect((await POST(request())).status).toBe(409)
  expect(f.update.update).not.toHaveBeenCalled()
})

it.each(['sent', 'failed', 'rejected', 'sending', undefined])('requires pending status, not %s', async status => {
  const f = fixture()
  f.message.custom_data.status = status
  expect((await POST(request())).status).toBe(409)
  expect(f.update.update).not.toHaveBeenCalled()
})

it.each(['sending', 'unknown', 'sent'])('does not modify a pending message with delivery claim %s', async comment_delivery_status => {
  const f = fixture()
  f.message.custom_data.comment_delivery_status = comment_delivery_status
  expect((await POST(request())).status).toBe(409)
  expect(f.update.update).not.toHaveBeenCalled()
})

it.each([undefined, 'sending', 'unknown', 'sent'])('accepted approvals are read-only and idempotent with claim %s', async claim => {
  const f = fixture()
  f.message.custom_data.status = 'accepted'
  if (claim) f.message.custom_data.comment_delivery_status = claim
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ success: true, updatedCustomData: f.message.custom_data })
  expect(f.update.update).not.toHaveBeenCalled()
  expect(f.conversationUpdate.update).not.toHaveBeenCalled()
})

it('does not retarget an already-accepted proposal with invalid target metadata', async () => {
  const f = fixture()
  f.message.custom_data.status = 'accepted'
  f.message.custom_data.reply_to_comment_id = 'wrong-parent'
  expect((await POST(request())).status).toBe(409)
  expect(f.update.update).not.toHaveBeenCalled()
})

it('returns conflict when the pending/metadata/content compare-and-set loses a race', async () => {
  const f = fixture()
  f.update.maybeSingle.mockResolvedValue({ data: null, error: null })
  expect((await POST(request())).status).toBe(409)
  expect(f.update.eq).toHaveBeenCalledWith('custom_data->>status', 'pending')
  expect(f.update.eq).toHaveBeenCalledWith('custom_data', JSON.stringify(f.message.custom_data))
  expect(f.conversationUpdate.update).not.toHaveBeenCalled()
})

it('allows a legacy conversation only with the saved exact target and unchanged destination', async () => {
  const f = fixture()
  f.conversation.custom_data = {}
  f.message.role = 'team_member'
  expect((await POST(request())).status).toBe(200)
  expect(f.update.update).toHaveBeenCalledWith(expect.objectContaining({ custom_data: { ...f.message.custom_data, status: 'accepted' } }))
})

it('detects legacy mixed comments but never selects one as a missing reply target', async () => {
  const f = fixture()
  f.conversation.custom_data = {}
  f.message.custom_data = { status: 'pending' }
  const presence = query([{ id: targetId }])
  from.mockReset().mockReturnValueOnce(f.read).mockReturnValueOnce(presence)
  expect((await POST(request())).status).toBe(409)
  expect(presence.eq).toHaveBeenCalledWith('custom_data->>source', 'comment')
  expect(presence.limit).toHaveBeenCalledWith(1)
  expect(f.update.update).not.toHaveBeenCalled()
})

it.each(['email', 'whatsapp', 'web', 'voice', 'instagram'])('preserves ordinary %s approval routing', async channel => {
  const f = fixture()
  f.conversation.channel = channel
  f.conversation.custom_data = channel === 'instagram' ? { source: 'outstand_dm', outstand_conversation_id: 'dm-id' } : {}
  f.message.custom_data = { status: 'pending', channel, thread_id: 'thread-id', outstand_conversation_id: 'dm-id' }
  from.mockReset().mockReturnValueOnce(f.read).mockReturnValueOnce(f.update).mockReturnValueOnce(f.conversationUpdate)
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ success: true, updatedCustomData: { ...f.message.custom_data, status: 'accepted' } })
  expect(f.targetRead.select).not.toHaveBeenCalled()
})

it.each(['read', 'targetRead', 'update'] as const)('returns safe errors on database failure at %s', async stage => {
  const f = fixture()
  f[stage].maybeSingle.mockResolvedValue({ data: null, error: { message: 'private provider detail' } })
  const response = await POST(request())
  expect(response.status).toBe(stage === 'update' ? 500 : 503)
  expect(await response.text()).not.toContain('private provider detail')
  expect(f.conversationUpdate.update).not.toHaveBeenCalled()
})

it('still reports durable approval when the secondary conversation update throws', async () => {
  const f = fixture()
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  f.conversationUpdate.update.mockImplementation(() => { throw new Error('private detail') })
  try {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, updatedCustomData: { status: 'accepted' } })
    expect(log).toHaveBeenCalledWith('Accepted message; conversation status update unavailable')
  } finally { log.mockRestore() }
})

it.each([
  { reply_to_message_id: 'invalid-uuid' }, { reply_to_comment_id: 'invalid comment id' },
  { network: 'facebook' }, { channel: 'comment' }, { source: 'outstand_dm' },
  { outstand_conversation_id: 'private-thread' }, { author_id: null },
  { outstand_post_id: 'unsafe/post' }, { publisher_account_id: 123 },
])('rejects invalid saved destination metadata without rewriting it: %j', async changed => {
  const f = fixture()
  Object.assign(f.message.custom_data, changed)
  expect((await POST(request())).status).toBe(409)
  expect(f.update.update).not.toHaveBeenCalled()
})

it('does not require or create a channel field on an exact comment proposal', async () => {
  const f = fixture()
  delete f.message.custom_data.channel
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect((await response.json()).updatedCustomData).not.toHaveProperty('channel')
})

it('keeps explicitly targeted legacy author-unavailable metadata unchanged', async () => {
  const f = fixture()
  f.conversation.custom_data = {}
  delete f.message.custom_data.author_id
  delete f.target.custom_data.author_id
  expect((await POST(request())).status).toBe(200)
  expect(f.update.update).toHaveBeenCalledWith(expect.objectContaining({ custom_data: { ...f.message.custom_data, status: 'accepted' } }))
})

it('uses a legacy inbound platform_comment_id as evidence only for the explicit saved source', async () => {
  const f = fixture()
  f.conversation.custom_data = {}
  delete f.target.custom_data.reply_to_comment_id
  expect((await POST(request())).status).toBe(200)
  expect(f.targetRead.eq).toHaveBeenCalledWith('id', targetId)
})

it('accepts ordinary social conversations with no comment records without inventing a target', async () => {
  const f = fixture()
  f.conversation.custom_data = {}
  f.message.custom_data = { status: 'pending', channel: 'instagram' }
  from.mockReset().mockReturnValueOnce(f.read).mockReturnValueOnce(query([]))
    .mockReturnValueOnce(f.update).mockReturnValueOnce(f.conversationUpdate)
  expect((await POST(request())).status).toBe(200)
})

it.each(['claim', 'target', 'moderation', 'content'])('the CAS cannot overwrite a concurrent %s change', async kind => {
  const f = fixture()
  const concurrent = structuredClone(f.message)
  if (kind === 'claim') concurrent.custom_data.comment_delivery_status = 'sending'
  if (kind === 'target') concurrent.custom_data.reply_to_comment_id = 'another-comment'
  if (kind === 'moderation') concurrent.custom_data.status = 'rejected'
  if (kind === 'content') concurrent.content = 'Changed reply'
  f.update.maybeSingle.mockImplementation(async () => {
    const values: Record<string, unknown> = {
      ...concurrent, custom_data: JSON.stringify(concurrent.custom_data),
      'custom_data->>status': concurrent.custom_data.status,
    }
    const matched = f.update.eq.mock.calls.every(([key, value]) => values[key] === value)
    if (matched) concurrent.custom_data = f.update.update.mock.calls[0][0].custom_data
    return { data: matched ? { id: messageId } : null, error: null }
  })
  const before = structuredClone(concurrent)
  expect((await POST(request())).status).toBe(409)
  expect(concurrent).toEqual(before)
  expect(f.conversationUpdate.update).not.toHaveBeenCalled()
})