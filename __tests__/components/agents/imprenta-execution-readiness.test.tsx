import { act, renderHook } from '@testing-library/react'
import { toast } from 'sonner'
import { useImprentaExecution } from '@/app/components/agents/imprenta-panel/execution'
import { executeImprentaNode } from '@/app/components/agents/imprenta-execution-client'
import { validatePublishNodeInputs } from '@/app/components/agents/imprenta-publish-context'
import type { InstanceNode } from '@/app/types/instance-nodes'

jest.mock('sonner', () => ({ toast: { error: jest.fn(), info: jest.fn(), success: jest.fn() } }))
jest.mock('@/app/components/agents/imprenta-execution-client', () => ({ executeImprentaNode: jest.fn() }))
jest.mock('@/app/components/agents/imprenta-publish-context', () => ({ validatePublishNodeInputs: jest.fn() }))
jest.mock('@/app/components/simple-messages-view/utils', () => ({ getSystemPromptForActivity: () => 'System prompt' }))

type Options = Parameters<typeof useImprentaExecution>[0]
type ExecutionResponse = Awaited<ReturnType<typeof executeImprentaNode>>
const node: InstanceNode = {
  id: 'publish-a', type: 'publish', instance_id: 'instance-a', site_id: 'site-a', user_id: 'user-a',
  parent_node_id: null, original_node_id: null, parent_instance_log_id: null,
  status: 'pending', prompt: { text: 'Publish' }, settings: { publish_destinations: ['mail'] },
  result: {}, created_at: '2026-11-17', updated_at: '2026-11-17',
}
const update = jest.fn()
const ensureImprentaLogs = jest.fn()
const wait = jest.fn()
let options: Options

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function persistStatus(waitForRunning?: Promise<void>) {
  const stored = { ...node }
  let revision = 0
  type Result = { data: InstanceNode | null; error: null }
  type Query = {
    eq: (key: keyof InstanceNode, value: unknown) => Query
    select: () => Query
    single: () => Query
    maybeSingle: () => Query
    then: (resolve: (value: Result) => unknown) => Promise<unknown>
  }
  update.mockImplementation((values: Partial<InstanceNode>) => {
    const filters: [keyof InstanceNode, unknown][] = []
    const query: Query = {
      eq: jest.fn((key: keyof InstanceNode, value: unknown) => { filters.push([key, value]); return query }),
      select: jest.fn(() => query),
      single: jest.fn(() => query),
      maybeSingle: jest.fn(() => query),
      then: (resolve: (value: Result) => unknown) => {
        return (values.status === 'running' ? waitForRunning ?? Promise.resolve() : Promise.resolve()).then(() => {
          if (!filters.every(([key, value]) => stored[key] === value)) return resolve({ data: null, error: null })
          Object.assign(stored, values, { updated_at: `2026-11-17T00:00:00.00000${++revision}Z` })
          return resolve({ data: { ...stored }, error: null })
        })
      },
    }
    return query
  })
  return stored
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.mocked(executeImprentaNode).mockResolvedValue({ success: true } as Awaited<ReturnType<typeof executeImprentaNode>>)
  jest.mocked(validatePublishNodeInputs).mockReturnValue(null)
  ensureImprentaLogs.mockResolvedValue([])
  wait.mockResolvedValue(undefined)
  persistStatus()
  options = {
    persistenceBarrier: { wait, track: jest.fn().mockResolvedValue(undefined) },
    nodesRef: { current: [node] }, videoParams: {},
    supabase: { from: () => ({ update }) }, setNodes: jest.fn(), setDummyNodes: jest.fn(),
    contexts: [], canvasNodes: [node], currentSite: { id: 'site-a' }, activeInstanceId: 'instance-a',
    isGraphReady: true, ensureImprentaLogs,
  } as unknown as Options
})

afterEach(() => { jest.restoreAllMocks() })

