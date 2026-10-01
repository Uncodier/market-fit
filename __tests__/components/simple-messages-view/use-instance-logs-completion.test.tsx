import { act, cleanup, renderHook } from '@testing-library/react'
import { useInstanceLogs } from '@/app/components/simple-messages-view/hooks/useInstanceLogs'
import type { InstanceLog } from '@/app/components/simple-messages-view/types'

let mockLogs: InstanceLog[] = []
const mockMutate = jest.fn()
jest.mock('swr', () => ({
  __esModule: true, default: () => ({ data: mockLogs, isLoading: false, mutate: mockMutate }),
}))
jest.mock('@/app/components/simple-messages-view/hooks/subscribeInstanceLogsRealtime', () => ({
  subscribeInstanceLogsRealtime: () => () => {},
}))
jest.mock('@/app/components/simple-messages-view/hooks/use-live-instance-logs', () => ({
  useLiveInstanceLogs: () => {},
}))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('Unexpected database call') } }))

const action: InstanceLog = {
  id: '11111111-1111-4111-8111-111111111111', instance_id: 'instance-1',
  log_type: 'user_action', level: 'info', message: 'Continue',
  created_at: '2026-10-01T00:00:00Z', details: { status: 'completed', prompt_source: 'assistant_route' },
}
const initialProps = { activeRobotInstance: { id: 'instance-1', status: 'running' }, waitingForMessageId: 'pending-123' }

describe('polled completion belongs to the active send', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockLogs = [action]
    mockMutate.mockReset().mockImplementation(async () => mockLogs)
  })
  afterEach(() => { cleanup(); jest.clearAllTimers(); jest.useRealTimers() })

  it('does not treat final-looking text as completion of a running workflow', async () => {
    mockLogs = [
      { ...action, details: { ...action.details, status: 'running' } },
      { ...action, id: 'response-1', log_type: 'agent_action', message: 'I will continue',
        details: { response_type: 'assistant_step', total_tool_calls: 0 } },
    ]
    const onResponseReceived = jest.fn()
    const h = renderHook(() => useInstanceLogs({ ...initialProps, onResponseReceived }))
    await act(async () => { await h.result.current.loadInstanceLogs() })
    expect(onResponseReceived).not.toHaveBeenCalled()
  })

  it.each(['instance', 'waiting turn'])('ignores a fetch that completes after the %s changes', async (change) => {
    const onResponseReceived = jest.fn()
    const h = renderHook((props) => useInstanceLogs({ ...props, onResponseReceived }), { initialProps })
    await act(async () => {})
    onResponseReceived.mockClear()
    let resolve!: (logs: InstanceLog[]) => void
    mockMutate.mockImplementationOnce(() => new Promise<InstanceLog[]>((done) => { resolve = done }))
    let pending!: Promise<void>
    act(() => { pending = h.result.current.loadInstanceLogs() })
    if (change === 'instance') {
      mockLogs = [{ ...action, instance_id: 'instance-2', details: { ...action.details, status: 'running' } }]
      h.rerender({ ...initialProps, activeRobotInstance: { id: 'instance-2', status: 'running' } })
    } else {
      h.rerender({ ...initialProps, waitingForMessageId: 'pending-456' })
    }
    await act(async () => { resolve([action]); await pending })
    expect(onResponseReceived).not.toHaveBeenCalled()
  })

  it('ignores an old completed action while the new send awaits its API log', async () => {
    const onResponseReceived = jest.fn()
    const h = renderHook(() => useInstanceLogs({ ...initialProps, onResponseReceived,
      waitingForMessageId: `pending-${Date.parse('2026-10-01T00:01:00Z')}`,
    }))
    await act(async () => { await h.result.current.loadInstanceLogs() })
    expect(onResponseReceived).not.toHaveBeenCalled()
  })

  it('recognizes a settled checkpoint for the current turn', async () => {
    const onResponseReceived = jest.fn()
    const h = renderHook(() => useInstanceLogs({ ...initialProps, onResponseReceived }))
    await act(async () => { await h.result.current.loadInstanceLogs() })
    expect(onResponseReceived).toHaveBeenCalled()
  })
})