import { useCallback, useMemo, useState } from 'react'
import { InstanceLog } from '../types'

type ToastFn = (opts: { title: string; description: string; variant?: 'default' | 'destructive' }) => void

export function findRunningUserLog(logs: InstanceLog[]): InstanceLog | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i]
    if (log.log_type === 'user_action' && log.details?.status === 'running') {
      return log
    }
  }
  return null
}

export function useRunningWorkflow(params: {
  logs: InstanceLog[]
  instanceId?: string
  patchLogDetails: (logId: string, patch: Record<string, unknown>) => void
  toast: ToastFn
}) {
  const { logs, instanceId, patchLogDetails, toast } = params
  const [isCancelling, setIsCancelling] = useState(false)

  const runningUserLog = useMemo(() => findRunningUserLog(logs), [logs])

  const cancelWorkflow = useCallback(async (logId: string) => {
    if (!instanceId) return
    setIsCancelling(true)
    patchLogDetails(logId, { status: 'cancelled' })

    try {
      const response = await fetch('/api/robots/instance/assistant/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_log_id: logId,
          instance_id: instanceId,
        }),
      })

      const res = await response.json().catch(() => null)
      const cancelledLogId = res?.data?.cancelled_log_id

      if (response.ok && res?.success) {
        if (cancelledLogId && cancelledLogId !== logId) {
          patchLogDetails(cancelledLogId, { status: 'cancelled' })
        }
        toast({ title: 'Cancelled', description: 'The workflow has been stopped.' })
        return
      }

      patchLogDetails(logId, { status: 'running' })
      toast({
        title: 'Error',
        description: res?.error?.message || 'Failed to stop the workflow',
        variant: 'destructive',
      })
    } catch {
      patchLogDetails(logId, { status: 'running' })
      toast({ title: 'Error', description: 'Failed to stop the workflow', variant: 'destructive' })
    } finally {
      setIsCancelling(false)
    }
  }, [instanceId, logs, patchLogDetails, toast])

  return { runningUserLog, cancelWorkflow, isCancelling }
}
