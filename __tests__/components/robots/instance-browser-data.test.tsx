import { act, renderHook, waitFor } from '@testing-library/react'
import { useInstanceBrowserData } from '@/app/components/robots/use-instance-browser-data'
import { instanceMatchesTab } from '@/app/components/robots/instance-browser-model'

const mockFrom = jest.fn()
const mockNodes = jest.fn()
const mockRequirements = jest.fn()
const mockLogs = jest.fn()
const mockRpc = jest.fn()
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: mockFrom, rpc: mockRpc }) }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}
beforeEach(() => {
  jest.clearAllMocks()
  mockRpc.mockImplementation((_name, args) => ({ abortSignal: async () => ({ data: args.p_instance_ids.map((id: string) => ({
    instance_id: id, asset_count: 2, recent_assets: [], avatar_path: null,
  })), error: null }) }))
  mockNodes.mockResolvedValue({ data: [{ instance_id: 'a', type: 'agent' }, { instance_id: 'a', type: 'agent' }], error: null })
  mockRequirements.mockResolvedValue({ count: 0, error: null })
  mockLogs.mockResolvedValue({ data: [{ message: 'first' }], error: null })
  mockFrom.mockImplementation((table: string) => {
    const q = { select: () => q, eq: () => q, in: () => q, order: () => q, range: () => q, limit: () => q,
      abortSignal: () => table === 'instance_nodes' ? mockNodes() : table === 'requirement_status' ? mockRequirements() : mockLogs() }
    return q
  })
})
afterEach(() => jest.useRealTimers())

it('does not invent zero counts when asset summaries finish before node/requirement reads', async () => {
  const nodes = deferred<{ data: { instance_id: string; type: string }[]; error: null }>()
  const requirements = deferred<{ count: number; error: null }>()
  mockNodes.mockReturnValue(nodes.promise)
  mockRequirements.mockReturnValue(requirements.promise)
  const view = renderHook(() => useInstanceBrowserData(true, [{ id: 'a' }], 'site'))
  await waitFor(() => expect(view.result.current.instanceStats.a?.assets).toBe(2))
  expect(view.result.current.instanceStats.a.nodes).toBeUndefined()
  expect(view.result.current.instanceStats.a.requirements).toBeUndefined()
  expect(instanceMatchesTab(view.result.current.instanceStats.a, 'nodes')).toBe(true)
  await act(async () => nodes.resolve({ data: [], error: null }))
  expect(view.result.current.instanceStats.a.nodes).toBe(0)
  expect(view.result.current.instanceStats.a.requirements).toBeUndefined()
  await act(async () => requirements.resolve({ count: 0, error: null }))
  expect(view.result.current.instanceStats.a.requirements).toBe(0)
  expect(instanceMatchesTab(view.result.current.instanceStats.a, 'requirements')).toBe(false)
})
it('refreshes existing IDs after the freshness interval without an equivalent-array restart', async () => {
  const view = renderHook(({ instances }) => useInstanceBrowserData(true, instances, 'site'), { initialProps: { instances: [{ id: 'a' }] } })
  await waitFor(() => expect(view.result.current.isLoadingStats).toBe(false))
  const calls = mockNodes.mock.calls.length
  view.rerender({ instances: [{ id: 'a' }] })
  expect(mockNodes).toHaveBeenCalledTimes(calls)
  mockNodes.mockResolvedValue({ data: [], error: null })
  mockRequirements.mockResolvedValue({ count: 3, error: null })
  mockLogs.mockResolvedValue({ data: [{ message: 'updated' }], error: null })
  jest.useFakeTimers()
  act(() => jest.setSystemTime(Date.now() + 60_001))
  await act(async () => window.document.dispatchEvent(new Event('visibilitychange')))
  expect(mockNodes).toHaveBeenCalledTimes(calls + 1)
  expect(view.result.current.instanceStats.a.requirements).toBe(3)
  expect(view.result.current.instanceMessages.a.user?.message).toBe('updated')
})
it('reports failed nodes as unavailable and keeps their counts unknown', async () => {
  mockNodes.mockResolvedValue({ data: null, error: { message: 'offline' } })
  const view = renderHook(() => useInstanceBrowserData(true, [{ id: 'a' }], 'site'))
  await waitFor(() => expect(view.result.current.dataError).toBe('Instance details unavailable'))
  expect(view.result.current.instanceStats.a?.nodes).toBeUndefined()
  expect(instanceMatchesTab(view.result.current.instanceStats.a, 'workflows')).toBe(true)
})
it('retains confirmed requirement counts while refreshing nodes and requirements', async () => {
  mockRequirements.mockResolvedValue({ count: 3, error: null })
  const view = renderHook(() => useInstanceBrowserData(true, [{ id: 'a' }], 'site'))
  await waitFor(() => expect(view.result.current.instanceStats.a?.requirements).toBe(3))
  const pending = deferred<{ count: number; error: null }>()
  mockRequirements.mockReturnValue(pending.promise)
  jest.useFakeTimers()
  act(() => jest.setSystemTime(Date.now() + 60_001))
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(view.result.current.instanceStats.a.requirements).toBe(3)
  await act(async () => pending.resolve({ count: 4, error: null }))
  expect(view.result.current.instanceStats.a.requirements).toBe(4)
})
it('uses the scheduled timer to refresh within 65 seconds of completion', async () => {
  jest.useFakeTimers()
  const view = renderHook(() => useInstanceBrowserData(true, [{ id: 'a' }], 'site'))
  await act(async () => {})
  const calls = mockNodes.mock.calls.length
  await act(async () => jest.advanceTimersByTime(65_000))
  expect(mockNodes.mock.calls.length).toBeGreaterThan(calls)
  view.unmount()
})