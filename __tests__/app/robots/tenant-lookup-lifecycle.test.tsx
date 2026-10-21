import { act, renderHook, waitFor } from '@testing-library/react'
import { useTenantLookup } from '@/app/robots/use-tenant-lookup'
import { databaseFallbackUrl, lookupTenantUrl } from '@/app/robots/tenant-lookup'

const input = { siteId: 'site-a', instanceId: 'instance-a', requirementIds: ['req-a'] }
const empty = { tenant_id: null, schema: null, bucket: null }
const tenant = (id: string) => ({ tenant_id: id, schema: `schema-${id}`, bucket: null })
function response(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
function dispatch(type: string, persisted = false) {
  const event = new Event(type)
  Object.defineProperty(event, 'persisted', { value: persisted })
  act(() => { window.dispatchEvent(event) })
}

describe('Robots tenant lookup lifecycle', () => {
  let fetchMock: jest.Mock
  let consoleError: jest.SpyInstance
  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => { consoleError.mockRestore() })

  it('deduplicates sorted IDs and preserves last valid tenant precedence despite completion order', async () => {
    const a = deferred<Response>(), z = deferred<Response>()
    fetchMock.mockImplementation((url: string) => url.includes('req-a') ? a.promise : z.promise)
    const view = renderHook(useTenantLookup, {
      initialProps: { ...input, requirementIds: ['req-z', 'req-a', 'req-z', null] },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/applications/tenants?requirementId=req-a')
    await act(async () => { z.resolve(response(tenant('z'))) })
    await act(async () => { a.resolve(response(tenant('a'))) })
    expect(view.result.current.url).toContain('/database/z?schema=schema-z')
    view.rerender({ ...input, requirementIds: ['req-a', 'req-z', 'req-a', null] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('uses the generic database view for successful absence and no requirements', async () => {
    fetchMock.mockResolvedValue(response(empty))
    const view = renderHook(useTenantLookup, { initialProps: input })
    await waitFor(() => expect(view.result.current.isLoading).toBe(false))
    expect(view.result.current.url).toBe(databaseFallbackUrl(input.instanceId))
    view.rerender({ ...input, requirementIds: [] })
    await waitFor(() => expect(view.result.current.isLoading).toBe(false))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it.each([
    ['site', { ...input, siteId: 'site-b' }],
    ['instance', { ...input, instanceId: 'instance-b' }],
    ['requirements', { ...input, requirementIds: ['req-b'] }],
  ])('aborts on %s changes and rejects late results even when fetch ignores the signal', async (_, next) => {
    const old = deferred<Response>()
    fetchMock.mockReturnValueOnce(old.promise).mockResolvedValue(response(tenant('new')))
    const view = renderHook(useTenantLookup, { initialProps: input })
    const signal: AbortSignal = fetchMock.mock.calls[0][1].signal
    view.rerender(next)
    expect(signal.aborted).toBe(true)
    expect(view.result.current.url).not.toContain('/database/old')
    await waitFor(() => expect(view.result.current.url).toContain('/database/new'))
    await act(async () => { old.resolve(response(tenant('old'))) })
    expect(view.result.current.url).toContain('/database/new')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('clears the previous tenant immediately when site changes and disables cross-site instances', async () => {
    fetchMock.mockResolvedValueOnce(response(tenant('old'))).mockReturnValue(new Promise(() => {}))
    const view = renderHook(useTenantLookup, { initialProps: { ...input, instanceSiteId: 'site-a' } })
    await waitFor(() => expect(view.result.current.url).toContain('/database/old'))
    view.rerender({ ...input, siteId: 'site-b', instanceSiteId: 'site-a' })
    expect(view.result.current.url).toBe(databaseFallbackUrl(input.instanceId))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('isolates concurrent hook instances without sharing request ownership', async () => {
    const first = deferred<Response>(), second = deferred<Response>()
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const a = renderHook(useTenantLookup, { initialProps: input })
    const b = renderHook(useTenantLookup, { initialProps: { ...input, instanceId: 'instance-b' } })
    a.unmount()
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(false)
    await act(async () => { first.resolve(response(tenant('first'))); second.resolve(response(tenant('second'))) })
    expect(b.result.current.url).toContain('/database/second')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('suspends late work on pagehide, remains suspended through key changes, and resumes only persisted pageshow', async () => {
    const old = deferred<Response>()
    fetchMock.mockReturnValueOnce(old.promise).mockResolvedValue(response(tenant('restored')))
    const view = renderHook(useTenantLookup, { initialProps: input })
    const signal: AbortSignal = fetchMock.mock.calls[0][1].signal
    dispatch('pagehide')
    expect(signal.aborted).toBe(true)
    await act(async () => { old.resolve(response(tenant('old'))) })
    view.rerender({ ...input, instanceId: 'instance-b' })
    dispatch('pageshow')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    dispatch('pageshow', true)
    await waitFor(() => expect(view.result.current.url).toContain('/database/restored'))
    expect(view.result.current.url).toContain('robotInstanceId=instance-b')
    expect(fetchMock.mock.calls[1][1].signal).not.toBe(signal)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('aborts all parallel requests and suppresses only owned cancellation on unmount', async () => {
    const pending = deferred<Response>()
    fetchMock.mockReturnValue(pending.promise)
    const remove = jest.spyOn(window, 'removeEventListener')
    const view = renderHook(useTenantLookup, { initialProps: { ...input, requirementIds: ['a', 'b'] } })
    const signals = fetchMock.mock.calls.map(call => call[1].signal as AbortSignal)
    view.unmount()
    expect(signals.every(signal => signal.aborted)).toBe(true)
    await act(async () => { pending.reject(new TypeError('Failed to fetch')) })
    dispatch('pageshow', true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(consoleError).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith('pagehide', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('pageshow', expect.any(Function))
    remove.mockRestore()
  })

  it.each([
    new TypeError('Failed to fetch'),
    new DOMException('Unexpected abort', 'AbortError'),
    new Error('CORS request blocked'),
  ])('reports an unowned transport failure: %s', async error => {
    fetchMock.mockRejectedValue(error)
    const view = renderHook(useTenantLookup, { initialProps: input })
    await waitFor(() => expect(view.result.current.error).toBe(error))
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), error)
  })

  it.each([401, 403, 404, 500])('surfaces HTTP %s rather than treating failure as absence', async status => {
    fetchMock.mockResolvedValue(response({ error: 'failed' }, status))
    const view = renderHook(useTenantLookup, { initialProps: input })
    await waitFor(() => expect(view.result.current.error).toEqual(new Error(`Tenant lookup failed (HTTP ${status})`)))
    expect(consoleError).toHaveBeenCalledTimes(1)
  })

  it.each([
    {}, { error: 'failed' }, { tenant_id: 12, schema: 's' }, { tenant_id: 'x', schema: null },
    { ...empty, success: false }, { ...empty, error: 'failed' },
  ])(
    'rejects malformed success payloads: %j', async payload => {
      fetchMock.mockResolvedValue(response(payload))
      await expect(lookupTenantUrl({ ...input, requirementIds: ['req-a'] }, new AbortController().signal))
        .rejects.toThrow('Invalid tenant lookup response')
    },
  )

  it('does not start a fetch with an already aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(lookupTenantUrl(input, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancels sibling requests after a real failure while keeping that failure visible', async () => {
    const pending = deferred<Response>()
    fetchMock.mockResolvedValueOnce(response({ error: 'failed' }, 500)).mockReturnValueOnce(pending.promise)
    const view = renderHook(useTenantLookup, { initialProps: { ...input, requirementIds: ['a', 'b'] } })
    await waitFor(() => expect(view.result.current.error).toEqual(new Error('Tenant lookup failed (HTTP 500)')))
    expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(true)
    await act(async () => { pending.reject(new DOMException('Cancelled sibling', 'AbortError')) })
    expect(consoleError).toHaveBeenCalledTimes(1)
  })

  it('does not publish a late response body after pagehide', async () => {
    const body = deferred<unknown>()
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => body.promise })
    const view = renderHook(useTenantLookup, { initialProps: input })
    await act(async () => {})
    dispatch('pagehide')
    await act(async () => { body.resolve(tenant('late-body')) })
    expect(view.result.current.url).not.toContain('late-body')
    expect(consoleError).not.toHaveBeenCalled()
  })
})