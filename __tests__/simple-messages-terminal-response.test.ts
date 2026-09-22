import { isTerminalAgentResponse } from '@/app/components/simple-messages-view/hooks/subscribeInstanceLogsRealtime'
import type { InstanceLog } from '@/app/components/simple-messages-view/types'

function log(
  logType: InstanceLog['log_type'],
  details: Record<string, unknown> = {},
): InstanceLog {
  return {
    id: 'log-1',
    instance_id: 'instance-1',
    log_type: logType,
    level: 'info',
    message: 'Content',
    details,
    created_at: new Date().toISOString(),
  }
}

describe('terminal assistant response detection', () => {
  it('keeps polling through streaming and tool activity', () => {
    expect(isTerminalAgentResponse(log('agent_action', { streaming: true })))
      .toBe(false)
    expect(isTerminalAgentResponse(log('tool_result'))).toBe(false)
    expect(isTerminalAgentResponse(log('system'))).toBe(false)
  })

  it('stops only for a final assistant response or error', () => {
    expect(isTerminalAgentResponse(log('agent_action'))).toBe(true)
    expect(isTerminalAgentResponse(log('error'))).toBe(true)
  })
})
