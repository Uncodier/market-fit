import {
  getProcessActivity,
  getProcessHeader,
  groupTimelineProcess,
  isProcessLog,
  splitProcessAnswer,
} from '@/app/components/simple-messages-view/group-timeline-process'
import { InstanceLog } from '@/app/components/simple-messages-view/types'

function log(partial: Partial<InstanceLog> & Pick<InstanceLog, 'id' | 'log_type'>): InstanceLog {
  return {
    level: 'info',
    message: '',
    created_at: '2026-09-05T00:00:00.000Z',
    ...partial,
  }
}

describe('isProcessLog', () => {
  it('includes thinking, agent actions, tools, steps, and infrastructure', () => {
    expect(isProcessLog(log({ id: '1', log_type: 'thinking' }))).toBe(true)
    expect(isProcessLog(log({ id: '2', log_type: 'agent_action' }))).toBe(true)
    expect(isProcessLog(log({ id: '3', log_type: 'tool_call', tool_name: 'instance_plan' }))).toBe(true)
    expect(isProcessLog(log({ id: '4', log_type: 'infrastructure' }))).toBe(true)
    expect(isProcessLog(log({
      id: '5',
      log_type: 'tool_result',
      tool_name: 'structured_output',
      message: 'event=step_completed step=2 assistant_message=ok',
    }))).toBe(true)
  })

  it('excludes user messages and special tools', () => {
    expect(isProcessLog(log({ id: '1', log_type: 'user_action' }))).toBe(false)
    expect(isProcessLog(log({ id: '2', log_type: 'tool_call', tool_name: 'show_artifact' }))).toBe(false)
    expect(isProcessLog(log({ id: '3', log_type: 'tool_result', tool_name: 'structured_output', message: 'other' }))).toBe(false)
  })
})

describe('getProcessActivity', () => {
  it('labels thinking and empty streaming as Thinking', () => {
    expect(getProcessActivity(log({ id: '1', log_type: 'thinking' })).label).toBe('Thinking')
    expect(
      getProcessActivity(log({ id: '2', log_type: 'agent_action', details: { streaming: true } })).label
    ).toBe('Thinking')
  })

  it('labels tool calls, steps, infrastructure, and finished replies', () => {
    expect(
      getProcessActivity(log({ id: '1', log_type: 'tool_call', tool_name: 'instance_plan' })).label
    ).toBe('Tool call: Instance Plan')
    expect(
      getProcessActivity(log({ id: '2', log_type: 'agent_action', message: 'Here is the answer' })).label
    ).toBe('Responding')
    expect(
      getProcessActivity(log({
        id: '3',
        log_type: 'infrastructure',
        details: { event: 'cron_infra_sandbox_vm_created' },
      })).label
    ).toBe('Infrastructure: Sandbox')
    expect(
      getProcessActivity(log({
        id: '4',
        log_type: 'tool_result',
        tool_name: 'structured_output',
        message: 'event=step_completed step=3 assistant_message=done',
      })).label
    ).toBe('Step 3 completed')
  })
})

