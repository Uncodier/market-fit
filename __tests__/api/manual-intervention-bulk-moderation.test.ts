/** @jest-environment node */
import { NextRequest } from 'next/server'
import { POST as accept } from '@/app/api/conversations/accept-all-pending/route'
import { POST as reject } from '@/app/api/conversations/reject-all-pending/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { acquireOperationLease } from '@/lib/redis/operation-lease'
import { PROPOSAL_FILTER } from '@/lib/chat/manual-intervention'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock('@/lib/redis/operation-lease', () => ({ acquireOperationLease: jest.fn() }))
const siteId = '00000000-0000-4000-8000-000000000001'
const proposal = { id: 'proposal', conversation_id: 'conversation', custom_data: { status: 'pending' } }
function query(data: unknown, count?: number) {
  const result = { data, count, error: null }
  return { select: jest.fn().mockReturnThis(), delete: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), or: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue(result), single: jest.fn().mockResolvedValue(result),
    then: (resolve: (r: typeof result) => unknown) => Promise.resolve(result).then(resolve) }
}
function setup(...queries: ReturnType<typeof query>[]) {
  const from = jest.fn()
  for (const q of queries) from.mockReturnValueOnce(q)
  jest.mocked(createClient).mockResolvedValue({ from: () => query({ id: siteId }), auth: {
    getSession: () => ({ data: { session: {} } }),
  } } as never)
  jest.mocked(createServiceClient).mockResolvedValue({ from } as never)
  jest.mocked(acquireOperationLease).mockResolvedValue({ release: jest.fn() } as never)
  return new NextRequest('http://localhost:3000', { method: 'POST', body: JSON.stringify({ siteId }) })
}

it.each([['accept', accept], ['reject', reject]] as const)('filters manual interventions on bulk %s at selection AND mutation', async (op, post) => {
  const read = query([proposal])
  // A candidate has been claimed since selection. Its conditional write returns no rows.
  const write = query(op === 'accept' ? null : [])
  const response = await post(setup(read, write))
  expect(response.status).toBe(200)
  expect(read.or).toHaveBeenCalledWith(PROPOSAL_FILTER)
  expect(write.or).toHaveBeenCalledWith(PROPOSAL_FILTER)
  expect(await response.json()).toMatchObject(op === 'accept' ? { updatedCount: 0, conversationIds: [] } : { deletedMessages: 0, conversationsToDelete: [] })
})

it('does not remove a previously empty parent when a direct reply wins the race', async () => {
  const parentDelete = query([])
  const response = await reject(setup(query([proposal]), query([proposal]), query(null, 0), parentDelete))
  expect(parentDelete.eq).toHaveBeenCalledWith('site_id', siteId)
  expect(parentDelete.eq).toHaveBeenCalledWith('message_count', 0)
  expect(await response.json()).toMatchObject({ success: true, deletedMessages: 1, deletedConversations: 0, conversationsToDelete: [] })
})
