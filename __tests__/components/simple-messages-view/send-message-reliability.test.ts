import {
  isRetryableApiFailure,
  persistUserActionLog,
  markRobotInstanceError,
  markRobotInstanceErrorIfUnanswered,
  postWithRetry,
  collapseDuplicateUserActions,
  hasAgentResponseForMessage,
} from '@/app/components/simple-messages-view/hooks/send-message-reliability'

const fromMock = jest.fn()
const getUserMock = jest.fn()

jest.mock('../../../lib/supabase/client', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => fromMock(...args),
    auth: { getUser: getUserMock },
  }),
}))

const postMock = jest.fn()
jest.mock('../../../app/services/api-client-service', () => ({
  apiClient: {
    post: (...args: unknown[]) => postMock(...args),
  },
}))

function createChain(result: { data?: any; error?: any } = {}) {
  const chain: any = {}
  chain.select = jest.fn().mockReturnValue(chain)
  chain.eq = jest.fn().mockReturnValue(chain)
  chain.gte = jest.fn().mockReturnValue(chain)
  chain.gt = jest.fn().mockReturnValue(chain)
  chain.in = jest.fn().mockReturnValue(chain)
  chain.order = jest.fn().mockReturnValue(chain)
  chain.limit = jest.fn().mockResolvedValue(result)
  chain.insert = jest.fn().mockReturnValue(chain)
  chain.update = jest.fn().mockReturnValue(chain)
  chain.single = jest.fn().mockResolvedValue(result)
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return chain
}

function mockAlreadyAnswered() {
  fromMock
    .mockReturnValueOnce(createChain({
      data: [{ id: 'user-1', created_at: '2026-08-31T17:10:00.000Z' }],
      error: null,
    }))
    .mockReturnValueOnce(createChain({
      data: [{ id: 'agent-1' }],
      error: null,
    }))
}

function mockUnanswered() {
  fromMock
    .mockReturnValueOnce(createChain({
      data: [{ id: 'user-1', created_at: '2026-08-31T17:10:00.000Z' }],
      error: null,
    }))
    .mockReturnValueOnce(createChain({ data: [], error: null }))
}

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  })
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  })
}

describe('isRetryableApiFailure', () => {
  it('retries network errors and 502/503/504', () => {
    expect(isRetryableApiFailure({ success: false })).toBe(true)
    expect(isRetryableApiFailure({ success: false, status: 502 })).toBe(true)
    expect(isRetryableApiFailure({ success: false, status: 503 })).toBe(true)
    expect(isRetryableApiFailure({ success: false, status: 500 })).toBe(true)
  })

  it('does not retry success or client errors', () => {
    expect(isRetryableApiFailure({ success: true, status: 200 })).toBe(false)
    expect(isRetryableApiFailure({ success: false, status: 400 })).toBe(false)
    expect(isRetryableApiFailure({ success: false, status: 401 })).toBe(false)
    expect(isRetryableApiFailure({ success: false, status: 404 })).toBe(false)
  })
})

describe('collapseDuplicateUserActions', () => {
  it('collapses consecutive user_action rows with the same message within 2 minutes', () => {
    const logs = [
      { id: '1', log_type: 'user_action', message: 'hello', created_at: '2026-08-31T17:10:00.000Z' },
      { id: '2', log_type: 'user_action', message: 'hello', created_at: '2026-08-31T17:10:20.000Z' },
      { id: '3', log_type: 'agent_action', message: 'hi', created_at: '2026-08-31T17:10:30.000Z' },
    ]
    const result = collapseDuplicateUserActions(logs)
    expect(result.map((log) => log.id)).toEqual(['1', '3'])
  })

  it('keeps the same text when the rows are far apart', () => {
    const logs = [
      { id: '1', log_type: 'user_action', message: 'hello', created_at: '2026-08-31T17:10:00.000Z' },
      { id: '2', log_type: 'user_action', message: 'hello', created_at: '2026-08-31T17:20:00.000Z' },
    ]
    const result = collapseDuplicateUserActions(logs)
    expect(result.map((log) => log.id)).toEqual(['1', '2'])
  })
})

