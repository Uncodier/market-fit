import { useEffect, type MutableRefObject } from 'react'
import type { InstanceLog } from '../types'
import { fetchLiveInstanceLogs } from './fetch-live-instance-logs'
import { markUserLogWorkflowStatus } from './send-message-reliability'
import { isTerminalAgentResponse } from './subscribeInstanceLogsRealtime'

type SetLogs = (updater: (current: InstanceLog[]) => InstanceLog[]) => void

interface UseLiveInstanceLogsOptions {
  instanceId?: string
  instanceStatus?: string
  waitingForMessageId?: string | null
  logs: InstanceLog[]
  setLogs: SetLogs
  mutate: () => Promise<InstanceLog[] | undefined>
  onResponseReceivedRef: MutableRefObject<(() => void) | undefined>
}

export function useLiveInstanceLogs({
  instanceId,
  instanceStatus,
  waitingForMessageId,
  logs,
  setLogs,
  mutate,
  onResponseReceivedRef,
}: UseLiveInstanceLogsOptions): void {
  const hasInFlightLog = logs.some(
    (log) =>
      log.details?.streaming === true
      || (log.log_type === 'user_action' && log.details?.status === 'running'),
  )
  const shouldTrackExecution =
    Boolean(waitingForMessageId)
    || hasInFlightLog
    || ['starting', 'pending', 'initializing', 'running'].includes(
      instanceStatus || '',
    )

  useEffect(() => {
    if (!instanceId || !shouldTrackExecution) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let retryDelay = 2000

    const poll = async () => {
      try {
        if (document.visibilityState === 'hidden' || !navigator.onLine) {
          retryDelay = 4000
          return
        }
        const liveLogs = await fetchLiveInstanceLogs(instanceId)
        retryDelay = liveLogs.length > 0 ? 1500 : 3000
        if (!disposed && liveLogs.length > 0) {
          setLogs((current) => {
            const byId = new Map(current.map((log) => [log.id, log]))
            for (const liveLog of liveLogs) {
              const existing = byId.get(liveLog.id)
              byId.set(
                liveLog.id,
                existing ? { ...existing, message: liveLog.message } : liveLog,
              )
            }
            return Array.from(byId.values()).sort(
              (a, b) =>
                new Date(a.created_at || 0).getTime()
                - new Date(b.created_at || 0).getTime(),
            )
          })
        }
      } catch {
        retryDelay = Math.min(Math.max(retryDelay * 2, 4000), 15000)
      } finally {
        if (!disposed) timer = setTimeout(poll, retryDelay)
      }
    }

    void poll()
    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
    }
  }, [instanceId, shouldTrackExecution, setLogs])

  useEffect(() => {
    if (!instanceId || !shouldTrackExecution) return
    let disposed = false
    let inFlight = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      if (!disposed) timer = setTimeout(run, 4000)
    }
    const run = async () => {
      if (
        disposed
        || inFlight
        || document.visibilityState === 'hidden'
        || !navigator.onLine
      ) {
        schedule()
        return
      }
      inFlight = true
      try {
        const reconciled = await mutate()
        if (disposed) return
        const latest = reconciled?.[reconciled.length - 1]
        if (latest && isTerminalAgentResponse(latest)) {
          setLogs((current) => stopLatestRunningUserLog(current))
          onResponseReceivedRef.current?.()
        }
      } finally {
        inFlight = false
        schedule()
      }
    }
    const resume = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        if (timer) clearTimeout(timer)
        void run()
      }
    }

    schedule()
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('online', resume)
    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('online', resume)
    }
  }, [
    instanceId,
    shouldTrackExecution,
    mutate,
    onResponseReceivedRef,
    setLogs,
  ])
}

function stopLatestRunningUserLog(logs: InstanceLog[]): InstanceLog[] {
  const running = [...logs]
    .reverse()
    .find(
      (log) =>
        log.log_type === 'user_action' && log.details?.status === 'running',
    )
  if (!running) return logs
  void markUserLogWorkflowStatus({ logId: running.id, status: 'stopped' })
  return logs.map((log) =>
    log.id === running.id
      ? { ...log, details: { ...(log.details || {}), status: 'stopped' } }
      : log,
  )
}
