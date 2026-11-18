import { act, renderHook } from '@testing-library/react'
import type { SetStateAction } from 'react'
import type { InstanceNode } from '@/app/types/instance-nodes'
import type { ImprentaContext } from '@/app/components/agents/imprenta-panel/data-types'
import { useImprentaSynchronization } from '@/app/components/agents/imprenta-panel/sync'
import { fetchContextsForNodes } from '@/app/hooks/imprenta-data-fetchers'

jest.mock('@/app/hooks/imprenta-data-fetchers', () => ({ fetchContextsForNodes: jest.fn() }))

type Options = Parameters<typeof useImprentaSynchronization>[0]
type Snapshot = NonNullable<Awaited<ReturnType<Options['refreshImprentaData']>>>
type ContextEvent = {
  eventType: string
  new?: { target_node_id?: string }
  old?: { id?: string; target_node_id?: string }
}

const node = (overrides: Partial<InstanceNode> = {}): InstanceNode => ({
  id: 'node-a', instance_id: 'instance-a', site_id: 'site-a', user_id: 'user-a',
  parent_node_id: null, original_node_id: null, parent_instance_log_id: null,
  type: 'prompt', status: 'pending', prompt: {}, settings: {}, result: {},
  created_at: '2026-11-17', updated_at: '2026-11-17', ...overrides,
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(finish => { resolve = finish })
  return { promise, resolve }
}

function setup(nodes = [node()]) {
  type NodeEvent = { eventType: string; new: InstanceNode; old: Partial<InstanceNode> }
  const handlers = new Map<string, (event: ContextEvent | NodeEvent) => void>()
  const fetchContexts = jest.mocked(fetchContextsForNodes).mockReset().mockResolvedValue([])
  const channel = jest.fn((name: string) => {
    const subscription = {
      on: (_event: string, _filter: unknown, handler: (event: ContextEvent | NodeEvent) => void) => {
        handlers.set(name, handler)
        return subscription
      },
      subscribe: () => subscription,
    }
    return subscription
  })
  const supabase = {
    channel, removeChannel: jest.fn(),
    from: jest.fn(),
  }
  const nodesRef = { current: nodes }
  const setNodes = jest.fn((update: SetStateAction<InstanceNode[]>) => {
    nodesRef.current = typeof update === 'function' ? update(nodesRef.current) : update
  })
  const setContexts = jest.fn((update: SetStateAction<ImprentaContext[]>) => {
    if (typeof update === 'function') update([])
  })
  const refresh = jest.fn<ReturnType<Options['refreshImprentaData']>, Parameters<Options['refreshImprentaData']>>()
    .mockResolvedValue(undefined)
  const options: Options = {
    activeInstanceId: 'instance-a', imprentaData: undefined,
    imprentaSyncedInstanceRef: { current: 'instance-a' },
    imprentaRequestedInstanceRef: { current: 'instance-a' },
    deletedNodeIdsRef: { current: new Set<string>() },
    setInitialPrompt: jest.fn(), setDummyNodes: jest.fn(), setPositions: jest.fn(),
    setGeneratingNodeIds: jest.fn(), generatingNodeIds: new Set<string>(),
    setSelectedContextId: jest.fn(),
    hoverStore: { get: () => null, set: jest.fn(), subscribe: () => () => {} },
    setZoomedMedia: jest.fn(), setTempConnection: jest.fn(), setNodes, setContexts,
    nodesRef, nodeHeightsRef: { current: {} },
    supabase: supabase as unknown as Options['supabase'], refreshImprentaData: refresh,
  }
  const hook = renderHook((props: Options) => useImprentaSynchronization(props), { initialProps: options })
  const contextEvent = (event: ContextEvent, instanceId = 'instance-a') => {
    act(() => { handlers.get(`instance_node_contexts_${instanceId}`)!(event) })
  }
  const insertNode = (record: InstanceNode) => {
    act(() => { handlers.get('instance_nodes_instance-a')!({ eventType: 'INSERT', new: record, old: {} }) })
  }
  return { ...hook, options, refresh, fetchContexts, channel, setNodes, setContexts, contextEvent, insertNode }
}

async function advance(milliseconds: number) {
  await act(async () => { await jest.advanceTimersByTimeAsync(milliseconds) })
}

function visibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
}

beforeEach(() => {
  jest.useFakeTimers()
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})

afterEach(() => { jest.useRealTimers() })

