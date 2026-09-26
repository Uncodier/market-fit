import { act, renderHook } from '@testing-library/react'
import { useMessageSending } from '@/app/components/simple-messages-view/hooks/useMessageSending'
import { getAssistantAdmissionFailure } from '@/app/components/simple-messages-view/hooks/assistant-admission-error'
import { enqueuePendingWork } from '@/app/components/simple-messages-view/hooks/pending-work'

const toast = jest.fn()
const from = jest.fn()
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site' } }) }))
jest.mock('@/app/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }))
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from, auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) } }),
}))
jest.mock('@/app/services/context-service', () => ({ contextService: { getContextData: async () => ({ records: [] }) } }))
jest.mock('@/app/components/simple-messages-view/hooks/pending-work', () => ({
  buildPendingWorkPayload: jest.fn(), enqueuePendingWork: jest.fn(),
}))

beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers() })
afterEach(() => { jest.useRealTimers() })

it.each([
  { status: 409, code: 'ASSISTANT_EXECUTION_BUSY', message: 'This assistant execution is already in progress', title: 'Assistant is busy' },
  { status: 503, code: 'ASSISTANT_CAPACITY_FULL', message: 'Assistant capacity is temporarily full', title: 'Assistant is temporarily unavailable' },
  { status: 503, code: 'ASSISTANT_ADMISSION_UNAVAILABLE', message: 'Admission is unavailable', title: 'Assistant is temporarily unavailable' },
  { status: 409, message: 'This assistant execution is already in progress', title: 'Assistant is busy' },
  { status: 503, message: 'Assistant capacity is temporarily full', title: 'Assistant is temporarily unavailable' },
])('keeps the unsent draft without replay, error writes or false running rows: $code/$status', async ({ status, code, message, title }) => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: false, status, headers: { get: () => 'application/json' },
    text: async () => JSON.stringify({
      success: false, error: { code, message }, ...(code ? { execution_started: false } : {}),
    }),
  })
  const messageRef = { current: '  hello  ' }
  const onClearMessage = jest.fn(() => { messageRef.current = '' })
  const onAddOptimisticMessage = jest.fn()
  const hook = renderHook(() => useMessageSending({
    activeRobotInstance: { id: 'instance' }, selectedActivity: 'ask', selectedContext: {} as any,
    skillSelection: { skill_mode: 'auto', skill_slugs: [] }, messageRef,
    logsRef: { current: [] }, onClearMessage, onAddOptimisticMessage,
  }))
  await act(async () => { await hook.result.current.handleSendMessage() })
  await act(async () => { await jest.runAllTimersAsync() })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(from).not.toHaveBeenCalled() // No remote_instances mutation or frontend_retry_exhausted log.
  expect(enqueuePendingWork).not.toHaveBeenCalled()
  expect(onClearMessage).not.toHaveBeenCalled()
  expect(onAddOptimisticMessage).not.toHaveBeenCalled()
  expect(messageRef.current).toBe('  hello  ')
  expect(toast).toHaveBeenCalledTimes(1)
  expect(toast).toHaveBeenCalledWith({ title, description: expect.stringContaining('This message was not sent.') })
  expect(hook.result.current.isSendingMessage).toBe(false)
  expect(hook.result.current.isWaitingForResponse).toBe(false)
  expect(hook.result.current.waitingForMessageId).toBeNull()
  hook.unmount()
})

it('retains the draft without replay but does not claim an ambiguous timeout was never started', async () => {
  const message = 'The workflow may still be running. Check the conversation before sending again.'
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: false, status: 504, headers: { get: () => 'application/json' },
    text: async () => JSON.stringify({ success: false, error: { code: 'ASSISTANT_PROXY_TIMEOUT', message } }),
  })
  const messageRef = { current: 'hello' }
  const onClearMessage = jest.fn()
  const hook = renderHook(() => useMessageSending({
    activeRobotInstance: { id: 'instance' }, selectedActivity: 'ask', selectedContext: {} as any,
    skillSelection: { skill_mode: 'auto', skill_slugs: [] }, messageRef, onClearMessage,
  }))
  await act(async () => { await hook.result.current.handleSendMessage() })
  await act(async () => { await jest.runAllTimersAsync() })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(from).not.toHaveBeenCalled()
  expect(enqueuePendingWork).not.toHaveBeenCalled()
  expect(messageRef.current).toBe('hello')
  expect(onClearMessage).not.toHaveBeenCalled()
  expect(toast).toHaveBeenCalledWith({ title: 'Error', description: message, variant: 'destructive' })
  hook.unmount()
})

it.each([
  { success: true, status: 409, error: { code: 'ASSISTANT_EXECUTION_BUSY', message: 'Busy' } },
  { success: false, status: 409, execution_started: true, error: { code: 'ASSISTANT_EXECUTION_BUSY', message: 'Busy' } },
  { success: false, status: 409, error: { message: 'A different conflict' } },
  { success: false, status: 503, error: { message: 'Gateway unavailable' } },
  { success: false, status: 504, error: { message: 'This assistant execution is already in progress' } },
  { success: false, status: 409, error: { code: 'ASSISTANT_PROXY_ERROR', message: 'This assistant execution is already in progress' } },
])('does not mislabel a different or already-started failure as unsent admission: %j', response => {
  expect(getAssistantAdmissionFailure(response)).toBeNull()
})