it.each([false, true])('awaits current logs before any publish side effects (test=%s)', async test => {
  const pending = deferred<Record<string, unknown>[]>()
  ensureImprentaLogs.mockReturnValueOnce(pending.promise)
  const { result } = renderHook(() => useImprentaExecution(options))
  let execution!: Promise<void>
  await act(async () => {
    execution = result.current.handleExecuteNode(node, test ? { email: 'qa@example.test' } : undefined)
  })
  expect(ensureImprentaLogs).toHaveBeenCalledTimes(1)
  expect(update).not.toHaveBeenCalled()
  expect(options.setDummyNodes).not.toHaveBeenCalled()
  expect(executeImprentaNode).not.toHaveBeenCalled()
  const freshLogs = [{ id: 'current-log', command_id: 'audience-a' }]
  await act(async () => { pending.resolve(freshLogs); await execution })
  expect(executeImprentaNode).toHaveBeenCalledTimes(1)
  if (!test) expect(validatePublishNodeInputs).toHaveBeenCalledWith(node, [], [node], freshLogs)
  else expect(validatePublishNodeInputs).not.toHaveBeenCalled()
})

it.each([false, true])('fails closed when required logs fail (test=%s)', async test => {
  ensureImprentaLogs.mockRejectedValueOnce(new Error('Logs unavailable'))
  const { result } = renderHook(() => useImprentaExecution(options))
  await act(async () => {
    await result.current.handleExecuteNode(node, test ? { email: 'qa@example.test' } : undefined)
  })
  expect(executeImprentaNode).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
  expect(options.setDummyNodes).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('logs'))
})

it('does not wait for logs for generation when nodes and connections are complete', async () => {
  const generation = { ...node, type: 'generate-image' }
  options.nodesRef.current = [generation]
  options.canvasNodes = [generation]
  ensureImprentaLogs.mockReturnValue(new Promise(() => {}))
  const { result } = renderHook(() => useImprentaExecution(options))
  await act(async () => { await result.current.handleExecuteNode(generation) })
  expect(ensureImprentaLogs).not.toHaveBeenCalled()
  expect(executeImprentaNode).toHaveBeenCalledTimes(1)
})

it.each(['publish', 'generate-image'])('blocks %s before complete graph readiness', async type => {
  options.isGraphReady = false
  const { result } = renderHook(() => useImprentaExecution(options))
  await act(async () => { await result.current.handleExecuteNode({ ...node, type }) })
  expect(ensureImprentaLogs).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
  expect(executeImprentaNode).not.toHaveBeenCalled()
})

it.each(['instance', 'site', 'round-trip', 'unmount'])('retires publish admission on %s changes while logs load', async change => {
  const pending = deferred<Record<string, unknown>[]>()
  ensureImprentaLogs.mockReturnValueOnce(pending.promise)
  const { result, rerender, unmount } = renderHook(props => useImprentaExecution(props), { initialProps: options })
  let execution!: Promise<void>
  await act(async () => { execution = result.current.handleExecuteNode(node) })
  if (change === 'unmount') unmount()
  else {
    rerender(change === 'site'
      ? { ...options, currentSite: { ...options.currentSite!, id: 'site-b' } }
      : { ...options, activeInstanceId: 'instance-b' })
    if (change === 'round-trip') rerender(options)
  }
  await act(async () => { pending.resolve([]); await execution })
  expect(executeImprentaNode).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
})

it('rechecks graph readiness and latest contexts after waiting for logs', async () => {
  const pending = deferred<Record<string, unknown>[]>()
  ensureImprentaLogs.mockReturnValueOnce(pending.promise)
  const { result, rerender } = renderHook(props => useImprentaExecution(props), { initialProps: options })
  let execution!: Promise<void>
  await act(async () => { execution = result.current.handleExecuteNode(node) })
  rerender({ ...options, isGraphReady: false })
  await act(async () => { pending.resolve([]); await execution })
  expect(executeImprentaNode).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
})