describe('getProcessHeader', () => {
  it('uses the live activity label while running', () => {
    const entries = [
      { type: 'log' as const, timestamp: '1', data: log({ id: 't', log_type: 'thinking', message: 'hmm' }) },
      { type: 'log' as const, timestamp: '2', data: log({ id: 'i', log_type: 'infrastructure', details: { event: 'cron_infra_commit_push' } }) },
    ]
    expect(getProcessHeader(entries, true).label).toBe('Infrastructure: Push')
  })

  it('uses the count when finished instead of the last label', () => {
    const entries = [
      { type: 'log' as const, timestamp: '1', data: log({ id: 't', log_type: 'thinking', message: 'hmm' }) },
      { type: 'log' as const, timestamp: '2', data: log({ id: 'i', log_type: 'infrastructure', details: { event: 'cron_infra_commit_push' } }) },
    ]
    expect(getProcessHeader(entries, false).label).toBe('2 steps')
  })

  it('adds thought, worked, and operated times when finished', () => {
    const entries = [
      {
        type: 'log' as const,
        timestamp: '2026-09-05T00:00:00.000Z',
        data: log({
          id: 't',
          log_type: 'thinking',
          message: 'hmm',
          created_at: '2026-09-05T00:00:00.000Z',
        }),
      },
      {
        type: 'log' as const,
        timestamp: '2026-09-05T00:00:04.000Z',
        data: log({
          id: 's',
          log_type: 'tool_result',
          tool_name: 'structured_output',
          message: 'event=step_completed step=1 assistant_message=ok',
          created_at: '2026-09-05T00:00:04.000Z',
        }),
      },
      {
        type: 'log' as const,
        timestamp: '2026-09-05T00:00:10.000Z',
        data: log({
          id: 'i',
          log_type: 'infrastructure',
          details: { event: 'cron_infra_commit_push' },
          created_at: '2026-09-05T00:00:10.000Z',
        }),
      },
    ]
    expect(getProcessHeader(entries, false, '2026-09-05T00:00:18.000Z').label).toBe(
      '3 steps · Thought 4s · Worked 6s · Operated 8s'
    )
  })

  it('ignores stale plan timestamps so Worked does not explode', () => {
    const entries = [
      {
        type: 'completed_plan' as const,
        timestamp: '2026-07-09T00:00:00.000Z',
        data: {
          id: 'plan-old',
          title: 'Old plan',
          status: 'in_progress',
          created_at: '2026-07-09T00:00:00.000Z',
        },
      },
      {
        type: 'log' as const,
        timestamp: '2026-09-05T00:00:00.000Z',
        data: log({
          id: 'i',
          log_type: 'infrastructure',
          details: { event: 'cron_infra_commit_push' },
          created_at: '2026-09-05T00:00:00.000Z',
        }),
      },
    ]
    expect(getProcessHeader(entries, false, '2026-09-05T00:00:48.000Z').label).toBe(
      '2 steps · Operated 48s'
    )
  })
})

describe('splitProcessAnswer', () => {
  it('keeps the last agent reply visible and the rest collapsed', () => {
    const logs = [
      log({ id: 't', log_type: 'thinking', message: 'reason' }),
      log({ id: 'c', log_type: 'tool_call', tool_name: 'webSearch' }),
      log({ id: 'a', log_type: 'agent_action', message: 'Done' }),
    ]
    const { processLogs, answer } = splitProcessAnswer(logs)
    expect(answer?.id).toBe('a')
    expect(processLogs.map((item) => item.id)).toEqual(['t', 'c'])
  })
})

describe('groupTimelineProcess', () => {
  it('groups consecutive thinking, tools, and agent actions', () => {
    const timeline = [
      { type: 'log', timestamp: '1', data: log({ id: 'u', log_type: 'user_action', message: 'hi' }) },
      { type: 'log', timestamp: '2', data: log({ id: 't', log_type: 'thinking', message: 'hmm' }) },
      { type: 'log', timestamp: '3', data: log({ id: 'c', log_type: 'tool_call', tool_name: 'tools' }) },
      { type: 'log', timestamp: '4', data: log({ id: 'a', log_type: 'agent_action', message: 'ok' }) },
    ]

    const grouped = groupTimelineProcess(timeline)
    expect(grouped).toHaveLength(2)
    expect(grouped[0].type).toBe('log')
    expect(grouped[1].type).toBe('process_group')
    expect(grouped[1].data.entries.map((item: { data: InstanceLog }) => item.data.id)).toEqual(['t', 'c', 'a'])
  })

  it('groups steps, infrastructure, and plans with the process stream', () => {
    const timeline = [
      { type: 'log', timestamp: '1', data: log({ id: 't', log_type: 'thinking', message: 'hmm' }) },
      { type: 'completed_plan', timestamp: '2', data: { id: 'plan-1', title: 'Ship checkout', status: 'in_progress' } },
      { type: 'log', timestamp: '3', data: log({
        id: 'i',
        log_type: 'infrastructure',
        details: { event: 'cron_infra_commit_push' },
      }) },
    ]

    const grouped = groupTimelineProcess(timeline)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].type).toBe('process_group')
    expect(grouped[0].data.entries).toHaveLength(3)
  })

  it('breaks the group around user messages', () => {
    const timeline = [
      { type: 'log', timestamp: '1', data: log({ id: 'a1', log_type: 'agent_action', message: 'one' }) },
      { type: 'log', timestamp: '2', data: log({ id: 'u', log_type: 'user_action', message: 'again' }) },
      { type: 'log', timestamp: '3', data: log({ id: 'a2', log_type: 'agent_action', message: 'two' }) },
    ]

    const grouped = groupTimelineProcess(timeline)
    expect(grouped.map((item) => item.type)).toEqual(['process_group', 'log', 'process_group'])
  })
})
