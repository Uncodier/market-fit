import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRobots } from "@/app/context/RobotsContext"
import { subscribeRequirementStatusRealtime } from "./subscribeRequirementStatusRealtime"

export const useRequirementStatus = (activeRobotInstance?: { id?: string } | null) => {
  const { refreshCount } = useRobots()
  const [requirementStatuses, setRequirementStatuses] = useState<any[]>([])

  const instanceId = activeRobotInstance?.id

  const loadStatuses = useCallback(async () => {
    if (!instanceId) {
      setRequirementStatuses([])
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("requirement_status")
        .select("*, requirements(title)")
        .eq("instance_id", instanceId)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("Error loading requirement statuses:", error)
        setRequirementStatuses([])
      } else {
        setRequirementStatuses(data || [])
      }
    } catch (error) {
      console.error("Error loading requirement statuses:", error)
      setRequirementStatuses([])
    }
  }, [instanceId])

  useEffect(() => {
    loadStatuses()
  }, [loadStatuses, refreshCount])

  useEffect(() => {
    if (!instanceId) return
    return subscribeRequirementStatusRealtime(instanceId, () => {
      loadStatuses()
    })
  }, [instanceId, loadStatuses])

  return {
    requirementStatuses,
    loadStatuses
  }
}
