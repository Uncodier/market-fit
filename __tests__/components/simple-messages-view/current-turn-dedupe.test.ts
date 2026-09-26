import {
  collapseDuplicateUserActions, hasAgentResponseForMessage, persistUserActionLog, postWithRetry,
} from '@/app/components/simple-messages-view/hooks/send-message-reliability'

const from = jest.fn()
const post = jest.fn()
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from }) }))
jest.mock('@/app/services/api-client-service', () => ({ apiClient: { post: (...args: unknown[]) => post(...args) } }))

function query(result: unknown) {
  const chain: any = { then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject) }
  for (const method of ['select', 'eq', 'gt', 'lt', 'or', 'order', 'insert', 'update']) {
    chain[method] = jest.fn().mockReturnValue(chain)
  }
  chain.limit = jest.fn().mockResolvedValue(result)
  chain.single = jest.fn().mockResolvedValue(result)
  return chain
}

beforeEach(() => { jest.resetAllMocks() })

it('inserts a new turn for identical text with a new request ID', async () => {
  const lookup = query({ data: [] })
  const insert = query({ data: { id: 'new-turn' } })
  from.mockReturnValueOnce(lookup).mockReturnValueOnce(insert)
  await expect(persistUserActionLog({ instanceId: 'i', siteId: 's', message: 'repeat', requestId: 'new-request' }))
    .resolves.toEqual({ id: 'new-turn' })
  expect(lookup.eq).toHaveBeenCalledWith('details->>request_id', 'new-request')
  expect(lookup.eq).not.toHaveBeenCalledWith('message', 'repeat')
  expect(insert.insert).toHaveBeenCalled()
})

it('never dedupes by text when no request ID is available', async () => {
  from.mockReturnValue(query({ data: { id: 'new-turn' } }))
  await persistUserActionLog({ instanceId: 'i', siteId: 's', message: 'repeat' })
  expect(from).toHaveBeenCalledTimes(1)
  from.mockClear()
  await expect(hasAgentResponseForMessage({ instanceId: 'i', message: 'repeat' })).resolves.toBe(false)
  expect(from).not.toHaveBeenCalled()
})

it('never attributes a later user turn response to this request', async () => {
  const user = query({ data: [{ id: 'user', created_at: '2026-09-01T00:00:00Z' }] })
  const later = query({ data: [{ created_at: '2026-09-01T00:05:00Z' }] })
  const answer = query({ data: [] })
  from.mockReturnValueOnce(user).mockReturnValueOnce(later).mockReturnValueOnce(answer)
  await expect(hasAgentResponseForMessage({ instanceId: 'i', message: 'repeat', requestId: 'r' })).resolves.toBe(false)
  expect(answer.gt).toHaveBeenCalledWith('created_at', '2026-09-01T00:00:00Z')
  expect(answer.lt).toHaveBeenCalledWith('created_at', '2026-09-01T00:05:00Z')
})

it('keeps two deliberately repeated user turns visible', () => {
  const base = { log_type: 'user_action', message: 'again', created_at: '2026-09-01T00:00:00Z' }
  const logs = [{ ...base, details: { request_id: 'one' } }, { ...base, details: { request_id: 'two' } }]
  expect(collapseDuplicateUserActions(logs)).toEqual(logs)
  expect(collapseDuplicateUserActions([base, logs[1]])).toEqual([base, logs[1]])
})

it('does not query historical logs before the first POST', async () => {
  from.mockImplementation(() => { throw new Error('DB unavailable') })
  post.mockResolvedValue({ success: true })
  await expect(postWithRetry('/api/workflow/promptRobot', {}, { instanceId: 'i', message: 'repeat', requestId: 'r' }))
    .resolves.toEqual({ success: true })
  expect(from).not.toHaveBeenCalled()
})

it('does not replay or mask explicit stream failure, even when logs contain activity', async () => {
  const failure = { success: false, status: 200, retryable: false, error: { message: 'Workflow failed' } }
  post.mockResolvedValue(failure)
  await expect(postWithRetry('/api/robots/instance/assistant', {}, { instanceId: 'i', message: 'repeat', requestId: 'r' }))
    .resolves.toEqual(failure)
  expect(post).toHaveBeenCalledTimes(1)
  expect(from).not.toHaveBeenCalled()
})

it('a throwing response lookup cannot prevent a retry', async () => {
  jest.useFakeTimers()
  try {
    from.mockImplementation(() => { throw new Error('DB unavailable') })
    post.mockResolvedValueOnce({ success: false, status: 503 }).mockResolvedValueOnce({ success: true })
    const pending = postWithRetry('/api/workflow/promptRobot', {}, { instanceId: 'i', message: 'repeat', requestId: 'r' })
    await jest.runAllTimersAsync()
    await expect(pending).resolves.toEqual({ success: true })
    expect(post).toHaveBeenCalledTimes(2)
  } finally { jest.useRealTimers() }
})