it('uses contexts committed while publish logs were loading', async () => {
  const pending = deferred<Record<string, unknown>[]>()
  ensureImprentaLogs.mockReturnValueOnce(pending.promise)
  const { result, rerender } = renderHook(props => useImprentaExecution(props), { initialProps: options })
  let execution!: Promise<void>
  await act(async () => { execution = result.current.handleExecuteNode(node) })
  const contexts = [{ id: 'content-link', target_node_id: node.id, context_node_id: 'content' }]
  rerender({ ...options, contexts })
  await act(async () => { pending.resolve([]); await execution })
  expect(validatePublishNodeInputs).toHaveBeenCalledWith(node, contexts, [node], [])
})

it('blocks generation if the canvas changes while pending edits are saved', async () => {
  const pending = deferred<void>()
  wait.mockReturnValueOnce(pending.promise)
  const generation = { ...node, type: 'generate-image' }
  options.nodesRef.current = [generation]
  const { result, rerender } = renderHook(props => useImprentaExecution(props), { initialProps: options })
  let execution!: Promise<void>
  await act(async () => { execution = result.current.handleExecuteNode(generation) })
  rerender({ ...options, activeInstanceId: 'instance-b' })
  await act(async () => { pending.resolve(); await execution })
  expect(executeImprentaNode).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
})

it('never exposes raw persistence errors in the execution notice', async () => {
  wait.mockRejectedValueOnce(new Error('Private database details'))
  const { result } = renderHook(() => useImprentaExecution(options))
  await act(async () => { await result.current.handleExecuteNode(node) })
  expect(toast.error).toHaveBeenCalledWith('Load the current canvas and save the latest changes before executing')
  expect(executeImprentaNode).not.toHaveBeenCalled()
})

