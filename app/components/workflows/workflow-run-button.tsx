"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { PlayCircle } from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useRobots } from "@/app/context/RobotsContext"
import { apiClient } from "@/app/services/api-client-service"

export function WorkflowRunButton() {
  const { t } = useLocalization()
  const searchParams = useSearchParams()
  const { getAllInstances, getInstanceById, isLoading } = useRobots()
  const [busy, setBusy] = useState(false)

  const instance = useMemo(() => {
    const selected = searchParams.get("instance")
    if (selected && selected !== "new") {
      const found = getInstanceById(selected)
      if (found) return found
    }
    const all = getAllInstances()
    return all[0] || null
  }, [searchParams, getAllInstances, getInstanceById])

  const run = async () => {
    if (!instance?.id) {
      toast.error(t("workflows.pickInstance") || "Select or create an instance first.")
      return
    }
    setBusy(true)
    try {
      const response = await apiClient.post(`/api/workflows/${instance.id}/run`, { payload: { source: "manual" } })
      if (!response.success) {
        throw new Error(response.error?.message || "Request failed")
      }
      toast.success(t("workflows.runStarted") || "Workflow run started. Open Agents to watch logs.")
    } catch (error: any) {
      toast.error(error?.message || "Workflow request failed")
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return null

  return (
    <Button
      size="default"
      className="flex items-center gap-2 bg-primary hover:bg-primary/90 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
      disabled={busy}
      onClick={() => void run()}
      title={t("layout.topbar.runWorkflow") || "Run"}
    >
      {busy ? (
        <>
          <LoadingSkeleton variant="button" size="sm" className="text-white" />
          <span className="hidden sm:inline font-inter font-medium text-sm">
            {t("workflows.running") || "Running…"}
          </span>
        </>
      ) : (
        <>
          <PlayCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2 font-inter font-medium text-sm">
            {t("layout.topbar.runWorkflow") || "Run"}
          </span>
        </>
      )}
    </Button>
  )
}
