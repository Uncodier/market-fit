import { createClient } from '@/lib/supabase/client'
import { subscribeInstanceLogsRealtime } from '@/app/components/simple-messages-view/hooks/subscribeInstanceLogsRealtime'
import { findRunningUserLog } from '@/app/components/simple-messages-view/hooks/useRunningWorkflow'
import { shouldQueueCommand } from '@/app/components/simple-messages-view/hooks/command-queue'
import type { InstanceLog } from '@/app/components/simple-messages-view/types'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

const action: InstanceLog = {
  id: '11111111-1111-4111-8111-111111111111', instance_id: 'instance-1', site_id: 'site-1',
  log_type: 'user_action', level: 'info', message: 'Continue', created_at: '2026-10-01T00:00:00Z',
  details: { status: 'running', prompt_source: 'frontend', request_id: 'request-1' },
}
const finalReply: InstanceLog = {
  id: 'reply-1', instance_id: 'instance-1', log_type: 'agent_action', level: 'info',
  message: 'Done', created_at: '2026-10-01T00:00:01Z',
  details: { response_type: 'assistant_step', total_tool_calls: 0 },
}
type Payload = { eventType: 'INSERT' | 'UPDATE'; new: InstanceLog }
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

function setup(initial: InstanceLog[] = [action], replayUpdater = false) {
  let logs = clone(initial)
  const logsRef = { current: logs }
  const rows = new Map(initial.map((log) => [log.id, clone(log)]))
  const writes: Array<{ patch: { details: unknown }; filters: Array<[string, unknown]> }> = []
  let beforeWrite: (() => void) | undefined
  let callback!: (payload: Payload) => void
  const channel: { on: jest.Mock; subscribe: jest.Mock } = {
    on: jest.fn((_type, _filter, handler: typeof callback) => { callback = handler; return channel }),
    subscribe: jest.fn(),
  }
  const client = {
    channel: jest.fn(() => channel), removeChannel: jest.fn(),
    from: jest.fn(() => {
      const filters: Array<[string, unknown]> = []
      let patch: { details: unknown } | undefined
      const execute = async () => {
        if (patch) beforeWrite?.()
        const row = [...rows.values()].find((row) => filters.every(([key, value]) => {
          if (key === 'details') return JSON.stringify(row.details) === value
          const actual = key === 'details->>status' ? row.details.status : row[key as keyof InstanceLog]
          return actual === value
        }))
        if (patch) {
          writes.push({ patch, filters })
          if (row) row.details = clone(patch.details)
        }
        return { data: row ? clone(row) : null, error: null }
      }
      const query: {
        select: jest.Mock; eq: jest.Mock; update: jest.Mock
        single: typeof execute; maybeSingle: typeof execute
      } = {
        select: jest.fn(() => query),
        eq: jest.fn((key: string, value: unknown) => { filters.push([key, value]); return query }),
        update: jest.fn((value: { details: unknown }) => { patch = value; return query }),
        single: execute, maybeSingle: execute,
      }
      return query
    }),
  }
  jest.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)
  const onResponse = jest.fn()
  const currentInstance = { current: 'instance-1' }
  const waitingId = { current: 'pending-123' }
  const dispose = subscribeInstanceLogsRealtime({
    instanceId: 'instance-1', logsRef, currentRobotInstanceIdRef: currentInstance,
    waitingForMessageIdRef: waitingId, onResponseReceivedRef: { current: onResponse },
    loadInstanceLogsRef: { current: async () => {} },
    setLogs: (updater) => { if (replayUpdater) updater(logs); logs = updater(logs) },
    setCollapsedSystemMessages: jest.fn(), setCollapsedToolDetails: jest.fn(),
  })
  const emit = (log: InstanceLog, eventType: Payload['eventType'] = 'INSERT') => {
    rows.set(log.id, clone(log))
    callback({ eventType, new: clone(log) })
  }
  return {
    emit, dispose, writes, client, onResponse, currentInstance, waitingId, rows,
    logs: () => logs, beforeWrite: (fn: () => void) => { beforeWrite = fn },
  }
}

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

