import { act, renderHook } from '@testing-library/react'
import { useConversationListActions } from '@/app/hooks/useConversationListActions'
import { useRouter } from 'next/navigation'
import type { ConversationListItem } from '@/app/types/chat'

const from = jest.fn()
const eq = jest.fn()
const remove = jest.fn()
const update = jest.fn()
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from }) }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), info: jest.fn(), error: jest.fn() } }))

const item: ConversationListItem = { id: 'dm-1', title: 'Taylor', agentId: '', agentName: 'Agent', timestamp: new Date() }

function setup() {
  let items = [{ ...item }]
  const refreshConversations = jest.fn().mockResolvedValue(undefined)
  const onDeleteConversation = jest.fn().mockResolvedValue(undefined)
  const router: ReturnType<typeof useRouter> = {
    push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), prefetch: jest.fn(),
    back: jest.fn(), forward: jest.fn(), bfcacheId: 'test-route',
  }
  jest.mocked(useRouter).mockReturnValue(router)
  const hook = renderHook(() => useConversationListActions({
    siteId: 'site-1', selectedConversationId: item.id, refreshConversations, onDeleteConversation,
    updateConversations: updater => { items = updater(items) },
  }))
  return { ...hook, getItems: () => items, refreshConversations, onDeleteConversation, router }
}

beforeEach(() => {
  jest.clearAllMocks()
  from.mockReturnValue({ delete: remove, update })
  remove.mockReturnValue({ eq })
  update.mockReturnValue({ eq })
  eq.mockResolvedValue({ error: null })
})

it('preserves manual rename and modal state without writing on view', () => {
  const { result, getItems } = setup()
  expect(from).not.toHaveBeenCalled()
  act(() => { result.current.openRenameModal(item) })
  expect(result.current.renameModalOpen).toBe(true)
  expect(result.current.currentConversation).toEqual(item)
  act(() => { result.current.handleDirectTitleUpdate(item.id, 'Manual subject') })
  expect(getItems()[0].title).toBe('Manual subject')
  expect(from).not.toHaveBeenCalled()
})

it('preserves explicit archive and delete behavior after extraction', async () => {
  const archived = setup()
  await act(async () => { await archived.result.current.archiveConversation(item.id) })
  expect(update).toHaveBeenCalledWith({ is_archived: true })
  expect(archived.getItems()).toEqual([])
  expect(archived.router.push).toHaveBeenCalledWith('/chat')
  archived.unmount()
  const deleted = setup()
  await act(async () => { await deleted.result.current.deleteConversation(item.id) })
  expect(from).toHaveBeenCalledWith('messages')
  expect(from).toHaveBeenCalledWith('conversations')
  expect(deleted.onDeleteConversation).toHaveBeenCalledWith(item.id)
  expect(deleted.getItems()).toEqual([])
})

it('retains bulk moderation endpoints, events and refresh behavior (mocked only)', async () => {
  const { result, getItems, refreshConversations } = setup()
  jest.mocked(fetch).mockResolvedValueOnce({
    ok: true, json: async () => ({ success: true, updatedCount: 1, conversationIds: [item.id] }),
  } as Response)
  await act(async () => { await result.current.handleAcceptAllPending() })
  expect(fetch).toHaveBeenLastCalledWith('/api/conversations/accept-all-pending', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ siteId: 'site-1' }),
  }))
  expect(getItems()[0].hasAcceptedMessage).toBe(true)
  jest.mocked(fetch).mockResolvedValueOnce({
    ok: true, json: async () => ({ success: true, deletedMessages: 1, deletedConversations: 1, conversationsToDelete: [item.id] }),
  } as Response)
  await act(async () => { await result.current.handleRejectAllPending() })
  expect(fetch).toHaveBeenLastCalledWith('/api/conversations/reject-all-pending', expect.objectContaining({ method: 'POST' }))
  expect(getItems()).toEqual([])
  expect(refreshConversations).toHaveBeenCalledTimes(1)
})