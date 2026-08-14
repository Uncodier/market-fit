import { fetchWithRetry } from '@/app/utils/fetch-with-retry'

describe('fetchWithRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('returns the response when the request succeeds', async () => {
    const response = { ok: true, status: 200 } as Response
    const fetchFn = jest.fn().mockResolvedValue(response)

    await expect(fetchWithRetry(fetchFn, '/api/ok')).resolves.toBe(response)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('does not retry 400 client errors', async () => {
    const response = { ok: false, status: 400 } as Response
    const fetchFn = jest.fn().mockResolvedValue(response)
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await expect(fetchWithRetry(fetchFn, '/api/session-time', { maxRetries: 3 })).resolves.toBeNull()
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      '[fetchWithRetry] Client error 400 for /api/session-time'
    )
  })

  it('retries 500 errors until success', async () => {
    const failed = { ok: false, status: 500 } as Response
    const succeeded = { ok: true, status: 200 } as Response
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce(succeeded)

    const resultPromise = fetchWithRetry(fetchFn, '/api/flaky', { maxRetries: 3, initialDelay: 10 })
    await jest.runAllTimersAsync()

    await expect(resultPromise).resolves.toBe(succeeded)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})
