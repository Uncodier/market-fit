import { sendAssistantMessage, sendRobotMessage } from '@/app/components/simple-messages-view/hooks/message-send-handlers'
import { contextService } from '@/app/services/context-service'
import { markRobotInstanceErrorIfUnanswered, persistUserActionLog, postWithRetry } from '@/app/components/simple-messages-view/hooks/send-message-reliability'

const getUser = jest.fn()
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { getUser } }) }))
jest.mock('@/app/services/context-service', () => ({ contextService: { getContextData: jest.fn() } }))
jest.mock('@/app/components/simple-messages-view/hooks/send-message-reliability', () => ({
  postWithRetry: jest.fn(), createRequestId: () => 'current-request',
  persistUserActionLog: jest.fn(), markRobotInstanceErrorIfUnanswered: jest.fn(),
}))

const params = {
  messageToSend: 'hello', siteId: 'site', selectedActivity: 'ask',
  selectedContext: {} as any,
  skillSelection: { skill_mode: 'auto', skill_slugs: [] } as any,
  activeRobotInstance: { id: 'instance' }, toast: jest.fn(),
}
const robotParams = {
  ...params, setThinkingStateWithTimeout: jest.fn(), setNewMakinaThinking: jest.fn(),
  clearThinkingState: jest.fn(), clearNewMakinaThinking: jest.fn(),
}

beforeEach(() => {
  jest.resetAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: 'user' } } })
  ;(contextService.getContextData as jest.Mock).mockResolvedValue({ records: [], recordContextOmittedIds: [] })
  ;(postWithRetry as jest.Mock).mockResolvedValue({ success: true })
})

it('sends without redundant browser identity/log persistence and trusts API persistence', async () => {
  getUser.mockImplementation(() => new Promise(() => {}))
  ;(persistUserActionLog as jest.Mock).mockImplementation(() => new Promise(() => {}))
  await expect(sendAssistantMessage(params)).resolves.toBe(true)
  expect(getUser).not.toHaveBeenCalled()
  expect(persistUserActionLog).not.toHaveBeenCalled()
  expect(postWithRetry).toHaveBeenCalledWith('/api/robots/instance/assistant', expect.objectContaining({
    request_id: 'current-request', client_persisted: false,
  }), { instanceId: 'instance', message: 'hello', requestId: 'current-request' })
})

it.each(['throw', 'stall'])('shows the original failure even when error telemetry %ss', async mode => {
  ;(postWithRetry as jest.Mock).mockResolvedValue({ success: false, status: 503, error: { message: 'Assistant capacity is full.' } })
  ;(markRobotInstanceErrorIfUnanswered as jest.Mock).mockImplementation(() => {
    expect(params.toast).toHaveBeenCalled()
    if (mode === 'throw') throw new Error('logging unavailable')
    return new Promise(() => {})
  })
  await expect(sendAssistantMessage(params)).resolves.toBe(false)
  expect(params.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Assistant capacity is full.', variant: 'destructive' }))
})

it('does not mark a possibly running workflow failed for interrupted SSE', async () => {
  ;(postWithRetry as jest.Mock).mockResolvedValue({ success: false, retryable: false, error: { message: 'Check the conversation before sending again.' } })
  await expect(sendAssistantMessage(params)).resolves.toBe(false)
  expect(params.toast).toHaveBeenCalled()
  expect(markRobotInstanceErrorIfUnanswered).not.toHaveBeenCalled()
})

it.each([
  [409, 'ASSISTANT_EXECUTION_BUSY', 'This assistant execution is already in progress', 'Assistant is busy'],
  [503, 'ASSISTANT_CAPACITY_FULL', 'Assistant capacity is temporarily full', 'Assistant is temporarily unavailable'],
  [503, 'ASSISTANT_ADMISSION_UNAVAILABLE', 'Admission is unavailable', 'Assistant is temporarily unavailable'],
  [409, undefined, 'This assistant execution is already in progress', 'Assistant is busy'],
  [503, undefined, 'Assistant capacity is temporarily full', 'Assistant is temporarily unavailable'],
])('never marks admission rejection %s/%s as retries exhausted', async (status, code, message, title) => {
  ;(postWithRetry as jest.Mock).mockResolvedValue({
    success: false, status, error: { code, message },
    ...(code ? { execution_started: false } : {}),
    retryable: true, // Admission classification must not depend on retry metadata.
  })
  await expect(sendAssistantMessage(params)).resolves.toBe(false)
  expect(params.toast).toHaveBeenCalledWith({ title, description: expect.stringContaining('This message was not sent.') })
  expect(markRobotInstanceErrorIfUnanswered).not.toHaveBeenCalled()
  expect(persistUserActionLog).not.toHaveBeenCalled()
})

it('reports context rejection without issuing a POST or trying to write an error log', async () => {
  ;(contextService.getContextData as jest.Mock).mockRejectedValue(new Error('Failed to fetch context data'))
  await expect(sendAssistantMessage(params)).resolves.toBe(false)
  expect(params.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Failed to fetch context data' }))
  expect(postWithRetry).not.toHaveBeenCalled()
  expect(markRobotInstanceErrorIfUnanswered).not.toHaveBeenCalled()
})

it('times out stalled context and never sends a late request', async () => {
  jest.useFakeTimers()
  try {
    let resolve!: (value: any) => void
    ;(contextService.getContextData as jest.Mock).mockImplementation(() => new Promise(r => { resolve = r }))
    const pending = sendAssistantMessage(params)
    await jest.advanceTimersByTimeAsync(15_000)
    await expect(pending).resolves.toBe(false)
    expect(params.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('context timed out') }))
    resolve({ records: [] })
    await Promise.resolve()
    expect(postWithRetry).not.toHaveBeenCalled()
  } finally { jest.useRealTimers() }
})

it.each([null, { id: 'saved-log' }])('sends an honest client_persisted flag for robot logs: %j', async persisted => {
  ;(persistUserActionLog as jest.Mock).mockResolvedValue(persisted)
  await sendRobotMessage(robotParams)
  expect(postWithRetry).toHaveBeenCalledWith('/api/workflow/promptRobot', expect.objectContaining({
    client_persisted: Boolean(persisted), request_id: 'current-request',
  }), expect.objectContaining({ requestId: 'current-request' }))
})

it('continues robot dispatch with server persistence when the client insert rejects', async () => {
  ;(persistUserActionLog as jest.Mock).mockRejectedValue(new Error('Database unavailable'))
  await sendRobotMessage(robotParams)
  expect(postWithRetry).toHaveBeenCalledWith('/api/workflow/promptRobot', expect.objectContaining({ client_persisted: false }), expect.anything())
})

it('clears robot thinking and toasts before failed telemetry can reject', async () => {
  ;(postWithRetry as jest.Mock).mockResolvedValue({ success: false, error: { message: 'Robot failed' } })
  ;(markRobotInstanceErrorIfUnanswered as jest.Mock).mockRejectedValue(new Error('Logging failed'))
  await sendRobotMessage(robotParams)
  expect(robotParams.clearThinkingState).toHaveBeenCalled()
  expect(params.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Robot failed' }))
})