import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { useAutomationSnooze } from '@/app/hooks/useAutomationSnooze'

const read = jest.fn()
const callbacks: { update?: () => void; status?: (status: string) => void } = {}
const channel = { on: jest.fn(), subscribe: jest.fn() }
const removeChannel = jest.fn()
jest.mock('@/app/chat/automation-snooze-actions', () => ({ getConversationAutomationSnooze: (...args: unknown[]) => read(...args) }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ channel: () => channel, removeChannel }) }))

beforeEach(() => {
  jest.clearAllMocks()
  channel.on.mockImplementation((_type, _filter, callback) => { callbacks.update = callback; return channel })
  channel.subscribe.mockImplementation(callback => { callbacks.status = callback; return channel })
  read.mockResolvedValue({ data: { automation_paused_until: null, last_human_reply_at: null, automation_snooze_hours: null } })
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
)

it('re-reads server-authorized state after an update and reconnect, and cleans up on switch', async () => {
  const { result, rerender, unmount } = renderHook(({ id }) => useAutomationSnooze(id, 'site-1', 'user-1'), {
    initialProps: { id: 'conversation-1' }, wrapper,
  })
  await waitFor(() => expect(result.current.data?.automation_paused_until).toBeNull())
  const until = '2026-11-11T18:00:00Z'
  read.mockResolvedValue({ data: { automation_paused_until: until, last_human_reply_at: null, automation_snooze_hours: 2 } })
  await act(async () => callbacks.update?.())
  await waitFor(() => expect(result.current.data?.automation_paused_until).toBe(until))
  read.mockResolvedValue({ data: { automation_paused_until: null, last_human_reply_at: null, automation_snooze_hours: 0 } })
  await act(async () => callbacks.status?.('SUBSCRIBED'))
  await waitFor(() => expect(result.current.data?.automation_snooze_hours).toBe(0))
  expect(channel.on.mock.calls[0][1].filter).toBe('id=eq.conversation-1')
  rerender({ id: 'conversation-2' })
  await waitFor(() => expect(read).toHaveBeenCalledWith('conversation-2', 'site-1'))
  expect(removeChannel).toHaveBeenCalledTimes(1)
  unmount()
  expect(removeChannel).toHaveBeenCalledTimes(2)
})

it('does not subscribe or read when the user is absent', () => {
  renderHook(() => useAutomationSnooze('conversation-1', 'site-1'), { wrapper })
  expect(read).not.toHaveBeenCalled()
  expect(channel.on).not.toHaveBeenCalled()
})