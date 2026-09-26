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