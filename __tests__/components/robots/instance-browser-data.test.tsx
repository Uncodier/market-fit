import { act, renderHook, waitFor } from '@testing-library/react'
import { useInstanceBrowserData, type InstanceBrowserReadProfile } from '@/app/components/robots/use-instance-browser-data'
import { instanceMatchesTab } from '@/app/components/robots/instance-browser-model'

const mockFrom = jest.fn()
const mockNodes = jest.fn()
const mockRequirements = jest.fn()
const mockLogs = jest.fn()
const mockRpc = jest.fn()
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: mockFrom, rpc: mockRpc }) }))

interface TestQuery {
  select: jest.Mock<TestQuery>
  eq: jest.Mock<TestQuery>
  in: jest.Mock<TestQuery>
  order: jest.Mock<TestQuery>
  range: jest.Mock<TestQuery>
  limit: jest.Mock<TestQuery>
  abortSignal: (signal: AbortSignal) => Promise<unknown>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}
beforeEach(() => {
  jest.resetAllMocks()
  mockRpc.mockImplementation((_name, args) => ({ abortSignal: async () => ({ data: args.p_instance_ids.map((id: string) => ({
    instance_id: id, asset_count: 2, recent_assets: [], avatar_path: null,
  })), error: null }) }))
  mockNodes.mockResolvedValue({ data: [{ instance_id: 'a', type: 'agent' }, { instance_id: 'a', type: 'agent' }], error: null })
  mockRequirements.mockResolvedValue({ count: 0, error: null })
  mockLogs.mockResolvedValue({ data: [{ message: 'first' }], error: null })
  mockFrom.mockImplementation((table: string) => {
    const q: TestQuery = {
      select: jest.fn(() => q), eq: jest.fn(() => q), in: jest.fn(() => q),
      order: jest.fn(() => q), range: jest.fn(() => q), limit: jest.fn(() => q),
      abortSignal: (signal: AbortSignal) => table === 'instance_nodes' ? mockNodes(signal)
        : table === 'requirement_status' ? mockRequirements(signal) : mockLogs(signal),
    }
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

it('loads only scoped node/workflow counters in canvas, including legacy workflow types', async () => {
  mockNodes.mockResolvedValue({ data: [
    { instance_id: 'a', type: 'agent' }, { instance_id: 'a', type: null },
    { instance_id: 'a', type: 'wf-trigger' }, { instance_id: 'a', type: 'wf-step' },
    { instance_id: 'a', type: 'wf-condition' },
  ], error: null })
  const view = renderHook(() => useInstanceBrowserData(true, [{ id: 'b' }, { id: 'a' }, { id: 'a' }], 'site', 'canvas'))
  expect(view.result.current.instanceStats.a?.nodes).toBeUndefined()
  expect(view.result.current.isLoadingMessages).toBe(false)
  await waitFor(() => expect(view.result.current.isLoadingStats).toBe(false))
  expect(view.result.current.instanceStats).toEqual({
    a: { nodes: 2, workflows: 3, recentAssets: [], avatarUrl: null },
    b: { nodes: 0, workflows: 0, recentAssets: [], avatarUrl: null },
  })
  expect(view.result.current.instanceStats.a.assets).toBeUndefined()
  expect(view.result.current.instanceStats.a.requirements).toBeUndefined()
  expect(view.result.current.instanceMessages).toEqual({})
  expect(mockFrom.mock.calls).toEqual([['instance_nodes']])
  const query = mockFrom.mock.results[0].value
  expect(query.select).toHaveBeenCalledWith('instance_id, type')
  expect(query.in).toHaveBeenCalledWith('instance_id', ['a', 'b'])
  expect(query.order).toHaveBeenCalledWith('id', { ascending: true })
  expect(query.range).toHaveBeenCalledWith(0, 999)
  expect(mockRequirements).not.toHaveBeenCalled()
  expect(mockLogs).not.toHaveBeenCalled()
  expect(mockRpc).not.toHaveBeenCalled()
})

it('preserves the modal default: nodes, requirements, messages and asset summaries', async () => {
  mockRequirements.mockResolvedValue({ count: 3, error: null })
  const view = renderHook(() => useInstanceBrowserData(true, [{ id: 'a' }], 'site'))
  await waitFor(() => expect(view.result.current.isLoadingStats).toBe(false))
  expect(view.result.current.instanceStats.a).toEqual({
    nodes: 2, workflows: 0, requirements: 3, assets: 2, recentAssets: [], avatarUrl: null,
  })
  expect(view.result.current.instanceMessages.a).toEqual({ user: { message: 'first' }, agent: { message: 'first' } })
  expect(mockFrom.mock.calls.map(([table]) => table).sort()).toEqual([
    'instance_logs', 'instance_logs', 'instance_nodes', 'requirement_status',
  ])
  const requirementIndex = mockFrom.mock.calls.findIndex(([table]) => table === 'requirement_status')
  const query = mockFrom.mock.results[requirementIndex].value
  expect(query.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
  expect(query.eq.mock.calls).toEqual([['instance_id', 'a'], ['site_id', 'site']])
  expect(mockRpc).toHaveBeenCalledWith('get_instance_asset_summaries', { p_site_id: 'site', p_instance_ids: ['a'] })
})

it('does not turn a missing requirement count into a confirmed zero', async () => {
  mockRequirements.mockResolvedValue({ count: null, error: null })
  const view = renderHook(() => useInstanceBrowserData(true, [{ id: 'a' }], 'site'))
  await waitFor(() => expect(view.result.current.isLoadingStats).toBe(false))
  expect(view.result.current.instanceStats.a.requirements).toBeUndefined()
  expect(instanceMatchesTab(view.result.current.instanceStats.a, 'requirements')).toBe(true)
})

it('keeps equivalent canvas inputs stable and refreshes/retries only nodes', async () => {
  jest.useFakeTimers()
  const view = renderHook(({ instances }) => useInstanceBrowserData(true, instances, 'site', 'canvas'), {
    initialProps: { instances: [{ id: 'b', name: 'Old' }, { id: 'a', name: 'Agent' }] },
  })
  await act(async () => {})
  view.rerender({ instances: [{ id: 'a', name: 'Renamed' }, { id: 'b', name: 'New' }] })
  expect(mockNodes).toHaveBeenCalledTimes(1)
  await act(async () => jest.advanceTimersByTime(65_000))
  expect(mockNodes).toHaveBeenCalledTimes(2)
  await act(async () => { view.result.current.retryData(); view.result.current.retryAssets() })
  expect(mockNodes).toHaveBeenCalledTimes(3)
  expect(mockFrom.mock.calls.every(([table]) => table === 'instance_nodes')).toBe(true)
  expect(mockRpc).not.toHaveBeenCalled()
  view.unmount()
})

it.each(['full', 'canvas'] as const)('does no reads when closed or without a site (%s)', async profile => {
  const view = renderHook(({ open, site }) => useInstanceBrowserData(open, [{ id: 'a' }], site, profile), {
    initialProps: { open: false, site: 'site' as string | undefined },
  })
  await act(async () => {})
  view.rerender({ open: true, site: undefined })
  await act(async () => {})
  expect(mockFrom).not.toHaveBeenCalled()
  expect(mockRpc).not.toHaveBeenCalled()
  expect(view.result.current.isLoadingStats).toBe(false)
  expect(view.result.current.isLoadingMessages).toBe(false)
})

it('cancels pending full reads on canvas transition and reloads all details when returning', async () => {
  const requirements = deferred<{ count: number; error: null }>()
  const logs = deferred<{ data: { message: string }[]; error: null }>()
  const assets = deferred<{ data: unknown[]; error: null }>()
  const assetRead = jest.fn<Promise<{ data: unknown[]; error: null }>, [AbortSignal]>().mockReturnValue(assets.promise)
  mockRpc.mockReturnValueOnce({ abortSignal: assetRead })
  mockRequirements.mockReturnValueOnce(requirements.promise)
  mockLogs.mockReturnValueOnce(logs.promise).mockReturnValueOnce(logs.promise)
  const view = renderHook(({ profile }) => useInstanceBrowserData(true, [{ id: 'a' }], 'site', profile), {
    initialProps: { profile: 'full' as InstanceBrowserReadProfile },
  })
  await waitFor(() => expect(mockRequirements).toHaveBeenCalledTimes(1))
  const detailSignals: AbortSignal[] = [mockRequirements.mock.calls[0][0], mockLogs.mock.calls[0][0], assetRead.mock.calls[0][0]]
  view.rerender({ profile: 'canvas' })
  expect(detailSignals.every(signal => signal.aborted)).toBe(true)
  expect(view.result.current.instanceMessages).toEqual({})
  expect(view.result.current.isLoadingMessages).toBe(false)
  await waitFor(() => expect(view.result.current.isLoadingStats).toBe(false))
  expect(view.result.current.instanceStats.a.requirements).toBeUndefined()
  expect(view.result.current.instanceStats.a.assets).toBeUndefined()
  expect(mockRpc).toHaveBeenCalledTimes(1)
  expect(mockLogs).toHaveBeenCalledTimes(2)
  expect(mockRequirements).toHaveBeenCalledTimes(1)

  mockRequirements.mockResolvedValue({ count: 4, error: null })
  view.rerender({ profile: 'full' })
  expect(view.result.current.instanceStats.a?.requirements).toBeUndefined()
  await waitFor(() => expect(view.result.current.instanceStats.a?.requirements).toBe(4))
  await act(async () => {
    requirements.resolve({ count: 99, error: null })
    logs.resolve({ data: [{ message: 'stale' }], error: null })
    assets.resolve({ data: [{ instance_id: 'a', asset_count: 99, recent_assets: [], avatar_path: null }], error: null })
  })
  expect(view.result.current.instanceStats.a.requirements).toBe(4)
  expect(view.result.current.instanceStats.a.assets).toBe(2)
  expect(view.result.current.instanceMessages.a.user?.message).toBe('first')
  expect(view.result.current.dataError).toBeNull()
})

it('retires pending node pages on a profile change without more queries or stale publication', async () => {
  const nodes = deferred<{ data: { instance_id: string; type: string }[]; error: null }>()
  mockNodes.mockReturnValueOnce(nodes.promise)
  const view = renderHook(({ profile }) => useInstanceBrowserData(true, [{ id: 'a' }], 'site', profile), {
    initialProps: { profile: 'full' as InstanceBrowserReadProfile },
  })
  const signal = mockNodes.mock.calls[0][0] as AbortSignal
  view.rerender({ profile: 'canvas' })
  expect(signal.aborted).toBe(true)
  await waitFor(() => expect(view.result.current.instanceStats.a?.nodes).toBe(2))
  await act(async () => nodes.resolve({ data: Array.from({ length: 1000 }, () => ({ instance_id: 'a', type: 'agent' })), error: null }))
  expect(mockNodes).toHaveBeenCalledTimes(2)
  expect(mockRequirements).not.toHaveBeenCalled()
  expect(view.result.current.instanceStats.a.nodes).toBe(2)
})

it('masks old-site canvas counters and leaves failed reads unknown until a successful retry', async () => {
  const nodes = deferred<{ data: null; error: { message: string } }>()
  const view = renderHook(({ site }) => useInstanceBrowserData(true, [{ id: 'a' }], site, 'canvas'), {
    initialProps: { site: 'site-a' },
  })
  await waitFor(() => expect(view.result.current.instanceStats.a?.nodes).toBe(2))
  mockNodes.mockReturnValueOnce(nodes.promise)
  view.rerender({ site: 'site-b' })
  expect(view.result.current.instanceStats).toEqual({})
  await act(async () => nodes.resolve({ data: null, error: { message: 'denied' } }))
  expect(view.result.current.dataError).toBe('Instance details unavailable')
  expect(view.result.current.instanceStats.a?.nodes).toBeUndefined()
  expect(view.result.current.instanceStats.a?.workflows).toBeUndefined()
  mockNodes.mockResolvedValue({ data: [], error: null })
  await act(async () => view.result.current.retryData())
  expect(view.result.current.instanceStats.a.nodes).toBe(0)
  expect(view.result.current.instanceStats.a.workflows).toBe(0)
  expect(view.result.current.dataError).toBeNull()
  expect(mockRpc).not.toHaveBeenCalled()
})