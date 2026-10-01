import { act, renderHook } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { useConversationRealtime } from '@/app/hooks/useConversationRealtime'
import type { ConversationListItem } from '@/app/types/chat'
import type { ConversationListRow } from '@/app/services/conversations/conversation-list-query'

const callbacks: Record<string, (payload: { new?: unknown; old?: unknown }) => void> = {}
const channel = { on: jest.fn(), subscribe: jest.fn() }
const removeChannel = jest.fn()
const mutate = jest.fn()
const from = jest.fn()
const query = { select: jest.fn(), in: jest.fn(), or: jest.fn() }
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ channel: () => channel, removeChannel, from }) }))
jest.mock('swr', () => ({ useSWRConfig: () => ({ mutate }) }))
jest.mock('@/app/services/user-service', () => ({ getUserData: jest.fn() }))

const row: ConversationListRow = {
  id: 'dm-1', title: 'Instagram direct message', agent_id: null, lead_id: null,
  channel: 'instagram', status: 'active', created_at: '2026-09-30T00:00:00Z', last_message_at: '2026-09-30T01:00:00Z',
  custom_data: { source: 'outstand_dm', participant_display_name: 'Taylor' },
}

beforeEach(() => {
  jest.clearAllMocks()
  channel.on.mockImplementation((_type, filter, callback) => { callbacks[filter.event] = callback; return channel })
  channel.subscribe.mockReturnValue(channel)
  from.mockReturnValue(query)
  query.select.mockReturnValue(query)
  query.in.mockResolvedValue({ data: [], error: null })
  // Moderation filters use .in().or(); lead-name lookups stop after .in().
  from.mockImplementation((table: string) => table === 'messages'
    ? { select: () => ({ in: () => ({ or: async () => ({ data: [], error: null }) }) }) }
    : query)
})

it('maps realtime inserts/updates using the same identity rules and revalidates only the selected header', async () => {
  let items: ConversationListItem[] = []
  const updateConversations = jest.fn((update: (previous: ConversationListItem[]) => ConversationListItem[]) => { items = update(items) })
  const { unmount } = renderHook(() => useConversationRealtime({
    siteId: 'site-1', selectedConversationId: row.id, updateConversations, refreshConversations: jest.fn(),
  }))
  await act(async () => { callbacks.INSERT({ new: row }) })
  expect(items[0]).toMatchObject({ title: 'Taylor', participantName: 'Taylor', leadName: undefined })
  expect(mutate).toHaveBeenCalledWith(['lead-data', 'dm-1', 'site-1'])
  items[0].lastMessage = 'Keep preview'
  query.in.mockResolvedValue({ data: [{ id: 'lead-1', name: 'Manual CRM name' }], error: null })
  await act(async () => { callbacks.UPDATE({ new: { ...row, title: 'Manual subject', lead_id: 'lead-1' } }) })
  expect(items[0]).toMatchObject({ title: 'Manual subject', participantName: 'Manual CRM name', leadName: 'Manual CRM name', lastMessage: 'Keep preview' })
  await act(async () => { callbacks.UPDATE({ new: { ...row, title: 'Manual subject', lead_id: 'lead-1', last_message: 'New preview' } }) })
  expect(items[0].lastMessage).toBe('New preview')
  expect(channel.on.mock.calls.every(call => call[1].filter === 'site_id=eq.site-1')).toBe(true)
  unmount()
  expect(removeChannel).toHaveBeenCalledWith(channel)
  await act(async () => { callbacks.INSERT({ new: { ...row, id: 'after-unmount' } }) })
  expect(items).toHaveLength(1)
})

it('retains truthful unknown identity and removes deleted selected conversations', async () => {
  let items: ConversationListItem[] = []
  const router = { ...useRouter(), push: jest.fn() }
  jest.mocked(useRouter).mockReturnValue(router)
  renderHook(() => useConversationRealtime({
    siteId: 'site-1', selectedConversationId: 'dm-1', refreshConversations: jest.fn(),
    updateConversations: update => { items = update(items) },
  }))
  await act(async () => { callbacks.INSERT({ new: { ...row, custom_data: { source: 'outstand_dm', outstand_social_account_id: 'owned' } } }) })
  expect(items[0]).toMatchObject({ title: 'Instagram contact', participantName: 'Instagram contact', leadName: undefined })
  await act(async () => { callbacks.DELETE({ old: { id: 'dm-1' } }) })
  expect(items).toEqual([])
  expect(router.push).toHaveBeenCalledWith('/chat')
})

it('keeps list reads available when realtime setup fails', () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  channel.subscribe.mockImplementationOnce(() => { throw new Error('Realtime unavailable') })
  expect(() => renderHook(() => useConversationRealtime({
    siteId: 'site-1', updateConversations: jest.fn(), refreshConversations: jest.fn(),
  }))).not.toThrow()
  expect(warning).toHaveBeenCalledWith('Conversation realtime is unavailable')
  warning.mockRestore()
})