describe('admitted execution lifecycle', () => {
  const rejected: ExecutionResponse = {
    success: false, status: 400,
    error: { message: 'Invalid execution input', details: { execution_started: false } },
  }
  const scopeChanges = ['instance', 'site', 'round-trip', 'unmount'] as const
  function navigate(change: typeof scopeChanges[number], rerender: (props: Options) => void, unmount: () => void) {
    if (change === 'unmount') unmount()
    else {
      rerender(change === 'site'
        ? { ...options, currentSite: { ...options.currentSite!, id: 'site-b' } }
        : { ...options, activeInstanceId: 'instance-b' })
      if (change === 'round-trip') rerender(options)
    }
  }

  it.each(scopeChanges)('still sends the admitted request after %s during the running-status write', async change => {
    const pending = deferred<void>()
    const stored = persistStatus(pending.promise)
    const { result, rerender, unmount } = renderHook(props => useImprentaExecution(props), { initialProps: options })
    let execution!: Promise<void>
    await act(async () => { execution = result.current.handleExecuteNode(node) })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'running' }))
    expect(executeImprentaNode).not.toHaveBeenCalled()
    navigate(change, rerender, unmount)
    options.nodesRef.current = []
    await act(async () => { pending.resolve(); await execution })

    expect(stored.status).toBe('running')
    expect(executeImprentaNode).toHaveBeenCalledTimes(1)
    expect(executeImprentaNode).toHaveBeenCalledWith(expect.objectContaining({
      instance_node_id: node.id, instance_id: node.instance_id, site_id: node.site_id, message: 'Publish',
    }))
    expect(update).toHaveBeenCalledTimes(1)
    expect(options.setNodes).toHaveBeenCalledTimes(1)
    expect(options.setDummyNodes).toHaveBeenCalledTimes(1)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it.each(scopeChanges)('cleans up a known rejected execution after %s without publishing stale UI', async change => {
    const pending = deferred<ExecutionResponse>()
    const stored = persistStatus()
    jest.mocked(executeImprentaNode).mockReturnValueOnce(pending.promise)
    const { result, rerender, unmount } = renderHook(props => useImprentaExecution(props), { initialProps: options })
    let execution!: Promise<void>
    await act(async () => { execution = result.current.handleExecuteNode(node) })
    expect(executeImprentaNode).toHaveBeenCalledTimes(1)
    expect(stored.status).toBe('running')
    navigate(change, rerender, unmount)
    await act(async () => { pending.resolve(rejected); await execution })

    expect(stored.status).toBe('failed')
    expect(update).toHaveBeenLastCalledWith({ status: 'failed' })
    expect(options.setNodes).toHaveBeenCalledTimes(1)
    expect(options.setDummyNodes).toHaveBeenCalledTimes(1)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it.each(['running', 'completed', 'cancelled'] as const)('does not overwrite a newer durable %s revision', async status => {
    const pending = deferred<ExecutionResponse>()
    const stored = persistStatus()
    jest.mocked(executeImprentaNode).mockReturnValueOnce(pending.promise)
    const { result } = renderHook(() => useImprentaExecution(options))
    let execution!: Promise<void>
    await act(async () => { execution = result.current.handleExecuteNode(node) })
    Object.assign(stored, { status, updated_at: '2026-11-17T01:00:00.000001Z' })
    await act(async () => { pending.resolve(rejected); await execution })
    expect(stored.status).toBe(status)
    expect(options.setNodes).toHaveBeenCalledTimes(1)
  })

  it('does not let an older rejected attempt fail a newer execution after returning to its canvas', async () => {
    const pending = deferred<ExecutionResponse>()
    const newerPending = deferred<ExecutionResponse>()
    const stored = persistStatus()
    jest.mocked(executeImprentaNode).mockReturnValueOnce(pending.promise).mockReturnValueOnce(newerPending.promise)
    const { result, rerender } = renderHook(props => useImprentaExecution(props), { initialProps: options })
    let execution!: Promise<void>
    let newerExecution!: Promise<void>
    await act(async () => { execution = result.current.handleExecuteNode(node) })
    navigate('round-trip', rerender, () => {})
    await act(async () => { newerExecution = result.current.handleExecuteNode(node) })
    await act(async () => { pending.resolve(rejected); await execution })
    expect(update).toHaveBeenCalledTimes(2)
    expect(stored.status).toBe('running')
    expect(toast.error).not.toHaveBeenCalled()
    await act(async () => { newerPending.resolve({ success: true }); await newerExecution })
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it.each<ExecutionResponse>([
    { success: false, error: { message: 'Network disconnected' } },
    ...[500, 502, 503, 504].map(status => ({ success: false, status, error: { message: 'Upstream failure' } })),
    { success: false, status: 409, error: { message: 'Execution busy', details: { execution_started: false } } },
    { success: false, status: 400, error: { message: 'Execution already started', details: { execution_started: true } } },
  ])('preserves running state for an uncertain or busy response: %j', async response => {
    const stored = persistStatus()
    jest.mocked(executeImprentaNode).mockResolvedValueOnce(response)
    const { result } = renderHook(() => useImprentaExecution(options))
    await act(async () => { await result.current.handleExecuteNode(node) })
    expect(stored.status).toBe('running')
    expect(update).toHaveBeenCalledTimes(1)
    expect(executeImprentaNode).toHaveBeenCalledTimes(1)
    expect(options.setNodes).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('Execution could not be confirmed. Check its status before trying again.')
  })

  it('cleans up explicit capacity rejection even with an HTTP 503 response', async () => {
    const stored = persistStatus()
    jest.mocked(executeImprentaNode).mockResolvedValueOnce({ ...rejected, status: 503 })
    const { result } = renderHook(() => useImprentaExecution(options))
    await act(async () => { await result.current.handleExecuteNode(node) })
    expect(stored.status).toBe('failed')
    expect(options.setNodes).toHaveBeenCalledTimes(2)
    const applyFailure = jest.mocked(options.setNodes).mock.calls[1][0] as (nodes: InstanceNode[]) => InstanceNode[]
    expect(applyFailure([{ ...node, status: 'running' }])[0].status).toBe('failed')
  })
})
