import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/ui/use-toast'
import {
  cancelPendingWork,
  sendPendingWorkNow,
  updatePendingWork,
  type PendingWorkRow,
} from './pending-work'

export function usePendingWork(instanceId?: string) {
  const { toast } = useToast()
  const [items, setItems] = useState<PendingWorkRow[]>([])
  const [sendingId, setSendingId] = useState<string | null>(null)

  const loadPendingWork = useCallback(async () => {
    if (!instanceId) {
      setItems([])
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('instance_pending_work')
      .select('id, instance_id, site_id, user_id, message, activity, context, system_prompt, status, created_at, claimed_at, sent_at')
      .eq('instance_id', instanceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to load pending work:', error)
      return
    }

    setItems((data || []) as PendingWorkRow[])
  }, [instanceId])

  useEffect(() => {
    void loadPendingWork()
  }, [loadPendingWork])

  useEffect(() => {
    if (!instanceId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`instance_pending_work_${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'instance_pending_work',
          filter: `instance_id=eq.${instanceId}`,
        },
        () => {
          void loadPendingWork()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [instanceId, loadPendingWork])

  const removePending = useCallback(async (pendingId: string) => {
    setItems((current) => current.filter((item) => item.id !== pendingId))
    const ok = await cancelPendingWork(pendingId)
    if (!ok) {
      await loadPendingWork()
      toast({
        title: 'Error',
        description: 'Failed to remove the pending command.',
        variant: 'destructive',
      })
    }
  }, [loadPendingWork, toast])

  const editPending = useCallback(async (pendingId: string, message: string) => {
    setItems((current) => current.map((item) => item.id === pendingId ? { ...item, message } : item))
    const ok = await updatePendingWork(pendingId, message)
    if (!ok) {
      await loadPendingWork()
      toast({
        title: 'Error',
        description: 'Failed to update the pending command.',
        variant: 'destructive',
      })
    }
  }, [loadPendingWork, toast])

  const sendNow = useCallback(async (pendingId: string) => {
    if (!instanceId) return
    setSendingId(pendingId)
    const result = await sendPendingWorkNow({ pendingId, instanceId })
    setSendingId(null)
    if (!result.success) {
      toast({
        title: 'Error',
        description: result.error || 'Failed to send the pending command.',
        variant: 'destructive',
      })
      await loadPendingWork()
      return
    }
    setItems((current) => current.filter((item) => item.id !== pendingId))
  }, [instanceId, loadPendingWork, toast])

  return {
    pendingWork: items,
    removePending,
    editPending,
    sendNow,
    sendingId,
    reloadPendingWork: loadPendingWork,
  }
}
