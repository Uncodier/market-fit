import { act, renderHook } from '@testing-library/react'
import { useMessageSending } from '@/app/components/simple-messages-view/hooks/useMessageSending'
import { sendAssistantMessage } from '@/app/components/simple-messages-view/hooks/message-send-handlers'
import { enqueuePendingWork } from '@/app/components/simple-messages-view/hooks/pending-work'

const toast = jest.fn()
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site' } }) }))
jest.mock('@/app/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }))
jest.mock('@/app/components/simple-messages-view/hooks/message-send-handlers', () => ({
  sendAssistantMessage: jest.fn(), sendRobotMessage: jest.fn(),
}))
jest.mock('@/app/components/simple-messages-view/hooks/pending-work', () => ({
  buildPendingWorkPayload: jest.fn().mockResolvedValue({}), enqueuePendingWork: jest.fn().mockResolvedValue(true),
}))

function props() {
  return {
    activeRobotInstance: { id: 'instance' }, selectedActivity: 'ask', selectedContext: {} as any,
    skillSelection: { skill_mode: 'auto', skill_slugs: [] } as any,
    messageRef: { current: 'hello' }, logsRef: { current: [] as any[] }, onAddOptimisticMessage: jest.fn(),
  }
}

beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers() })
afterEach(() => { jest.useRealTimers() })

it.each([false, true])('clears sending/thinking on terminal result %s without waiting for realtime', async result => {
  ;(sendAssistantMessage as jest.Mock).mockResolvedValue(result)
  const hook = renderHook(() => useMessageSending(props()))
  await act(async () => { await hook.result.current.handleSendMessage() })
  expect(hook.result.current.isSendingMessage).toBe(false)
  expect(hook.result.current.isWaitingForResponse).toBe(false)
  expect(hook.result.current.waitingForMessageId).toBeNull()
  hook.unmount()
})

it('does not silently unlock while an accepted workflow is still streaming', async () => {
  let complete!: (result: boolean) => void
  ;(sendAssistantMessage as jest.Mock).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const options = props()
  const hook = renderHook(() => useMessageSending(options))
  let pending!: Promise<void>
  act(() => { pending = hook.result.current.handleSendMessage() })
  await act(async () => { await jest.advanceTimersByTimeAsync(6 * 60 * 1000) })
  expect(hook.result.current.isSendingMessage).toBe(true)
  expect(hook.result.current.isWaitingForResponse).toBe(true)
  options.messageRef.current = 'a new command'
  await act(async () => { await hook.result.current.handleSendMessage() })
  expect(sendAssistantMessage).toHaveBeenCalledTimes(1)
  expect(enqueuePendingWork).toHaveBeenCalledTimes(1)
  await act(async () => { complete(true); await pending })
  expect(hook.result.current.isWaitingForResponse).toBe(false)
  hook.unmount()
})

it('does not queue behind a stale optimistic row after a failed send', async () => {
  ;(sendAssistantMessage as jest.Mock).mockResolvedValue(false)
  const options = props()
  options.logsRef.current = [{ log_type: 'user_action', details: { temp_message: true, status: 'running' } }]
  const hook = renderHook(() => useMessageSending(options))
  await act(async () => { await hook.result.current.handleSendMessage() })
  expect(sendAssistantMessage).toHaveBeenCalledTimes(1)
  expect(enqueuePendingWork).not.toHaveBeenCalled()
  hook.unmount()
})

it('shows a fallback error when an unexpected dispatch exception escapes', async () => {
  ;(sendAssistantMessage as jest.Mock).mockRejectedValue(new Error('Unexpected failure'))
  const hook = renderHook(() => useMessageSending(props()))
  await act(async () => { await hook.result.current.handleSendMessage() })
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
  expect(hook.result.current.isSendingMessage).toBe(false)
  expect(hook.result.current.isWaitingForResponse).toBe(false)
  hook.unmount()
})

