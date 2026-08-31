import { createClient } from '@/lib/supabase/client'
import { InstanceLog } from '../types'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

type SetLogs = (updater: (prevLogs: InstanceLog[]) => InstanceLog[]) => void

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

  const onRealtimePayload = (payload: any) => {
    if (payload?.new?.instance_id && payload.new.instance_id !== currentRobotInstanceIdRef.current) return
    if (payload?.old?.instance_id && payload.old.instance_id !== currentRobotInstanceIdRef.current) return

    if (payload.eventType === 'INSERT') {
      const newLog = payload.new as InstanceLog

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
        const isResponseToOurMessage = (
          (newLog.log_type === 'agent_action') ||
          (newLog.log_type === 'tool_result') ||
          (newLog.log_type === 'system' && (
            (newLog.message || '').toLowerCase().includes('processing') ||
            (newLog.message || '').toLowerCase().includes('received') ||
            (newLog.message || '').toLowerCase().includes('completed') ||
            (newLog.message || '').toLowerCase().includes('response') ||
            (newLog.message || '').toLowerCase().includes('answer')
          )) ||
          (newLog.log_type === 'system' && (newLog.message?.length || 0) > 10) ||
          (newLog.log_type !== 'user_action' && (newLog.message?.length || 0) > 5)
        )

        if (isResponseToOurMessage) {
          const timeDiff = new Date(newLog.created_at).getTime() - new Date().getTime()
          if (Math.abs(timeDiff) < 60000) onResponseReceivedRef.current?.()
        }
      } else if (newLog.log_type !== 'user_action' && (newLog.message?.length || 0) > 5) {
        onResponseReceivedRef.current?.()
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
    } else if (payload.eventType === 'UPDATE') {
      setLogs((prevLogs: InstanceLog[]) => prevLogs.map((log: InstanceLog) => log.id === payload.new.id ? payload.new as InstanceLog : log))
    } else if (payload.eventType === 'DELETE') {
      setLogs((prevLogs: InstanceLog[]) => prevLogs.filter((log: InstanceLog) => log.id !== payload.old.id))
    }
  }

  const handleRetry = () => {
    if (retryTimeout) clearTimeout(retryTimeout)
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
    retryCount++
    retryTimeout = setTimeout(() => { subscribe() }, delay)
  }

  const subscribe = () => {
    if (currentChannel) {
      try { supabase.removeChannel(currentChannel) } catch { /* ignore */ }
    }

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
      if (currentChannel !== newChannel) return
      if (status === 'SUBSCRIBED') {
        retryCount = 0
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        handleRetry()
      }
    })
  }

  subscribe()

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      if (visibilityTimeout) clearTimeout(visibilityTimeout)
      visibilityTimeout = setTimeout(() => {
        loadInstanceLogsRef.current()
        retryCount = 0
        subscribe()
      }, 1000)
    }
  }

  document.addEventListener('visibilitychange', handleVisibility)

  return () => {
    if (retryTimeout) clearTimeout(retryTimeout)
    if (visibilityTimeout) clearTimeout(visibilityTimeout)
    document.removeEventListener('visibilitychange', handleVisibility)
    if (currentChannel) {
      try { supabase.removeChannel(currentChannel) } catch { /* ignore */ }
    }
  }
}
