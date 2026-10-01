import { act, renderHook } from '@testing-library/react'
import { findRunningUserLog, useRunningWorkflow } from '@/app/components/simple-messages-view/hooks/useRunningWorkflow'
import { InstanceLog } from '@/app/components/simple-messages-view/types'

function log(partial: Partial<InstanceLog> & Pick<InstanceLog, 'id' | 'log_type'>): InstanceLog {
  return {
    level: 'info',
    message: 'hello',
    created_at: '2026-09-05T00:00:00.000Z',
    ...partial,
  }
}

describe('findRunningUserLog', () => {
  it('returns the latest running user action', () => {
    const logs = [
      log({ id: '1', log_type: 'user_action', details: { status: 'stopped' } }),
      log({ id: '2', log_type: 'agent_action' }),
      log({ id: '3', log_type: 'user_action', details: { status: 'running', request_type: 'ask' } }),
    ]

    expect(findRunningUserLog(logs)?.id).toBe('3')
  })

  it('returns null when nothing is running', () => {
    const logs = [
      log({ id: '1', log_type: 'user_action', details: { status: 'cancelled' } }),
    ]

    expect(findRunningUserLog(logs)).toBeNull()
  })
})

describe('explicit Stop', () => {
  afterEach(() => { jest.clearAllMocks() })

  it('still sends cancellation for a server-managed action', async () => {
    const patchLogDetails = jest.fn()
    const toast = jest.fn()
    jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({
      success: true, data: { cancelled_log_id: 'action-1' },
    }) } as Response)
    const { result } = renderHook(() => useRunningWorkflow({
      instanceId: 'instance-1', patchLogDetails, toast,
      logs: [log({ id: 'action-1', log_type: 'user_action', details: {
        status: 'running', prompt_source: 'assistant_route', assistant_recovery: { inFlight: true },
      } })],
    }))
    await act(async () => { await result.current.cancelWorkflow('action-1') })
    expect(fetch).toHaveBeenCalledWith('/api/robots/instance/assistant/cancel', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ user_log_id: 'action-1', instance_id: 'instance-1' }),
    }))
    expect(patchLogDetails).toHaveBeenCalledWith('action-1', { status: 'cancelled' })
    expect(result.current.isCancelling).toBe(false)
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cancelled' }))
  })

  it('restores running state when explicit cancellation is rejected', async () => {
    const patchLogDetails = jest.fn()
    jest.mocked(fetch).mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) } as Response)
    const { result } = renderHook(() => useRunningWorkflow({
      instanceId: 'instance-1', logs: [], patchLogDetails, toast: jest.fn(),
    }))
    await act(async () => { await result.current.cancelWorkflow('action-1') })
    expect(patchLogDetails).toHaveBeenNthCalledWith(1, 'action-1', { status: 'cancelled' })
    expect(patchLogDetails).toHaveBeenNthCalledWith(2, 'action-1', { status: 'running' })
  })
})