describe('persistUserActionLog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the existing id when a duplicate exists, even if it is old', async () => {
    fromMock.mockReturnValue(createChain({ data: [{ id: 'existing-1' }], error: null }))

    const result = await persistUserActionLog({
      instanceId: 'inst-1',
      siteId: 'site-1',
      userId: 'user-1',
      message: 'hello',
    })

    expect(result).toEqual({ id: 'existing-1' })
    expect(fromMock.mock.results[0].value.gte).not.toHaveBeenCalled()
  })

  it('inserts the user message when none exists', async () => {
    const lookup = createChain({ data: [], error: null })
    const insert = createChain({ data: { id: 'new-1' }, error: null })
    fromMock.mockReturnValueOnce(lookup).mockReturnValueOnce(insert)

    const result = await persistUserActionLog({
      instanceId: 'inst-1',
      siteId: 'site-1',
      userId: 'user-1',
      message: 'hello',
      requestId: 'req-1',
    })

    expect(result).toEqual({ id: 'new-1' })
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        log_type: 'user_action',
        message: 'hello',
        instance_id: 'inst-1',
        details: expect.objectContaining({
          client_persisted: true,
          request_id: 'req-1',
        }),
      })
    )
  })

  it('returns null when insert fails', async () => {
    const lookup = createChain({ data: [], error: null })
    const insert = createChain({ data: null, error: { message: 'rls' } })
    fromMock.mockReturnValueOnce(lookup).mockReturnValueOnce(insert)

    const result = await persistUserActionLog({
      instanceId: 'inst-1',
      siteId: 'site-1',
      message: 'hello',
    })

    expect(result).toBeNull()
  })
})

describe('hasAgentResponseForMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('is true when an agent_action exists after the user message', async () => {
    mockAlreadyAnswered()
    await expect(hasAgentResponseForMessage({
      instanceId: 'inst-1',
      message: 'hello',
    })).resolves.toBe(true)
  })

  it('is false when the user message has no later response', async () => {
    mockUnanswered()
    await expect(hasAgentResponseForMessage({
      instanceId: 'inst-1',
      message: 'hello',
    })).resolves.toBe(false)
  })
})

describe('markRobotInstanceError', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('updates remote_instances to error', async () => {
    const update = createChain({ error: null })
    const insert = createChain({ error: null })
    fromMock.mockReturnValueOnce(update).mockReturnValueOnce(insert)

    const ok = await markRobotInstanceError({
      instanceId: 'inst-1',
      siteId: 'site-1',
      errorMessage: 'timeout',
    })

    expect(ok).toBe(true)
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' })
    )
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ log_type: 'error', instance_id: 'inst-1' })
    )
  })
})

describe('markRobotInstanceErrorIfUnanswered', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not write an error log when the agent already replied', async () => {
    mockAlreadyAnswered()

    const ok = await markRobotInstanceErrorIfUnanswered({
      instanceId: 'inst-1',
      siteId: 'site-1',
      errorMessage: 'Network error',
      message: 'hello',
    })

    expect(ok).toBe(false)
    expect(fromMock).toHaveBeenCalledTimes(2)
  })
})

describe('postWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    setDocumentHidden(false)
  })

  afterEach(() => {
    jest.useRealTimers()
    setDocumentHidden(false)
  })

  it('retries a 503 and then succeeds', async () => {
    postMock
      .mockResolvedValueOnce({ success: false, status: 503, error: { message: 'unavailable' } })
      .mockResolvedValueOnce({ success: true, data: { ok: true } })

    const pending = postWithRetry('/api/robots/instance/assistant', { message: 'hi' })
    await jest.runAllTimersAsync()
    const result = await pending

    expect(result.success).toBe(true)
    expect(postMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry a 400', async () => {
    postMock.mockResolvedValueOnce({ success: false, status: 400, error: { message: 'bad' } })

    const result = await postWithRetry('/api/robots/instance/assistant', { message: 'hi' })

    expect(result.success).toBe(false)
    expect(postMock).toHaveBeenCalledTimes(1)
  })

  it('marks retries exhausted after 3 failures', async () => {
    postMock.mockResolvedValue({ success: false, status: 502, error: { message: 'bad gateway' } })

    const pending = postWithRetry('/api/robots/instance/assistant', { message: 'hi' }, 3)
    await jest.runAllTimersAsync()
    const result = await pending

    expect(result.success).toBe(false)
    expect(postMock).toHaveBeenCalledTimes(3)
  })

  it('does not POST when the agent already answered that message', async () => {
    mockAlreadyAnswered()

    const result = await postWithRetry('/api/workflow/promptRobot', { message: 'hello' }, {
      instanceId: 'inst-1',
      message: 'hello',
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ alreadyAnswered: true })
    expect(postMock).not.toHaveBeenCalled()
  })

  it('does not POST while the tab is hidden, then skips if a reply appeared', async () => {
    setDocumentHidden(true)

    const pending = postWithRetry('/api/workflow/promptRobot', { message: 'hello' }, {
      instanceId: 'inst-1',
      message: 'hello',
    })

    await Promise.resolve()
    expect(postMock).not.toHaveBeenCalled()

    mockAlreadyAnswered()
    setDocumentHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))

    const result = await pending
    expect(result.success).toBe(true)
    expect(postMock).not.toHaveBeenCalled()
  })
})
