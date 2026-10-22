import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { useChatMessages } from '@/app/hooks/useChatMessages'
import { getConversationMessages } from '@/app/services/getConversationMessages.client'
import { createClient } from '@/lib/supabase/client'
import { createChatMessageRead } from '@/app/hooks/chat-message-read'

jest.mock('@/app/services/getConversationMessages.client', () => ({ getConversationMessages: jest.fn() }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
let mockUserId = 'reader-1'
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: mockUserId } }) }))
jest.mock('@/app/hooks/useApiRequestTracker', () => ({ useApiRequestTracker: () => ({ hasActiveChatRequest: () => false }) }))

const message = { id: 'message-1', role: 'user', text: 'Loaded history', timestamp: new Date(0) }
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(settle => { resolve = settle })
  return { promise, resolve }
}
let callbacks: Array<(payload: unknown) => void>
let channels: Array<{ unsubscribe: jest.Mock }>
const flush = async (ms = 0) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms) }) }
const mount = (conversation = 'conversation-1') => {
  const cache = new Map()
  const wrapper = ({ children }: { children: React.ReactNode }) => <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>{children}</SWRConfig>
  return renderHook(({ id }) => useChatMessages(id, 'agent', 'Agent', false), { initialProps: { id: conversation }, wrapper })
}
beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockUserId = 'reader-1'
  callbacks = []
  channels = []
  jest.mocked(createClient).mockReturnValue({
    realtime: { isConnected: () => true },
    channel: jest.fn(() => {
      const channel: { on: jest.Mock; subscribe: jest.Mock; unsubscribe: jest.Mock } = {
        on: jest.fn((_type, _filter, callback) => { callbacks.push(callback); return channel }),
        subscribe: jest.fn(callback => { callback('SUBSCRIBED'); return channel }),
        unsubscribe: jest.fn(),
      }
      channels.push(channel)
      return channel
    }),
  } as unknown as ReturnType<typeof createClient>)
})
afterEach(() => { jest.useRealTimers() })

it('keeps loaded SWR history when a refresh rejects instead of clearing the window', async () => {
  jest.mocked(getConversationMessages).mockResolvedValueOnce([message] as any)
    .mockRejectedValueOnce(Object.assign(new Error('Unable to load conversation messages'), { code: '42501' }))
  const hook = mount()
  await flush()
  expect(getConversationMessages).toHaveBeenCalledTimes(1)
  expect(hook.result.current.chatMessages[0].text).toBe('Loaded history')
  // SWR retains the rejected fetch as its error state; bound mutate itself resolves.
  await act(async () => { await hook.result.current.syncMessages() })
  expect(hook.result.current.messageReadError).toMatchObject({ code: '42501' })
  expect(hook.result.current.chatMessages[0].text).toBe('Loaded history')
  hook.unmount()
})

it('coalesces slow event and focus bursts into one read plus one completion-aware follow-up', async () => {
  const slow = deferred<any[]>()
  jest.mocked(getConversationMessages).mockResolvedValueOnce([message] as any)
    .mockReturnValueOnce(slow.promise).mockResolvedValue([message] as any)
  const hook = mount()
  await flush()
  callbacks[0]({ eventType: 'INSERT' })
  await flush(300)
  expect(getConversationMessages).toHaveBeenCalledTimes(2)
  for (let index = 0; index < 20; index++) {
    callbacks[0]({ eventType: 'UPDATE' })
    window.dispatchEvent(new Event('focus'))
  }
  await flush(1000)
  expect(getConversationMessages).toHaveBeenCalledTimes(2)
  await act(async () => { slow.resolve([message]); await slow.promise })
  await flush()
  expect(getConversationMessages).toHaveBeenCalledTimes(3)
  hook.unmount()
  expect(channels[0].unsubscribe).toHaveBeenCalledTimes(1)
  await flush(3000) // Allow SWR's own short-lived dedupe cleanup timers to settle.
  expect(jest.getTimerCount()).toBe(0)
})

it('aborts stale reads and blocks old subscriptions and saved callbacks after identity changes', async () => {
  const old = deferred<any[]>()
  jest.mocked(getConversationMessages).mockReturnValueOnce(old.promise).mockResolvedValue([])
  const hook = mount()
  await flush()
  const oldSignal = jest.mocked(getConversationMessages).mock.calls[0][1]?.signal
  const oldSync = hook.result.current.syncMessages
  mockUserId = 'reader-2'
  hook.rerender({ id: 'conversation-2' })
  await flush()
  expect(oldSignal?.aborted).toBe(true)
  expect(channels[0].unsubscribe).toHaveBeenCalledTimes(1)
  callbacks[0]({ eventType: 'INSERT' })
  await oldSync()
  await flush(1000)
  expect(getConversationMessages).toHaveBeenCalledTimes(2)
  await act(async () => { old.resolve([message]); await old.promise })
  expect(hook.result.current.chatMessages).toEqual([])
  hook.unmount()
})

it('singleflight retains the physical promise even after cancellation', async () => {
  const slow = deferred<string>()
  const read = jest.fn(() => slow.promise)
  const owner = createChatMessageRead(read)
  const first = owner.read()
  await Promise.resolve()
  owner.abort()
  expect(owner.read()).toBe(first)
  expect(read).toHaveBeenCalledTimes(1)
  slow.resolve('settled')
  await first
  expect(owner.read()).not.toBe(first)
})