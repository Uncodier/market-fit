import { useCallback, useState } from 'react'
import type { InstanceLog } from '../types'
import { createRequestId, USER_ACTION_DEDUPE_WINDOW_MS } from './send-message-reliability'

export function matchesOptimisticUserMessage(optimistic: InstanceLog, persisted: InstanceLog): boolean {
  if (!optimistic.details?.temp_message || persisted.details?.temp_message
    || optimistic.log_type !== 'user_action' || persisted.log_type !== 'user_action'
    || optimistic.instance_id !== persisted.instance_id) return false

  const requestId = optimistic.details?.request_id
  if (requestId) return requestId === persisted.details?.request_id

  // Legacy robot sends do not share a request ID with their local preview.
  return optimistic.message === persisted.message
    && Math.abs(Date.parse(optimistic.created_at) - Date.parse(persisted.created_at)) <= USER_ACTION_DEDUPE_WINDOW_MS
}

export function useOptimisticUserMessages(persistedLogs: InstanceLog[], instanceId?: string, siteId?: string | null) {
  // Keep previews separate from SWR so a refresh cannot erase an in-flight send.
  const [optimisticLogs, setOptimisticLogs] = useState<InstanceLog[]>([])

  const remaining = optimisticLogs.filter(log => !persistedLogs.some(saved => matchesOptimisticUserMessage(log, saved)))
  // Retire confirmed previews permanently, including when later pages no longer
  // contain the durable row. The length guard makes this render adjustment finite.
  if (remaining.length !== optimisticLogs.length) setOptimisticLogs(remaining)

  const addOptimisticUserMessage = useCallback((message: string, extraDetails?: Record<string, unknown>) => {
    if (!instanceId) return
    const log: InstanceLog = {
      id: typeof extraDetails?.id === 'string' ? extraDetails.id : `optimistic-${createRequestId()}`,
      instance_id: instanceId,
      site_id: siteId || undefined,
      log_type: 'user_action',
      level: 'info',
      message,
      created_at: new Date().toISOString(),
      details: { status: 'sending', ...extraDetails, temp_message: true },
    }
    setOptimisticLogs(current => [...current, log])
    // Capture this preview's ID: a late rejection must not remove a newer turn
    // or a durable row delivered through Realtime in the meantime.
    return () => setOptimisticLogs(current => current.filter(item => item.id !== log.id))
  }, [instanceId, siteId])

  const previews = remaining.filter(log => log.instance_id === instanceId
    && log.site_id === (siteId || undefined))

  return {
    logs: [...persistedLogs, ...previews].sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at)),
    addOptimisticUserMessage,
  }
}