describe('Realtime events cannot prematurely stop workflows', () => {
  const cleanups: Array<() => void> = []
  const harness = (...args: Parameters<typeof setup>) => {
    const h = setup(...args); cleanups.push(h.dispose); return h
  }
  afterEach(() => { cleanups.splice(0).forEach((dispose) => dispose()); jest.clearAllMocks() })

  it.each(['INSERT', 'UPDATE'] as const)('ignores intermediate %s events even for legacy actions', async (eventType) => {
    const h = harness()
    for (const event of [
      { ...finalReply, message: 'Assistant step execution', details: { response_type: 'assistant_step', total_tool_calls: 1 } },
      { ...finalReply, message: 'I will check', details: { response_type: 'assistant_step', total_tool_calls: 1 } },
      { ...finalReply, details: { response_type: 'assistant_step', streaming: false } },
      { ...finalReply, message: 'placeholder response', details: {} },
      { ...finalReply, log_type: 'tool_call' as const, tool_name: 'skill_lookup', tool_result: { success: true } },
    ]) h.emit(event, eventType)
    await flush()
    expect(h.client.from).not.toHaveBeenCalled()
    expect(findRunningUserLog(h.logs())?.id).toBe(action.id)
    expect(h.onResponse).not.toHaveBeenCalled()
  })

  it('retains running ownership through tools, checkpoint and final text until the backend settles the action', async () => {
    const managed = { ...action, details: { ...action.details, prompt_source: 'assistant_route' } }
    const h = harness([managed])
    h.emit({ ...finalReply, message: 'Assistant step execution', details: { response_type: 'assistant_step', total_tool_calls: 1 } })
    h.emit({ ...finalReply, id: 'tool-1', log_type: 'tool_call', tool_name: 'skill_lookup', tool_result: { success: true } })
    const checkpoint = { ...managed, details: { ...managed.details,
      assistant_recovery: { inFlight: false, messages: [{ role: 'tool', content: 'receipt' }] },
    } }
    h.emit(checkpoint, 'UPDATE')
    h.emit({ ...finalReply, id: 'final-answer' })
    await flush()
    expect(h.writes).toEqual([])
    expect(shouldQueueCommand(Boolean(findRunningUserLog(h.logs())))).toBe(true)
    expect(h.rows.get(action.id)?.details.assistant_recovery.messages).toHaveLength(1)
    expect(h.onResponse).not.toHaveBeenCalled()

    h.emit({ ...checkpoint, details: { ...checkpoint.details, status: 'completed' } }, 'UPDATE')
    expect(shouldQueueCommand(Boolean(findRunningUserLog(h.logs())))).toBe(false)
    expect(h.onResponse).toHaveBeenCalledTimes(1)
    h.emit(h.rows.get(action.id)!, 'UPDATE')
    expect(h.onResponse).toHaveBeenCalledTimes(1)
    expect(h.writes).toEqual([])
  })

  it.each(['INSERT', 'UPDATE'] as const)('does not auto-stop managed actions for final/error %s events', async (eventType) => {
    const h = harness([{ ...action, details: { ...action.details, prompt_source: 'assistant_route' } }])
    h.emit(finalReply, eventType)
    h.emit({ ...finalReply, id: 'error-1', log_type: 'error', details: {} }, eventType)
    await flush()
    expect(h.client.from).not.toHaveBeenCalled()
    expect(h.logs()[0].details.status).toBe('running')
    expect(h.onResponse).not.toHaveBeenCalled()
  })

  it.each(['INSERT', 'UPDATE'] as const)('preserves one legacy auto-stop on a true final %s', async (eventType) => {
    const h = harness([action], true)
    h.emit(finalReply, eventType)
    h.emit(finalReply, eventType)
    await flush()
    expect(h.writes).toHaveLength(1)
    expect(h.writes[0].filters).toEqual(expect.arrayContaining([
      ['details->>status', 'running'], ['details', JSON.stringify(action.details)], ['instance_id', 'instance-1'],
    ]))
    expect(h.rows.get(action.id)?.details.status).toBe('stopped')
    expect(findRunningUserLog(h.logs())).toBeNull()
    expect(h.onResponse).toHaveBeenCalledTimes(1)
  })

  it.each(['completed', 'failed', 'paused', 'cancelled', 'stopped'])('observes server status %s without writing it again', (status) => {
    const h = harness([{ ...action, details: { ...action.details, prompt_source: 'assistant_route' } }])
    h.emit({ ...action, details: { ...action.details, status, prompt_source: 'assistant_route' } }, 'UPDATE')
    expect(h.onResponse).toHaveBeenCalledTimes(1)
    expect(findRunningUserLog(h.logs())).toBeNull()
    expect(h.client.from).not.toHaveBeenCalled()
  })

  it.each(['cancelled', 'completed', 'paused'])('does not overwrite concurrent %s or lie locally after a rejected write', async (status) => {
    const h = harness()
    h.beforeWrite(() => { h.rows.get(action.id)!.details.status = status })
    h.emit(finalReply)
    await flush()
    expect(h.rows.get(action.id)?.details.status).toBe(status)
    expect(h.logs()[0].details.status).toBe('running')
    expect(h.onResponse).not.toHaveBeenCalled()
  })

  it('rechecks ownership in the database when the local action is stale', async () => {
    const h = harness()
    h.rows.get(action.id)!.details.assistant_recovery = { inFlight: true }
    h.emit(finalReply)
    await flush()
    expect(h.writes).toHaveLength(0)
    expect(h.logs()[0].details.status).toBe('running')
  })

  it('ignores stale responses and never searches behind the latest managed action', async () => {
    const newer = { ...action, id: '22222222-2222-4222-8222-222222222222',
      created_at: '2026-10-01T00:00:02Z', details: { status: 'running', prompt_source: 'assistant_route' } }
    const h = harness([action, newer])
    h.emit(finalReply, 'UPDATE')
    h.emit({ ...finalReply, created_at: '2026-10-01T00:00:03Z' })
    h.emit({ ...action, details: { ...action.details, status: 'completed' } }, 'UPDATE')
    await flush()
    expect(h.writes).toEqual([])
    expect(h.onResponse).not.toHaveBeenCalled()
    expect(findRunningUserLog(h.logs())?.id).toBe(newer.id)
  })

  it('does not apply an in-flight result to a different instance view', async () => {
    const h = harness()
    h.emit(finalReply)
    h.currentInstance.current = 'other-instance'
    await flush()
    expect(h.onResponse).not.toHaveBeenCalled()
    expect(h.logs()[0].details.status).toBe('running')
  })

  it('ignores an old terminal update while a newer send has no persisted row yet', () => {
    const h = harness()
    h.waitingId.current = `pending-${Date.parse('2026-10-01T00:01:00Z')}`
    h.emit({ ...action, details: { ...action.details, status: 'completed' } }, 'UPDATE')
    expect(h.onResponse).not.toHaveBeenCalled()
  })

  it('notifies once across the legacy write and its echoed terminal UPDATE', async () => {
    const h = harness()
    h.emit(finalReply)
    await flush()
    h.emit(h.rows.get(action.id)!, 'UPDATE')
    h.emit(h.rows.get(action.id)!, 'UPDATE')
    expect(h.onResponse).toHaveBeenCalledTimes(1)
    expect(h.writes).toHaveLength(1)
  })
})