"use client"

import { useReportResource } from "@/app/hooks/use-report-resource"
import { format } from "date-fns"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { useWidgetContext } from "@/app/context/WidgetContext"
import { useReportDataContext } from "@/app/dashboard/ReportDataContext"
import { isReportBatch, reportCurrencyOptions, reportMetricKeys, type ReportBatch, type ReportBatchKind } from "@/lib/dashboard/report-groups"

export class DashboardBatchError extends Error {
  constructor(message: string, readonly status?: number, readonly availableCurrencies?: string[]) {
    super(message)
    this.name = "DashboardBatchError"
  }
}

function useDashboardBatch(kind: ReportBatchKind, startDate: Date, endDate: Date, segmentId = "all") {
  const { currentSite, isLoading: siteLoading } = useSite()
  const { user, isLoading: authLoading } = useAuth()
  const widgetContext = useWidgetContext()
  const { performanceGroup, overviewGroup, currency } = useReportDataContext()
  const group = kind === "performance" ? performanceGroup : overviewGroup
  const enabled = !(kind === "overview" && group === "activity")
  const widgetsReady = widgetContext?.shouldExecuteWidgets !== false
  const params = new URLSearchParams({
    siteId: currentSite?.id ?? "",
    segmentId,
    startDate: format(startDate, "yyyy-MM-dd"),
    endDate: format(endDate, "yyyy-MM-dd"),
  })
  if (group) params.set("group", group)
  if (kind === "overview" && currency) params.set("currency", currency)
  const url = `/api/dashboard/${kind}?${params}`
  const hasSite = Boolean(currentSite?.id && currentSite.id !== "default")
  // Identity isolates browser caches across sessions; never send it as authority.
  const key = enabled && widgetsReady && hasSite && !siteLoading && !authLoading && user?.id
    ? [url, user.id] : null

  const batch = useReportResource<ReportBatch, DashboardBatchError>(
    key,
    async ([requestUrl]: [string, string | undefined]) => {
      const response = await fetch(requestUrl)
      if (!response.ok) {
        if (response.status === 422) {
          const body = await response.json().catch(() => null)
          const currencies = reportCurrencyOptions(body?.availableCurrencies)
          if (currencies) throw new DashboardBatchError("Select a currency to view revenue metrics", 422, currencies)
        }
        throw new DashboardBatchError(`Failed to load ${kind} metrics`, response.status)
      }
      const data: unknown = await response.json()
      const keys = reportMetricKeys(kind, group)
      if (!keys || !isReportBatch(data, keys)) throw new DashboardBatchError(`Invalid ${kind} metrics response`)
      return data
    }
  )

  const status = !enabled ? "disabled"
    : authLoading || siteLoading ? "loading"
    : !user?.id ? "unauthenticated"
    : !hasSite ? "no-site"
    : !widgetsReady || batch.isLoading || batch.isValidating || (!batch.data && !batch.error) ? "loading"
    : batch.error ? "error" : "ready"
  const isLoading = status === "loading"
  return {
    ...batch,
    status,
    isLoading,
    // Neither a prior error nor stale figures represent the active attempt.
    error: status === "error" ? batch.error : undefined,
    data: status === "ready" ? batch.data : undefined,
  }
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
) {
  const { data, isLoading, error, mutate } = useDashboardPerformance(startDate, endDate, segmentId)
  return { data: error ? null : (data?.[key] as T) ?? null, isLoading, error, mutate }
}

export function useOverviewSlice<T>(
  key: string,
  startDate: Date,
  endDate: Date,
  segmentId = "all"
) {
  const { data, isLoading, error, mutate } = useDashboardOverview(startDate, endDate, segmentId)
  return { data: error ? null : (data?.[key] as T) ?? null, isLoading, error, mutate }
}
