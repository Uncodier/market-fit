import { InstanceLog } from '../types'

export function isQueuedUserLog(log: InstanceLog): boolean {
  return log.log_type === 'user_action' && log.details?.status === 'queued'
}

export function excludeQueuedUserLogs<T extends InstanceLog>(logs: T[]): T[] {
  return logs.filter((log) => !isQueuedUserLog(log))
}

export function shouldQueueCommand(isWorkflowBusy: boolean): boolean {
  return isWorkflowBusy
}
