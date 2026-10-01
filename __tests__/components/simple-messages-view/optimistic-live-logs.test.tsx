import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { useLiveInstanceLogs } from '@/app/components/simple-messages-view/hooks/use-live-instance-logs'
import { useOptimisticUserMessages } from '@/app/components/simple-messages-view/hooks/use-optimistic-user-messages'
import { fetchLiveInstanceLogs } from '@/app/components/simple-messages-view/hooks/fetch-live-instance-logs'
import type { InstanceLog } from '@/app/components/simple-messages-view/types'

jest.mock('@/app/components/simple-messages-view/hooks/fetch-live-instance-logs', () => ({ fetchLiveInstanceLogs: jest.fn() }))

const saved: InstanceLog = {
  id: 'saved', instance_id: 'instance', site_id: 'site', log_type: 'user_action', level: 'info',
  created_at: '2026-10-01T12:00:00Z', message: '',
  details: { request_id: 'request', status: 'running', lifecycle_owner: 'api' },
}

beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks() })
afterEach(() => { jest.useRealTimers() })

it('retains the prompt when live polling confirms the preview before Realtime and later returns blank text', async () => {
  jest.mocked(fetchLiveInstanceLogs).mockResolvedValue([saved])
  const hook = renderHook(({ waiting }: { waiting: string | null }) => {
    const [persisted, setLogs] = useState<InstanceLog[]>([])
    const optimistic = useOptimisticUserMessages(persisted, 'instance', 'site')
    useLiveInstanceLogs({
      instanceId: 'instance', instanceStatus: 'completed', waitingForMessageId: waiting,
      logs: optimistic.logs, setLogs,
    })
    return optimistic
  }, { initialProps: { waiting: null } as { waiting: string | null } })

  act(() => { hook.result.current.addOptimisticUserMessage('Keep this prompt', { request_id: 'request' }) })
  await act(async () => { hook.rerender({ waiting: 'request' }) })
  expect(fetchLiveInstanceLogs).toHaveBeenCalledWith('instance')
  expect(hook.result.current.logs).toEqual([{ ...saved, message: 'Keep this prompt' }])

  await act(async () => { jest.advanceTimersByTime(1500) })
  expect(hook.result.current.logs).toEqual([{ ...saved, message: 'Keep this prompt' }])

  const complete = { ...saved, message: 'Keep this prompt\n' }
  jest.mocked(fetchLiveInstanceLogs).mockResolvedValue([complete])
  await act(async () => { jest.advanceTimersByTime(1500) })
  expect(hook.result.current.logs).toEqual([complete])
  jest.mocked(fetchLiveInstanceLogs).mockResolvedValue([saved])
  await act(async () => { jest.advanceTimersByTime(1500) })
  expect(hook.result.current.logs).toEqual([complete])
  hook.unmount()
})

it('does not retain streaming assistant text when the server clears it', async () => {
  const reply: InstanceLog = {
    ...saved, id: 'reply', log_type: 'agent_action', message: 'Partial reply', details: { streaming: true },
  }
  jest.mocked(fetchLiveInstanceLogs).mockResolvedValue([{ ...reply, message: '' }])
  const hook = renderHook(() => {
    const [persisted, setLogs] = useState([reply])
    const optimistic = useOptimisticUserMessages(persisted, 'instance', 'site')
    useLiveInstanceLogs({ instanceId: 'instance', logs: optimistic.logs, setLogs })
    return optimistic.logs
  })
  await act(async () => {})
  expect(hook.result.current).toEqual([{ ...reply, message: '' }])
  hook.unmount()
})