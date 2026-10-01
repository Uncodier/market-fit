import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { useInstanceLogs } from '@/app/components/simple-messages-view/hooks/useInstanceLogs'
import { matchesOptimisticUserMessage } from '@/app/components/simple-messages-view/hooks/use-optimistic-user-messages'
import type { InstanceLog } from '@/app/components/simple-messages-view/types'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/components/simple-messages-view/hooks/use-live-instance-logs', () => ({ useLiveInstanceLogs: jest.fn() }))

const historical: InstanceLog = {
  id: 'historical', instance_id: 'instance', site_id: 'site', log_type: 'user_action', level: 'info',
  message: 'Repeat this', created_at: '2026-10-01T12:00:00.000Z',
  details: { request_id: 'previous-request', status: 'stopped' },
}

async function setup() {
  let rows = [historical]
  let onRealtime!: (payload: { eventType: 'INSERT' | 'UPDATE'; new: InstanceLog }) => void
  const query = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    limit: jest.fn(async () => ({ data: [...rows].reverse(), error: null })),
  }
  const channel: { on: jest.Mock; subscribe: jest.Mock } = {
    on: jest.fn((_event, _filter, callback) => { onRealtime = callback; return channel }),
    subscribe: jest.fn((callback) => { callback('SUBSCRIBED'); return channel }),
  }
  jest.mocked(createClient).mockReturnValue({
    from: jest.fn(() => query), channel: jest.fn(() => channel), removeChannel: jest.fn(),
  } as unknown as ReturnType<typeof createClient>)
  const cache = new Map()
  const hook = renderHook(({ instanceId, siteId }) => useInstanceLogs({
    activeRobotInstance: { id: instanceId, status: 'completed' }, currentSiteId: siteId,
  }), {
    initialProps: { instanceId: 'instance', siteId: 'site' },
    wrapper: ({ children }) => <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}>{children}</SWRConfig>,
  })
  await waitFor(() => expect(hook.result.current.logs).toEqual([historical]))
  return { hook, setRows: (next: InstanceLog[]) => { rows = next }, emit: (log: InstanceLog, eventType: 'INSERT' | 'UPDATE' = 'INSERT') => onRealtime({ eventType, new: log }) }
}

function previewDetails(requestId = 'current-request') {
  return { id: `optimistic-${requestId}`, request_id: requestId, status: 'sending' }
}

it('shows a repeated prompt immediately and keeps it through a stale server refresh', async () => {
  const { hook } = await setup()
  act(() => { hook.result.current.addOptimisticUserMessage('Repeat this', previewDetails()) })
  expect(hook.result.current.logs.map(log => log.id)).toEqual(['historical', 'optimistic-current-request'])
  await act(async () => { await hook.result.current.loadInstanceLogs() })
  expect(hook.result.current.logs.map(log => log.id)).toEqual(['historical', 'optimistic-current-request'])
  hook.unmount()
})

it.each(['INSERT', 'UPDATE', 'refresh'] as const)('reconciles by request ID through %s even when the server normalizes text', async source => {
  const { hook, emit, setRows } = await setup()
  let rollback: (() => void) | undefined
  act(() => { rollback = hook.result.current.addOptimisticUserMessage('Repeat this', previewDetails()) })
  const saved: InstanceLog = {
    ...historical, id: 'persisted-current', message: 'Repeat this\n', created_at: new Date().toISOString(),
    details: { request_id: 'current-request', status: 'running', lifecycle_owner: 'api' },
  }
  if (source === 'refresh') {
    setRows([historical, saved])
    await act(async () => { await hook.result.current.loadInstanceLogs() })
  } else {
    act(() => { emit(saved, source) })
    expect(hook.result.current.logs).toEqual([historical, saved])
    // Repeated delivery must not create another copy.
    act(() => { emit(saved) })
  }
  expect(hook.result.current.logs).toEqual([historical, saved])
  act(() => { rollback?.() })
  expect(hook.result.current.logs).toEqual([historical, saved])
  hook.unmount()
})

it('does not resurrect a confirmed preview when a later refresh no longer contains its saved row', async () => {
  const { hook, emit, setRows } = await setup()
  act(() => { hook.result.current.addOptimisticUserMessage('Repeat this', previewDetails()) })
  act(() => { emit({ ...historical, id: 'saved', details: { request_id: 'current-request', status: 'running' } }) })
  expect(hook.result.current.logs.some(log => log.details?.temp_message)).toBe(false)
  setRows([historical])
  await act(async () => { await hook.result.current.loadInstanceLogs() })
  expect(hook.result.current.logs).toEqual([historical])
  hook.unmount()
})

it('does not reconcile another request with identical text and rolls back only the rejected preview', async () => {
  const { hook, emit } = await setup()
  let rollback: (() => void) | undefined
  act(() => {
    rollback = hook.result.current.addOptimisticUserMessage('Repeat this', previewDetails())
    hook.result.current.addOptimisticUserMessage('Repeat this', previewDetails('next-request'))
  })
  act(() => { emit({ ...historical, id: 'another-turn', details: { request_id: 'other-request', status: 'running' } }) })
  expect(hook.result.current.logs).toHaveLength(4)
  act(() => { rollback?.() })
  expect(hook.result.current.logs.map(log => log.id)).toEqual(['historical', 'another-turn', 'optimistic-next-request'])
  hook.unmount()
})

it('isolates previews and late rollback by instance and site', async () => {
  const { hook, setRows } = await setup()
  let rollback: (() => void) | undefined
  act(() => { rollback = hook.result.current.addOptimisticUserMessage('First draft', previewDetails()) })
  setRows([{ ...historical, instance_id: 'other-instance' }])
  hook.rerender({ instanceId: 'other-instance', siteId: 'other-site' })
  await waitFor(() => expect(hook.result.current.logs).toHaveLength(1))
  act(() => { hook.result.current.addOptimisticUserMessage('Other draft', previewDetails('other-request')) })
  act(() => { rollback?.() })
  expect(hook.result.current.logs.map(log => log.message)).toEqual(['Repeat this', 'Other draft'])
  hook.rerender({ instanceId: 'other-instance', siteId: 'site' })
  expect(hook.result.current.logs.some(log => log.details?.temp_message)).toBe(false)
  hook.unmount()
})

it('retains bounded text reconciliation for legacy robot previews only', () => {
  const preview = { ...historical, details: { temp_message: true } }
  expect(matchesOptimisticUserMessage(preview, historical)).toBe(true)
  expect(matchesOptimisticUserMessage(preview, { ...historical, created_at: '2026-10-01T12:03:00Z' })).toBe(false)
  expect(matchesOptimisticUserMessage(preview, { ...historical, instance_id: 'other-instance' })).toBe(false)
  expect(matchesOptimisticUserMessage({ ...preview, details: { ...preview.details, request_id: 'new-request' } }, historical)).toBe(false)
})