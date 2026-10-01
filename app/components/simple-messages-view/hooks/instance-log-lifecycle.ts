import type { InstanceLog } from '../types'

const PERSISTED_LOG_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SETTLED_STATUSES = new Set(['completed', 'failed', 'paused', 'cancelled', 'stopped'])

export function latestUserAction(logs: InstanceLog[]): InstanceLog | undefined {
  return logs.reduce<InstanceLog | undefined>((latest, log) => {
    if (log.log_type !== 'user_action' || log.details?.status === 'queued') return latest
    if (!latest) return log
    const delta = Date.parse(log.created_at) - Date.parse(latest.created_at)
    return delta > 0 || (delta === 0 && log.id > latest.id) ? log : latest
  }, undefined)
}

export function isServerManagedUserAction(log: InstanceLog): boolean {
  const source = log.details?.prompt_source
  return Object.prototype.hasOwnProperty.call(log.details || {}, 'assistant_recovery')
    || (source != null && source !== 'frontend')
}

export function isSettledUserAction(log: InstanceLog): boolean {
  return log.log_type === 'user_action' && SETTLED_STATUSES.has(log.details?.status)
}

/** Pending IDs identify the local send start until its API-owned log arrives. */
export function isActionForWaitingTurn(action: InstanceLog, waitingId?: string | null): boolean {
  if (!waitingId) return false
  const pending = /^pending-(\d+)$/.exec(waitingId)
  if (pending) return Date.parse(action.created_at) >= Number(pending[1])
  return waitingId === action.id || waitingId === action.details?.request_id
}

/** A final-looking legacy response, not proof that a durable workflow finished. */
export function isTerminalAgentResponse(log: InstanceLog): boolean {
  if (log.details?.streaming != null && log.details.streaming !== false) return false
  if (log.tool_name || log.toolName) return false
  if (log.details?.total_tool_calls != null && log.details.total_tool_calls !== 0) return false
  if (log.details?.plan_id || log.details?.step_id) return false
  if (log.log_type === 'error') return !log.parent_log_id
  if (log.log_type !== 'agent_action') return false

  const message = log.message?.trim() || ''
  if (!message || message === 'Assistant step execution' || message.includes('placeholder response')) return false

  const responseType = log.details?.response_type
  // A stream-final UPDATE precedes onStep and has no tool count yet.
  if (responseType === 'assistant_step') return log.details?.total_tool_calls === 0
  return responseType == null || responseType === 'assistant_response'
}

export function responseBelongsToAction(response: InstanceLog, action: InstanceLog): boolean {
  if (!action.instance_id || response.instance_id !== action.instance_id) return false
  if (response.site_id && action.site_id && response.site_id !== action.site_id) return false
  const responseTime = Date.parse(response.created_at)
  const actionTime = Date.parse(action.created_at)
  if (!Number.isFinite(responseTime) || !Number.isFinite(actionTime) || responseTime < actionTime) return false

  const requestId = response.details?.request_id
  if (requestId != null && requestId !== action.details?.request_id) return false
  for (const key of ['user_log_id', 'user_message_log_id']) {
    if (response.details?.[key] != null && response.details[key] !== action.id) return false
  }
  return true
}

export function canAutoStopUserAction(action: InstanceLog, response: InstanceLog): boolean {
  return action.log_type === 'user_action'
    && action.details?.status === 'running'
    && PERSISTED_LOG_ID.test(action.id)
    && !action.details?.temp_message
    && !isServerManagedUserAction(action)
    && isTerminalAgentResponse(response)
    && responseBelongsToAction(response, action)
}

/** Used by polling as well as Realtime; observing a response must not cancel work. */
export function hasFinishedLatestUserAction(logs: InstanceLog[]): boolean {
  const action = latestUserAction(logs)
  if (!action) return false
  if (isSettledUserAction(action)) return true
  if (isServerManagedUserAction(action)) return false
  const response = logs[logs.length - 1]
  return Boolean(response && canAutoStopUserAction(action, response))
}