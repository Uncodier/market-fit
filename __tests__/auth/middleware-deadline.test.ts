/** @jest-environment node */
import { createMiddlewareDeadline, MiddlewareDeadline } from '@/lib/supabase/middleware-deadline'
import { createMiddlewareFetch } from '@/lib/supabase/middleware-fetch'

describe('middleware operation scopes', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('shares the original request budget without retaining timers between phases', async () => {
    const request = {}
    const auth = createMiddlewareDeadline(request)
    await jest.advanceTimersByTimeAsync(6_000)
    auth.dispose()
    expect(jest.getTimerCount()).toBe(0)
    const screen = createMiddlewareDeadline(request)
    const pending = expect(screen.wait(() => new Promise(() => {}))).rejects.toMatchObject({
      name: 'TimeoutError',
    })
    await jest.advanceTimersByTimeAsync(2_000)
    await pending
    expect(screen.active).toBe(false)
    expect(jest.getTimerCount()).toBe(0)
    const late = createMiddlewareDeadline(request)
    expect(late.active).toBe(false)
    const independent = createMiddlewareDeadline({})
    expect(independent.active).toBe(true)
    independent.dispose()
  })

  it('bounds ignored abort work and blocks all transport calls after disposal', async () => {
    const scope = new MiddlewareDeadline(Date.now() + 8_000)
    let rejectLate!: (error: Error) => void
    const transport = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(() =>
      new Promise<Response>((_resolve, reject) => { rejectLate = reject })
    )
    const boundedFetch = createMiddlewareFetch(scope, transport)
    const remove = jest.spyOn(scope.signal, 'removeEventListener')
    const pending = expect(boundedFetch('https://supabase.test')).rejects.toMatchObject({
      name: 'TimeoutError',
    })
    await jest.advanceTimersByTimeAsync(8_000)
    await pending
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(transport.mock.calls[0][1]?.signal?.aborted).toBe(true)
    scope.dispose()
    await expect(boundedFetch('https://supabase.test')).rejects.toMatchObject({ name: 'TimeoutError' })
    rejectLate(new Error('late transport failure'))
    await jest.advanceTimersByTimeAsync(40_000)
    expect(transport).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('aborts response body work even after headers arrive', async () => {
    const scope = new MiddlewareDeadline(Date.now() + 8_000)
    let signal: AbortSignal | undefined | null
    const boundedFetch = createMiddlewareFetch(scope, async (_input, init) => {
      signal = init?.signal
      return { json: () => new Promise(() => {}) } as Response
    })
    const pending = expect(scope.wait(async () => {
      const response = await boundedFetch('https://supabase.test')
      return response.json()
    })).rejects.toMatchObject({ name: 'TimeoutError' })
    await jest.advanceTimersByTimeAsync(8_000)
    await pending
    expect(signal?.aborted).toBe(true)
    scope.dispose()
  })

  it('honors request cancellation and does not start already cancelled requests', async () => {
    const controller = new AbortController()
    const remove = jest.spyOn(controller.signal, 'removeEventListener')
    const scope = createMiddlewareDeadline({ signal: controller.signal })
    const pending = expect(scope.wait(() => new Promise(() => {}))).rejects.toMatchObject({
      name: 'AbortError',
    })
    controller.abort()
    await pending
    expect(remove).toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
    const cancelled = createMiddlewareDeadline({ signal: controller.signal })
    expect(cancelled.active).toBe(false)
  })

  it('cleans timers and request/caller listeners on successful operation disposal', async () => {
    const request = new AbortController()
    const caller = new AbortController()
    const removeRequest = jest.spyOn(request.signal, 'removeEventListener')
    const removeCaller = jest.spyOn(caller.signal, 'removeEventListener')
    const scope = createMiddlewareDeadline({ signal: request.signal })
    const boundedFetch = createMiddlewareFetch(scope, async () => new Response('{}'))
    await scope.wait(() => boundedFetch('https://supabase.test', { signal: caller.signal }))
    scope.dispose()
    expect(removeRequest).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(removeCaller).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(jest.getTimerCount()).toBe(0)
  })

  it('preserves Request input cancellation without AbortSignal.any', async () => {
    const caller = new AbortController()
    const scope = new MiddlewareDeadline(Date.now() + 8_000)
    const remove = jest.spyOn(caller.signal, 'removeEventListener')
    const transport = jest.fn(async () => new Response('{}'))
    const boundedFetch = createMiddlewareFetch(scope, transport)
    const input = new Request('https://supabase.test', { signal: caller.signal })
    caller.abort()
    await expect(boundedFetch(input)).rejects.toMatchObject({ name: 'AbortError' })
    expect(transport).not.toHaveBeenCalled()
    await expect(boundedFetch('https://supabase.test', { signal: caller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' })
    expect(remove).toHaveBeenCalled()
    scope.dispose()
    expect(jest.getTimerCount()).toBe(0)
  })
})