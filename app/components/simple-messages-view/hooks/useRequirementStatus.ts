import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export const useRequirementStatus = (activeRobotInstance?: any) => {
  const [requirementStatuses, setRequirementStatuses] = useState<any[]>([])
  
  const loadStatuses = useCallback(async () => {
    if (!activeRobotInstance?.id) {
      setRequirementStatuses([])
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('requirement_status')
        .select('*, requirements(title)')
        .eq('instance_id', activeRobotInstance.id)
        .order('created_at', { ascending: true })

      if (!error && data) {
        setRequirementStatuses(data)
      }
    } catch (error) {
      console.error('Error loading requirement statuses:', error)
      setRequirementStatuses([])
    }
  }, [activeRobotInstance?.id])

  useEffect(() => {
    loadStatuses()
  }, [loadStatuses])

  useEffect(() => {
    if (!activeRobotInstance?.id) return

    const supabase = createClient()
    const subscription = supabase
      .channel('requirement_status_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requirement_status',
          filter: `instance_id=eq.${activeRobotInstance.id}`
        },
        () => {
          loadStatuses()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [activeRobotInstance?.id, loadStatuses])

  return {
    requirementStatuses,
    loadStatuses
  }
}
