import { retryOnError } from '@/app/hooks/use-optimistic-error'

describe('retryOnError', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns on the first successful attempt', async () => {
    const fn = jest.fn().mockResolvedValue('ok')

    await expect(retryOnError(fn, 3, 10)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries failed attempts and then succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValue('ok')

    const resultPromise = retryOnError(fn, 3, 10)
    await jest.runAllTimersAsync()

    await expect(resultPromise).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws the last error after exhausting attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('still failing'))

    const resultPromise = retryOnError(fn, 3, 10)
    const assertion = expect(resultPromise).rejects.toThrow('still failing')
    await jest.runAllTimersAsync()
    await assertion
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
