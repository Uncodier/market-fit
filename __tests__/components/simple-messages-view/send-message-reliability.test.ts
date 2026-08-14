import {
  isRetryableApiFailure,
  persistUserActionLog,
  markRobotInstanceError,
  postWithRetry,
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
  chain.limit = jest.fn().mockResolvedValue(result)
  chain.insert = jest.fn().mockReturnValue(chain)
  chain.update = jest.fn().mockReturnValue(chain)
  chain.single = jest.fn().mockResolvedValue(result)
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return chain
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

describe('persistUserActionLog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the existing id when a recent duplicate exists', async () => {
    fromMock.mockReturnValue(createChain({ data: [{ id: 'existing-1' }], error: null }))

    const result = await persistUserActionLog({
      instanceId: 'inst-1',
      siteId: 'site-1',
      userId: 'user-1',
      message: 'hello',
    })

    expect(result).toEqual({ id: 'existing-1' })
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
    })

    expect(result).toEqual({ id: 'new-1' })
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        log_type: 'user_action',
        message: 'hello',
        instance_id: 'inst-1',
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

describe('postWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
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
})
