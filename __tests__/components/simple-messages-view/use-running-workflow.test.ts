import { findRunningUserLog } from '@/app/components/simple-messages-view/hooks/useRunningWorkflow'
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
