import { act, renderHook, waitFor } from '@testing-library/react'
import { useInstanceAssetSummaries } from '@/app/components/robots/use-instance-asset-summaries'

const mockRpc = jest.fn()
const mockAuth = jest.fn()
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc: mockRpc, auth: { onAuthStateChange: mockAuth } }) }))
const row = (id: string) => ({ instance_id: id, asset_count: 0, recent_assets: [], avatar_path: null })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}
beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })
  mockRpc.mockImplementation((_name, args) => ({ abortSignal: async () => ({ data: args.p_instance_ids.map(row), error: null }) }))
})
afterEach(() => jest.useRealTimers())

it('loads 394 avatars in four sequential batches and caches empty images', async () => {
  const ids = Array.from({ length: 394 }, (_, i) => `id-${i}`)
  const view = renderHook(({ list }) => useInstanceAssetSummaries('site-a', list, true), { initialProps: { list: ids } })
  await waitFor(() => expect(Object.keys(view.result.current.summaries)).toHaveLength(394))
  expect(mockRpc).toHaveBeenCalledTimes(4)
  expect(mockRpc.mock.calls.every(([, args]) => args.p_instance_ids.length <= 100)).toBe(true)
  view.rerender({ list: [...ids].reverse() })
  expect(mockRpc).toHaveBeenCalledTimes(4)
  expect(view.result.current.summaries['id-0'].avatar_path).toBeNull()
})
it('does not abort/restart in-flight work on new arrays with identical IDs', async () => {
  const pending = deferred<{ data: ReturnType<typeof row>[]; error: null }>()
  let signal!: AbortSignal
  mockRpc.mockReturnValue({ abortSignal: (s: AbortSignal) => { signal = s; return pending.promise } })
  const view = renderHook(({ ids }) => useInstanceAssetSummaries('site-a', ids, true), { initialProps: { ids: ['a'] } })
  view.rerender({ ids: ['a'] })
  expect(mockRpc).toHaveBeenCalledTimes(1)
  expect(signal.aborted).toBe(false)
  await act(async () => pending.resolve({ data: [row('a')], error: null }))
  expect(view.result.current.summaries.a).toEqual(row('a'))
})
it('preserves completed batches when IDs change and rejects stale tenant results', async () => {
  const pending = deferred<{ data: ReturnType<typeof row>[]; error: null }>()
  const signals: AbortSignal[] = []
  mockRpc.mockImplementation((_name, args) => ({ abortSignal: (signal: AbortSignal) => {
    signals.push(signal)
    return args.p_instance_ids.includes('z') ? pending.promise : Promise.resolve({ data: args.p_instance_ids.map(row), error: null })
  } }))
  const first = Array.from({ length: 100 }, (_, i) => `a-${i}`)
  const view = renderHook(({ site, ids }) => useInstanceAssetSummaries(site, ids, true), { initialProps: { site: 'a', ids: [...first, 'z'] } })
  await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2))
  expect(Object.keys(view.result.current.summaries)).toHaveLength(100)
  view.rerender({ site: 'a', ids: [...first, 'new'] })
  await waitFor(() => expect(view.result.current.summaries.new).toBeDefined())
  expect(mockRpc.mock.calls[2][1].p_instance_ids).toEqual(['new'])
  expect(signals[1].aborted).toBe(true)
  view.rerender({ site: 'b', ids: ['b'] })
  await waitFor(() => expect(view.result.current.summaries.b).toBeDefined())
  await act(async () => pending.resolve({ data: [row('z')], error: null }))
  expect(Object.keys(view.result.current.summaries)).toEqual(['b'])
})
it('aborts unmounted requests and does not cache errors as successful absence', async () => {
  mockRpc.mockReturnValue({ abortSignal: async () => ({ data: null, error: { message: 'denied' } }) })
  const view = renderHook(() => useInstanceAssetSummaries('a', ['id'], true))
  await waitFor(() => expect(view.result.current.error).toBe('Asset summaries unavailable'))
  expect(view.result.current.summaries).toEqual({})
  let signal!: AbortSignal
  mockRpc.mockReturnValue({ abortSignal: (s: AbortSignal) => { signal = s; return new Promise(() => {}) } })
  const next = renderHook(() => useInstanceAssetSummaries('a', ['id'], true))
  next.unmount()
  expect(signal.aborted).toBe(true)
})
it('clears the cache on auth replacement and requires a fresh authorized read', async () => {
  const view = renderHook(() => useInstanceAssetSummaries('site', ['id'], true))
  await waitFor(() => expect(view.result.current.summaries.id).toBeDefined())
  mockRpc.mockReturnValue({ abortSignal: async () => ({ data: [], error: null }) })
  act(() => mockAuth.mock.calls[0][0]('SIGNED_OUT'))
  await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2))
  expect(view.result.current.summaries).toEqual({})
})
it('refreshes after a failure only when explicitly retried, without an immediate loop', async () => {
  mockRpc.mockReturnValue({ abortSignal: async () => ({ data: null, error: { message: 'offline' } }) })
  const view = renderHook(() => useInstanceAssetSummaries('site', ['id'], true))
  await waitFor(() => expect(view.result.current.error).toBeTruthy())
  expect(mockRpc).toHaveBeenCalledTimes(1)
  mockRpc.mockImplementation((_name, args) => ({ abortSignal: async () => ({ data: args.p_instance_ids.map(row), error: null }) }))
  act(() => view.result.current.retry())
  await waitFor(() => expect(view.result.current.summaries.id).toBeDefined())
  expect(view.result.current.error).toBeNull()
})
it('preserves fresh results for same-user SIGNED_IN confirmations', async () => {
  const view = renderHook(() => useInstanceAssetSummaries('site', ['id'], true))
  const session = { user: { id: 'user-a' } }
  act(() => mockAuth.mock.calls[0][0]('INITIAL_SESSION', session))
  await waitFor(() => expect(view.result.current.summaries.id).toBeDefined())
  act(() => {
    mockAuth.mock.calls[0][0]('SIGNED_IN', session)
    mockAuth.mock.calls[0][0]('SIGNED_IN', session)
    mockAuth.mock.calls[0][0]('TOKEN_REFRESHED', session)
  })
  expect(mockRpc).toHaveBeenCalledTimes(1)
  expect(view.result.current.summaries.id).toBeDefined()
})
it('aborts prior work when SIGNED_IN replaces the user on the same site', async () => {
  let signal!: AbortSignal
  const pending = deferred<{ data: ReturnType<typeof row>[]; error: null }>()
  mockRpc.mockReturnValueOnce({ abortSignal: (s: AbortSignal) => { signal = s; return pending.promise } })
  const view = renderHook(() => useInstanceAssetSummaries('site', ['id'], true))
  act(() => mockAuth.mock.calls[0][0]('INITIAL_SESSION', { user: { id: 'a' } }))
  act(() => mockAuth.mock.calls[0][0]('SIGNED_IN', { user: { id: 'b' } }))
  expect(signal.aborted).toBe(true)
  await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2))
  await act(async () => pending.resolve({ data: [row('stale')], error: null }))
  expect(view.result.current.summaries.stale).toBeUndefined()
})
it('refreshes expired rows on its timer without polling fresh data every five seconds', async () => {
  jest.useFakeTimers()
  const view = renderHook(() => useInstanceAssetSummaries('site', ['id'], true))
  await act(async () => {})
  await act(async () => jest.advanceTimersByTime(5_000))
  expect(mockRpc).toHaveBeenCalledTimes(1)
  await act(async () => jest.advanceTimersByTime(60_000))
  expect(mockRpc).toHaveBeenCalledTimes(2)
  view.unmount()
})