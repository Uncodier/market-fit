import useSWR from "swr"
import { useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { subscribeRequirementStatusRealtime } from "./subscribeRequirementStatusRealtime"

export const useRequirementStatus = (activeRobotInstance?: { id?: string } | null) => {
  const instanceId = activeRobotInstance?.id

  const { data: requirementStatuses, mutate } = useSWR(
    instanceId ? ['requirement_status', instanceId] : null,
    async ([_, id]) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("requirement_status")
        .select("*, requirements(title)")
        .eq("instance_id", id)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("Error loading requirement statuses:", error)
        return []
      }
      return data || []
    },
    { keepPreviousData: true }
  )

  useEffect(() => {
    if (!instanceId) return
    return subscribeRequirementStatusRealtime(instanceId)
  }, [instanceId])

  const loadStatuses = useCallback(() => {
    if (instanceId) {
      mutate()
    }
  }, [instanceId, mutate])

  return {
    requirementStatuses: requirementStatuses || [],
    loadStatuses
  }
}