it('does not queue the retained in-flight assistant draft on a second click', async () => {
  let complete!: (result: boolean) => void
  ;(sendAssistantMessage as jest.Mock).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const options = props()
  const onClearMessage = jest.fn(() => { options.messageRef.current = '' })
  const hook = renderHook(() => useMessageSending({ ...options, onClearMessage }))
  let pending!: Promise<void>
  act(() => { pending = hook.result.current.handleSendMessage() })
  await act(async () => { await hook.result.current.handleSendMessage() })
  expect(sendAssistantMessage).toHaveBeenCalledTimes(1)
  expect(enqueuePendingWork).not.toHaveBeenCalled()
  expect(onClearMessage).not.toHaveBeenCalled()
  await act(async () => { complete(false); await pending })
  expect(options.messageRef.current).toBe('hello')
  expect(onClearMessage).not.toHaveBeenCalled()
  expect(options.onAddOptimisticMessage).not.toHaveBeenCalled()
  hook.unmount()
})

it.each([false, true])('clears only the successfully sent draft, preserving new edits: %s', async edited => {
  let complete!: (result: boolean) => void
  ;(sendAssistantMessage as jest.Mock).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const options = props()
  const onClearMessage = jest.fn(() => { options.messageRef.current = '' })
  const hook = renderHook(() => useMessageSending({ ...options, onClearMessage }))
  let pending!: Promise<void>
  act(() => { pending = hook.result.current.handleSendMessage() })
  if (edited) options.messageRef.current = 'new draft'
  await act(async () => { complete(true); await pending })
  expect(options.messageRef.current).toBe(edited ? 'new draft' : '')
  expect(onClearMessage).toHaveBeenCalledTimes(edited ? 0 : 1)
  hook.unmount()
})

it.each([false, true])('clears the admitted assistant draft before completion, preserving later edits: %s', async edited => {
  let accept!: () => void
  let complete!: (result: boolean) => void
  ;(sendAssistantMessage as jest.Mock).mockImplementation(({ onAccepted }) => {
    accept = onAccepted
    return new Promise(resolve => { complete = resolve })
  })
  const options = props()
  const onClearMessage = jest.fn(() => { options.messageRef.current = '' })
  const hook = renderHook(() => useMessageSending({ ...options, onClearMessage }))
  let pending!: Promise<void>
  act(() => { pending = hook.result.current.handleSendMessage() })
  expect(sendAssistantMessage).toHaveBeenCalledWith(expect.objectContaining({ messageToSend: 'hello', onAccepted: expect.any(Function) }))
  if (edited) options.messageRef.current = 'new draft'
  act(() => { accept() })
  expect(options.messageRef.current).toBe(edited ? 'new draft' : '')
  expect(onClearMessage).toHaveBeenCalledTimes(edited ? 0 : 1)
  expect(hook.result.current.isSendingMessage).toBe(true)
  await act(async () => { complete(true); await pending })
  expect(onClearMessage).toHaveBeenCalledTimes(edited ? 0 : 1)
  hook.unmount()
})

it('does not clear another conversation draft after a late successful send', async () => {
  let complete!: (result: boolean) => void
  ;(sendAssistantMessage as jest.Mock).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const options = props()
  const onClearMessage = jest.fn(() => { options.messageRef.current = '' })
  const hook = renderHook(({ instance }) => useMessageSending({
    ...options, activeRobotInstance: { id: instance }, onClearMessage,
  }), { initialProps: { instance: 'instance' } })
  let pending!: Promise<void>
  act(() => { pending = hook.result.current.handleSendMessage() })
  hook.rerender({ instance: 'other-instance' })
  await act(async () => { complete(true); await pending })
  expect(onClearMessage).not.toHaveBeenCalled()
  expect(options.messageRef.current).toBe('hello')
  hook.unmount()
})

it('keeps a rejected first-message draft and resets the new conversation sent state', async () => {
  ;(sendAssistantMessage as jest.Mock).mockResolvedValue(false)
  const options = props()
  const onClearMessage = jest.fn()
  const onMessageSent = jest.fn()
  const hook = renderHook(() => useMessageSending({
    ...options, activeRobotInstance: undefined, onClearMessage, onMessageSent,
  }))
  await act(async () => { await hook.result.current.handleSendMessage() })
  expect(options.messageRef.current).toBe('hello')
  expect(onClearMessage).not.toHaveBeenCalled()
  expect(hook.result.current.hasMessageBeenSent).toBe(false)
  expect(hook.result.current.isNewMakinaThinking).toBe(false)
  expect(onMessageSent).toHaveBeenLastCalledWith(false)
  hook.unmount()
})