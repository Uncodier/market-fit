import { useCallback, useState } from 'react'
import type { InstanceLog } from '../types'
import { createRequestId, USER_ACTION_DEDUPE_WINDOW_MS } from './send-message-reliability'

export function matchesOptimisticUserMessage(optimistic: InstanceLog, persisted: InstanceLog): boolean {
  if (!optimistic.details?.temp_message || persisted.details?.temp_message
    || optimistic.log_type !== 'user_action' || persisted.log_type !== 'user_action'
    || optimistic.instance_id !== persisted.instance_id
    || (optimistic.site_id && persisted.site_id && optimistic.site_id !== persisted.site_id)) return false

  const requestId = optimistic.details?.request_id
  if (requestId) return requestId === persisted.details?.request_id

  // Legacy robot sends do not share a request ID with their local preview.
  return optimistic.message === persisted.message
    && Math.abs(Date.parse(optimistic.created_at) - Date.parse(persisted.created_at)) <= USER_ACTION_DEDUPE_WINDOW_MS
}

export function useOptimisticUserMessages(persistedLogs: InstanceLog[], instanceId?: string, siteId?: string | null) {
  // Keep previews separate from SWR so a refresh cannot erase an in-flight send.
  const [state, setState] = useState(() => ({
    previews: [] as InstanceLog[],
    messages: new Map<string, string>(),
  }))
  const optimisticLogs = state.previews
  const scopedPreviews = optimisticLogs.filter(log => log.instance_id === instanceId
    && log.site_id === (siteId || undefined))
  const messages = new Map<string, string>()
  const visibleLogs = persistedLogs.map(log => {
    if (log.log_type !== 'user_action') return log
    const key = JSON.stringify([siteId, instanceId, log.site_id ?? siteId, log.instance_id ?? instanceId, log.id])
    // Confirmation owns identity and status, but an incomplete payload must not
    // erase text already displayed. Never copy optimistic lifecycle metadata.
    const message = typeof log.message === 'string' && log.message.trim()
      ? log.message
      : state.messages.get(key) ?? scopedPreviews.find(preview => matchesOptimisticUserMessage(preview, log))?.message
    if (message === undefined) return log
    messages.set(key, message)
    return message === log.message ? log : { ...log, message }
  })

  const remaining = optimisticLogs.filter(log => !persistedLogs.some(saved => matchesOptimisticUserMessage(log, saved)))
  // Retire previews while retaining text only for rows still present in this
  // scope/page. A removed row cannot reappear from the local content cache.
  const messagesChanged = messages.size !== state.messages.size
    || Array.from(messages).some(([key, message]) => state.messages.get(key) !== message)
  if (remaining.length !== optimisticLogs.length || messagesChanged) {
    setState({ previews: remaining, messages })
  }

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
    setState(current => ({ ...current, previews: [...current.previews, log] }))
    // Capture this preview's ID: a late rejection must not remove a newer turn
    // or a durable row delivered through Realtime in the meantime.
    return () => setState(current => ({ ...current, previews: current.previews.filter(item => item.id !== log.id) }))
  }, [instanceId, siteId])

  const previews = remaining.filter(log => log.instance_id === instanceId
    && log.site_id === (siteId || undefined))

  return {
    logs: [...visibleLogs, ...previews].sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at)),
    addOptimisticUserMessage,
  }
}