it('never polls idle pending drafts, including chat branches and ordinary child nodes', async () => {
  const h = setup([
    node(), node({ id: 'branch', parent_instance_log_id: 'chat-log' }),
    node({ id: 'child', parent_node_id: 'node-a', settings: { media_type: 'image' } }),
    node({ id: 'old-result', result: { status: 'done' } }),
    node({ id: 'foreign', instance_id: 'instance-b', status: 'running' }),
  ])
  await advance(60_000)
  expect(h.refresh).not.toHaveBeenCalled()
  expect(h.fetchContexts).not.toHaveBeenCalled()
})

it('backs off historical running snapshots and preserves node identity on each unchanged read', async () => {
  const old = node({ status: 'running', updated_at: '2026-05-18' })
  const h = setup([old])
  h.refresh.mockImplementation(async () => ({ nodes: [{ ...old }], contexts: [], logs: [] }))
  const initial = h.options.nodesRef.current
  await advance(60000)
  expect(h.refresh).toHaveBeenCalledTimes(3)
  expect(h.options.nodesRef.current).toBe(initial)
  await advance(45000)
  expect(h.refresh).toHaveBeenCalledTimes(3)
  visibility('visible')
  await advance(1000)
  expect(h.refresh).toHaveBeenCalledTimes(4)
})

it.each([
  ['running node', { status: 'running' }],
  ['backend starting node', { status: 'starting' }],
  ['local execution dummy', { id: 'dummy-1', type: 'Generating...', status: 'running' }],
  ['persisted running result', { result: { status: 'running' } }],
  ['persisted streaming result', { result: { status: 'streaming' } }],
] as const)('polls recovery for a %s', async (_label, overrides) => {
  // Starting is a backend compatibility state absent from InstanceNodeStatus.
  const h = setup([node(overrides as Partial<InstanceNode>)])
  await advance(15_000)
  expect(h.refresh).toHaveBeenCalledTimes(1)
  expect(h.refresh).toHaveBeenCalledWith({ includeLogs: false })
})

it('uses current generating IDs without resubscribing, and stops after completion', async () => {
  const h = setup()
  await advance(15_000)
  expect(h.refresh).not.toHaveBeenCalled()
  h.rerender({ ...h.options, generatingNodeIds: new Set(['node-a']) })
  await advance(15_000)
  expect(h.refresh).toHaveBeenCalledTimes(1)
  expect(h.channel).toHaveBeenCalledTimes(2)
  h.options.nodesRef.current = [node({ status: 'completed' })]
  await advance(15_000)
  expect(h.refresh).toHaveBeenCalledTimes(1)
})

it('pauses hidden-page polling but reconciles logs on visibility even for idle drafts', async () => {
  const h = setup([node({ status: 'running' })])
  visibility('hidden')
  await advance(30_000)
  expect(h.refresh).not.toHaveBeenCalled()
  h.options.nodesRef.current = [node()]
  visibility('visible')
  await advance(1_000)
  expect(h.refresh).toHaveBeenCalledTimes(1)
  expect(h.refresh).toHaveBeenCalledWith({ includeLogs: true })
})

it('coalesces overlapping polls and preserves a queued visibility log upgrade', async () => {
  const h = setup([node({ status: 'running' })])
  const first = deferred<Snapshot>()
  const second = deferred<Snapshot>()
  h.refresh.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  await advance(15_000)
  visibility('visible')
  await advance(31_000)
  expect(h.refresh).toHaveBeenCalledTimes(1)
  await act(async () => { first.resolve({ nodes: [node({ status: 'running' })], contexts: [], logs: [] }) })
  expect(h.refresh.mock.calls).toEqual([[{ includeLogs: false }], [{ includeLogs: true }]])
  await act(async () => { second.resolve({ nodes: [node({ status: 'completed' })], contexts: [], logs: [] }) })
  await advance(30_000)
  expect(h.refresh).toHaveBeenCalledTimes(2)
})

it('ignores foreign context targets, retains moved-away edges and unknown DELETE recovery', async () => {
  const h = setup()
  for (const eventType of ['INSERT', 'UPDATE', 'DELETE']) {
    h.contextEvent({ eventType, new: { target_node_id: 'foreign' }, old: { target_node_id: 'other' } })
  }
  await advance(500)
  expect(h.fetchContexts).not.toHaveBeenCalled()
  h.contextEvent({ eventType: 'UPDATE', new: { target_node_id: 'foreign' }, old: { target_node_id: 'node-a' } })
  await advance(500)
  expect(h.fetchContexts).toHaveBeenCalledWith(['node-a'])
  h.contextEvent({ eventType: 'DELETE', old: { id: 'unknown-deleted-context' } })
  await advance(500)
  expect(h.fetchContexts).toHaveBeenCalledTimes(2)
})

