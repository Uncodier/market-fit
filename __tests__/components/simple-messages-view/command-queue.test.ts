import {
  excludeQueuedUserLogs,
  shouldQueueCommand,
} from '@/app/components/simple-messages-view/hooks/command-queue'
import { InstanceLog } from '@/app/components/simple-messages-view/types'

function log(partial: Partial<InstanceLog> & Pick<InstanceLog, 'id' | 'log_type'>): InstanceLog {
  return {
    level: 'info',
    message: 'hello',
    created_at: '2026-09-05T00:00:00.000Z',
    ...partial,
  }
}

describe('command queue', () => {
  it('queues when a workflow is already busy', () => {
    expect(shouldQueueCommand(true)).toBe(true)
    expect(shouldQueueCommand(false)).toBe(false)
  })

  it('keeps leftover queued user actions out of the timeline', () => {
    const logs = [
      log({ id: '2', log_type: 'user_action', details: { status: 'queued' } }),
      log({ id: '1', log_type: 'user_action', details: { status: 'running' } }),
      log({ id: '3', log_type: 'agent_action' }),
    ]

    expect(excludeQueuedUserLogs(logs).map((item) => item.id)).toEqual(['1', '3'])
  })
})
