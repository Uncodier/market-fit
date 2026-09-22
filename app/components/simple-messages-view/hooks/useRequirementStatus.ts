import useSWR from "swr"
import { useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { subscribeRequirementStatusRealtime } from "./subscribeRequirementStatusRealtime"

const REQUIREMENT_STATUS_FIELDS = [
  "id",
  "site_id",
  "instance_id",
  "asset_id",
  "requirement_id",
  "repo_url",
  "stage",
  "message",
  "created_at",
  "preview_url",
  "source_code",
  "cycle",
  "endpoint_url",
  "updated_at",
  "snapshot_id",
  "active_sandbox_id",
  "requirements(id, title)",
].join(", ")

export const useRequirementStatus = (activeRobotInstance?: { id?: string } | null) => {
  const instanceId = activeRobotInstance?.id

  const { data: requirementStatuses, mutate, isLoading, isValidating } = useSWR(
    instanceId ? ['requirement_status', instanceId] : null,
    async ([_, id]) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("requirement_status")
        .select(REQUIREMENT_STATUS_FIELDS)
        .eq("instance_id", id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })

      if (error) {
        console.error("Error loading requirement statuses:", error)
        return []
      }

      const statuses = data || []
      const latestWithRequirement = [...statuses]
        .reverse()
        .find((status: any) => status.requirement_id)
      if (!latestWithRequirement?.requirement_id) return statuses

      const { data: requirement, error: requirementError } = await supabase
        .from("requirements")
        .select("id, title, backlog")
        .eq("id", latestWithRequirement.requirement_id)
        .maybeSingle()

      if (requirementError) {
        console.warn("Failed to load the latest requirement backlog", requirementError)
        return statuses
      }

      return statuses.map((status: any) =>
        status.id === latestWithRequirement.id
          ? { ...status, requirements: requirement }
          : status
      )
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
    loadStatuses,
    isLoading,
    isValidating
  }
}
