"use client"

import useSWR from "swr"
import { format } from "date-fns"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { useWidgetContext } from "@/app/context/WidgetContext"

type BatchKind = "performance" | "overview"

function buildParams(
  siteId: string,
  userId: string | undefined,
  segmentId: string,
  startDate: Date,
  endDate: Date
) {
  const params = new URLSearchParams({
    siteId,
    segmentId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    useDemoData: "true",
  })
  if (userId) params.set("userId", userId)
  return params
}

function useDashboardBatch(kind: BatchKind, startDate: Date, endDate: Date, segmentId = "all") {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const widgetContext = useWidgetContext()
  const shouldExecute = widgetContext?.shouldExecuteWidgets !== false

  return useSWR(
    shouldExecute && currentSite?.id && currentSite.id !== "default"
      ? [
          `dashboard-${kind}`,
          currentSite.id,
          user?.id,
          segmentId,
          format(startDate, "yyyy-MM-dd"),
          format(endDate, "yyyy-MM-dd"),
        ]
      : null,
    async ([, siteId, userId, segId, ,]) => {
      const params = buildParams(siteId, userId, segId, startDate, endDate)
      const response = await fetch(`/api/dashboard/${kind}?${params}`)
      if (!response.ok) throw new Error(`Failed to load ${kind} metrics`)
      return response.json() as Promise<Record<string, any>>
    }
  )
}

export function useDashboardPerformance(startDate: Date, endDate: Date, segmentId = "all") {
  return useDashboardBatch("performance", startDate, endDate, segmentId)
}

export function useDashboardOverview(startDate: Date, endDate: Date, segmentId = "all") {
  return useDashboardBatch("overview", startDate, endDate, segmentId)
}

export function usePerformanceSlice<T>(
  key: string,
  startDate: Date,
  endDate: Date,
  segmentId = "all"
): { data: T | null; isLoading: boolean } {
  const { data, isLoading } = useDashboardPerformance(startDate, endDate, segmentId)
  return { data: (data?.[key] as T) ?? null, isLoading }
}

export function useOverviewSlice<T>(
  key: string,
  startDate: Date,
  endDate: Date,
  segmentId = "all"
): { data: T | null; isLoading: boolean } {
  const { data, isLoading } = useDashboardOverview(startDate, endDate, segmentId)
  return { data: (data?.[key] as T) ?? null, isLoading }
}