it('recovers contexts arriving before a new target finishes its buffered node insert', async () => {
  const h = setup()
  const target = node({ id: 'new-target' })
  h.insertNode(target)
  h.contextEvent({ eventType: 'INSERT', new: { target_node_id: target.id } })
  await advance(600)
  expect(h.fetchContexts).toHaveBeenCalledWith(['node-a', 'new-target'])
  expect(h.fetchContexts).toHaveBeenCalledTimes(1)
})

it('coalesces context refetches while one read is in flight', async () => {
  const h = setup()
  const first = deferred<ImprentaContext[]>()
  h.fetchContexts.mockReturnValueOnce(first.promise)
  h.contextEvent({ eventType: 'INSERT', new: { target_node_id: 'node-a' } })
  await advance(500)
  h.contextEvent({ eventType: 'DELETE', old: { id: 'unknown' } })
  await advance(500)
  h.contextEvent({ eventType: 'DELETE', old: { id: 'unknown-2' } })
  await advance(500)
  expect(h.fetchContexts).toHaveBeenCalledTimes(1)
  await act(async () => { first.resolve([]) })
  expect(h.fetchContexts).toHaveBeenCalledTimes(2)
})

it.each(['instance switch', 'unmount'])('rejects late graph/context results and queued work after %s', async mode => {
  const h = setup([node({ status: 'running' })])
  const graph = deferred<Snapshot>()
  const contexts = deferred<ImprentaContext[]>()
  h.refresh.mockReturnValueOnce(graph.promise)
  h.fetchContexts.mockReturnValueOnce(contexts.promise)
  h.contextEvent({ eventType: 'INSERT', new: { target_node_id: 'node-a' } })
  await advance(30_000)
  expect(h.refresh).toHaveBeenCalledTimes(1)
  expect(h.fetchContexts).toHaveBeenCalledTimes(1)
  if (mode === 'unmount') h.unmount()
  else {
    h.rerender({ ...h.options, activeInstanceId: 'instance-b' })
    // Returning to the same ID must not revive the first subscription generation.
    h.rerender(h.options)
  }
  h.setNodes.mockClear()
  h.setContexts.mockClear()
  await act(async () => {
    graph.resolve({ nodes: [node({ id: 'stale' })], contexts: [], logs: [] })
    contexts.resolve([{ id: 'stale', target_node_id: 'node-a', context_node_id: 'other' }])
  })
  expect(h.setNodes).not.toHaveBeenCalled()
  expect(h.setContexts).not.toHaveBeenCalled()
  expect(h.refresh).toHaveBeenCalledTimes(1)
})

it('publishes explicit same-instance retries even after initial synchronization', async () => {
  const h = setup()
  const recovered = node({ id: 'recovered', status: 'completed' })
  h.refresh.mockResolvedValue({ nodes: [recovered], contexts: [], logs: [] })
  await act(async () => { await h.result.current.retryImprentaData() })
  expect(h.refresh).toHaveBeenCalledWith({ includeLogs: true })
  expect(h.options.nodesRef.current).toEqual([recovered])
  expect(h.setContexts).toHaveBeenCalledTimes(1)
})

it('joins retries to recovery reads and discards their results after switching instances', async () => {
  const h = setup([node({ status: 'running' })])
  const first = deferred<Snapshot>()
  const retry = deferred<Snapshot>()
  h.refresh.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise)
  await advance(15_000)
  let retryPromise!: Promise<void>
  act(() => { retryPromise = h.result.current.retryImprentaData() })
  expect(h.refresh).toHaveBeenCalledTimes(1)
  await act(async () => { first.resolve({ nodes: [node()], contexts: [], logs: [] }) })
  expect(h.refresh.mock.calls).toEqual([[{ includeLogs: false }], [{ includeLogs: true }]])
  h.rerender({ ...h.options, activeInstanceId: 'instance-b' })
  h.setNodes.mockClear()
  h.setContexts.mockClear()
  await act(async () => {
    retry.resolve({ nodes: [node({ id: 'stale' })], contexts: [], logs: [] })
    await retryPromise
  })
  expect(h.setNodes).not.toHaveBeenCalled()
  expect(h.setContexts).not.toHaveBeenCalled()
})