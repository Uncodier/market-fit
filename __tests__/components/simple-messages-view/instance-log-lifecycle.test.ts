import {
  canAutoStopUserAction, hasFinishedLatestUserAction, isTerminalAgentResponse,
  latestUserAction,
} from '@/app/components/simple-messages-view/hooks/instance-log-lifecycle'
import type { InstanceLog } from '@/app/components/simple-messages-view/types'

const action: InstanceLog = {
  id: '11111111-1111-4111-8111-111111111111', instance_id: 'instance-1',
  log_type: 'user_action', level: 'info', message: 'Continue',
  created_at: '2026-10-01T00:00:00Z', details: { status: 'running', prompt_source: 'frontend', request_id: 'request-1' },
}
const response: InstanceLog = {
  id: 'response-1', instance_id: 'instance-1', log_type: 'agent_action', level: 'info',
  message: 'Done', created_at: '2026-10-01T00:00:01Z',
  details: { response_type: 'assistant_step', total_tool_calls: 0 },
}

describe('automatic completion eligibility', () => {
  it.each([
    { message: 'Assistant step execution', details: { response_type: 'assistant_step', total_tool_calls: 1 } },
    { message: 'I will look that up', details: { response_type: 'assistant_step', total_tool_calls: 1 } },
    { message: 'A placeholder response' },
    { details: { response_type: 'assistant_step', streaming: false } },
    { details: { response_type: 'assistant_step', streaming: true, total_tool_calls: 0 } },
    { details: { response_type: 'reasoning' } },
    { details: { response_type: 'assistant_step', total_tool_calls: '0' } },
    { details: { response_type: 'assistant_step', total_tool_calls: 0, plan_id: 'plan-1' } },
    { log_type: 'tool_call', tool_name: 'skill_lookup', tool_result: { success: true } },
    { log_type: 'tool_result', tool_result: { success: false } },
    { log_type: 'error', parent_log_id: 'step-1' },
  ] satisfies Partial<InstanceLog>[])('does not finish for intermediate event %j', (patch) => {
    const event = { ...response, ...patch }
    expect(isTerminalAgentResponse(event)).toBe(false)
    expect(canAutoStopUserAction(action, event)).toBe(false)
  })

  it.each([
    {}, { response_type: 'assistant_response' }, { response_type: 'assistant_step', total_tool_calls: 0 },
  ])('preserves legacy final replies with details %j', (details) => {
    expect(canAutoStopUserAction(action, { ...response, details })).toBe(true)
  })

  it('preserves standalone legacy terminal errors', () => {
    expect(canAutoStopUserAction(action, { ...response, log_type: 'error', details: {} })).toBe(true)
  })

  it.each([
    { prompt_source: 'assistant_route' }, { prompt_source: 'assistant_workflow' },
    { prompt_source: 'pending_work' }, { assistant_recovery: {} }, { assistant_recovery: null },
    { status: 'cancelled' }, { status: 'completed' }, { status: 'paused' }, { temp_message: true },
  ])('does not automatically stop action with %j', (details) => {
    expect(canAutoStopUserAction({ ...action, details: { ...action.details, ...details } }, response)).toBe(false)
  })

  it.each([
    { instance_id: 'other-instance' }, { created_at: '2026-09-30T00:00:00Z' },
    { details: { request_id: 'other-request' } }, { details: { user_log_id: 'other-action' } },
    { details: { user_message_log_id: 'other-action' } },
  ])('rejects stale or unrelated event %j', (patch) => {
    expect(canAutoStopUserAction(action, { ...response, ...patch })).toBe(false)
  })

  it('does not persist optimistic IDs', () => {
    expect(canAutoStopUserAction({ ...action, id: 'optimistic-123' }, response)).toBe(false)
  })

  it('does not make a delayed older INSERT the active action', () => {
    const newer = { ...action, id: '22222222-2222-4222-8222-222222222222', created_at: '2026-10-01T00:02:00Z' }
    expect(latestUserAction([newer, action])).toBe(newer)
    expect(latestUserAction([action, { ...newer, details: { status: 'queued' } }])).toBe(action)
  })

  it('polling waits for the managed action status, not even final model text', () => {
    const managed = { ...action, details: { ...action.details, prompt_source: 'assistant_route' } }
    expect(hasFinishedLatestUserAction([managed, response])).toBe(false)
    expect(hasFinishedLatestUserAction([{ ...managed, details: { ...managed.details, status: 'completed' } }, response])).toBe(true)
    expect(hasFinishedLatestUserAction([action, response])).toBe(true)
  })
})