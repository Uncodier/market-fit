import { useEffect } from 'react'
import type { InstanceLog } from '../types'
import { fetchLiveInstanceLogs } from './fetch-live-instance-logs'

type SetLogs = (updater: (current: InstanceLog[]) => InstanceLog[]) => void

interface UseLiveInstanceLogsOptions {
  instanceId?: string
  instanceStatus?: string
  waitingForMessageId?: string | null
  logs: InstanceLog[]
  setLogs: SetLogs
}

export function useLiveInstanceLogs({
  instanceId,
  instanceStatus,
  waitingForMessageId,
  logs,
  setLogs,
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
}
