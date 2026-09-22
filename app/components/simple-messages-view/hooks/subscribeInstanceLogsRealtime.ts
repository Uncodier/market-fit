import { createClient } from '@/lib/supabase/client'
import { InstanceLog } from '../types'
import { markUserLogWorkflowStatus } from './send-message-reliability'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

type SetLogs = (updater: (prevLogs: InstanceLog[]) => InstanceLog[]) => void

export function isTerminalAgentResponse(log: InstanceLog): boolean {
  const hasMessage = (log.message?.trim().length || 0) > 0
  return (
    (
      log.log_type === 'agent_action'
      && log.details?.streaming !== true
      && hasMessage
    )
    || log.log_type === 'error'
  )
}

export function subscribeInstanceLogsRealtime(params: {
  instanceId: string
  currentRobotInstanceIdRef: MutableRefObject<string | null>
  waitingForMessageIdRef: MutableRefObject<string | null | undefined>
  onResponseReceivedRef: MutableRefObject<(() => void) | undefined>
  loadInstanceLogsRef: MutableRefObject<() => Promise<void>>
  setLogs: SetLogs
  setCollapsedSystemMessages: Dispatch<SetStateAction<Set<string>>>
  setCollapsedToolDetails: Dispatch<SetStateAction<Set<string>>>
}): () => void {
  const {
    instanceId,
    currentRobotInstanceIdRef,
    waitingForMessageIdRef,
    onResponseReceivedRef,
    loadInstanceLogsRef,
    setLogs,
    setCollapsedSystemMessages,
    setCollapsedToolDetails,
  } = params

  const supabase = createClient()
  let currentChannel: ReturnType<typeof supabase.channel> | null = null
  let visibilityTimeout: NodeJS.Timeout | null = null
  let retryCount = 0
  let retryTimeout: NodeJS.Timeout | null = null
  let disposed = false
  let channelStatus = 'CLOSED'

  const stopLatestRunningUserLog = () => {
    setLogs((prevLogs: InstanceLog[]) => {
      const running = [...prevLogs]
        .reverse()
        .find((log) => log.log_type === 'user_action' && log.details?.status === 'running')
      if (!running) return prevLogs
      void markUserLogWorkflowStatus({ logId: running.id, status: 'stopped' })
      return prevLogs.map((log) =>
        log.id === running.id
          ? { ...log, details: { ...(log.details || {}), status: 'stopped' } }
          : log
      )
    })
  }

  const onRealtimePayload = (payload: any) => {
    if (payload?.new?.instance_id && payload.new.instance_id !== currentRobotInstanceIdRef.current) return
    if (payload?.old?.instance_id && payload.old.instance_id !== currentRobotInstanceIdRef.current) return

    if (payload.eventType === 'INSERT') {
      const newLog = payload.new as InstanceLog
      if (newLog.log_type === 'user_action' && newLog.details?.status === 'queued') return

      setLogs((prevLogs: InstanceLog[]) => {
        if (newLog.log_type === 'user_action') {
          const tempMessageIndex = prevLogs.findIndex((log: InstanceLog) =>
            log.details?.temp_message &&
            log.message === newLog.message &&
            log.log_type === 'user_action'
          )

          if (tempMessageIndex !== -1) {
            const updatedLogs = [...prevLogs]
            updatedLogs[tempMessageIndex] = newLog
            return updatedLogs
          }
        }

        if (prevLogs.some((log: InstanceLog) => log.id === newLog.id)) return prevLogs
        return [...prevLogs, newLog]
      })

      const waitingId = waitingForMessageIdRef.current
      if (waitingId) {
        if (isTerminalAgentResponse(newLog)) {
          const timeDiff = new Date(newLog.created_at).getTime() - new Date().getTime()
          if (Math.abs(timeDiff) < 60000) onResponseReceivedRef.current?.()
        }
      }

      if (newLog.log_type === 'system' && (newLog.message?.length || 0) > 200) {
        setCollapsedSystemMessages((prev: Set<string>) => new Set(prev).add(newLog.id))
      }

      const hasToolName = newLog.tool_name || newLog.toolName
      const isToolCall = newLog.log_type === 'tool_call' || newLog.log_type === 'tool_result'
      const hasToolResult = newLog.tool_result && Object.keys(newLog.tool_result).length > 0
      const hasDetails = newLog.details && Object.keys(newLog.details).length > 0
      const hasScreenshot = newLog.screenshot_base64

      if ((hasToolName || isToolCall) && (hasToolResult || hasDetails || hasScreenshot)) {
        setCollapsedToolDetails((prev: Set<string>) => new Set(prev).add(newLog.id))
      }

      const isPlaceholderResponse = (newLog.message || '').includes('placeholder response')
      if (
        isTerminalAgentResponse(newLog) &&
        !isPlaceholderResponse
      ) {
        stopLatestRunningUserLog()
      }
    } else if (payload.eventType === 'UPDATE') {
      const updatedLog = payload.new as InstanceLog
      setLogs((prevLogs: InstanceLog[]) => prevLogs.map((log: InstanceLog) => log.id === updatedLog.id ? updatedLog : log))
      if (isTerminalAgentResponse(updatedLog)) {
        stopLatestRunningUserLog()
        onResponseReceivedRef.current?.()
      }
    } else if (payload.eventType === 'DELETE') {
      setLogs((prevLogs: InstanceLog[]) => prevLogs.filter((log: InstanceLog) => log.id !== payload.old.id))
    }
  }

  const handleRetry = () => {
    if (
      disposed ||
      document.visibilityState === 'hidden' ||
      !navigator.onLine ||
      channelStatus === 'SUBSCRIBED' ||
      channelStatus === 'SUBSCRIBING'
    ) return
    if (retryTimeout) clearTimeout(retryTimeout)
    const baseDelay = Math.min(1000 * Math.pow(2, retryCount), 30000)
    const delay = Math.round(baseDelay * (0.8 + Math.random() * 0.4))
    retryCount++
    retryTimeout = setTimeout(() => { subscribe() }, delay)
  }

  const subscribe = () => {
    if (disposed) return
    if (retryTimeout) {
      clearTimeout(retryTimeout)
      retryTimeout = null
    }
    if (currentChannel) {
      try { supabase.removeChannel(currentChannel) } catch { /* ignore */ }
    }

    channelStatus = 'SUBSCRIBING'
    const channelId = `instance_logs_${instanceId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const newChannel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'instance_logs',
          filter: `instance_id=eq.${instanceId}`
        },
        onRealtimePayload
      )

    currentChannel = newChannel

    newChannel.subscribe((status: string) => {
      if (disposed || currentChannel !== newChannel) return
      channelStatus = status
      if (status === 'SUBSCRIBED') {
        retryCount = 0
        if (retryTimeout) {
          clearTimeout(retryTimeout)
          retryTimeout = null
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        handleRetry()
      }
    })
  }

  subscribe()

  const handleVisibility = () => {
    if (!disposed && document.visibilityState === 'visible' && navigator.onLine) {
      if (visibilityTimeout) clearTimeout(visibilityTimeout)
      visibilityTimeout = setTimeout(() => {
        loadInstanceLogsRef.current()
        if (channelStatus !== 'SUBSCRIBED' && channelStatus !== 'SUBSCRIBING') {
          retryCount = 0
          subscribe()
        }
      }, 1000)
    }
  }

  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('online', handleVisibility)

  return () => {
    disposed = true
    if (retryTimeout) clearTimeout(retryTimeout)
    if (visibilityTimeout) clearTimeout(visibilityTimeout)
    document.removeEventListener('visibilitychange', handleVisibility)
    window.removeEventListener('online', handleVisibility)
    if (currentChannel) {
      try { supabase.removeChannel(currentChannel) } catch { /* ignore */ }
    }
    channelStatus = 'CLOSED'
  }
}
