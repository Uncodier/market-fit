"use client"

import { useState } from "react"
import { format, isValid, subDays } from "date-fns"
import { useSite } from "@/app/context/SiteContext"
import { useWidgetContext } from "@/app/context/WidgetContext"
import { useAuth } from "@/app/hooks/use-auth"
import { useReportResource } from "@/app/hooks/use-report-resource"
import { fetchReport, ReportRequestError } from "../report-query"

type TrafficMetricEndpoint = "visits" | "session-time" | "lead-conversion" | "client-conversion"

export interface TrafficMetricFilters {
  segmentId?: string
  startDate?: Date
  endDate?: Date
}

interface TrafficMetricData {
  actual: number | null
  percentChange: number | null
  periodType: string
}

function parseTrafficMetric(payload: unknown): TrafficMetricData {
  if (!payload || typeof payload !== "object" || "error" in payload) {
    throw new ReportRequestError("The report returned an invalid response.")
  }
  const { actual, percentChange, periodType } = payload as Record<string, unknown>
  // Explicit null means unavailable; missing, coerced, or non-finite values are invalid.
  if ((actual !== null && (typeof actual !== "number" || !Number.isFinite(actual) || actual < 0)) ||
      (percentChange !== null && (typeof percentChange !== "number" || !Number.isFinite(percentChange))) ||
      typeof periodType !== "string" || !periodType.trim()) {
    throw new ReportRequestError("The report returned an invalid response.")
  }
  return { actual, percentChange, periodType }
}

async function fetchTrafficMetric(key: [string, string]) {
  try {
    return parseTrafficMetric(await fetchReport(key))
  } catch (error) {
    if (error instanceof ReportRequestError) throw error
    throw new ReportRequestError("Unable to load this report. Please try again.")
  }
}

function formatPeriodType(periodType: string): string {
  switch (periodType) {
    case "daily": return "yesterday"
    case "weekly": return "last week"
    case "monthly": return "last month"
    case "quarterly": return "last quarter"
    case "yearly": return "last year"
    default: return "previous period"
  }
}

export function useTrafficMetric(endpoint: TrafficMetricEndpoint, filters: TrafficMetricFilters) {
  const { currentSite, isLoading: siteLoading } = useSite()
  const { user, isLoading: authLoading } = useAuth()
  const { shouldExecuteWidgets } = useWidgetContext()
  const [selectedDates, setSelectedDates] = useState(() => {
    const today = new Date()
    return { startDate: subDays(today, 30), endDate: today }
  })
  const startDate = filters.startDate ?? selectedDates.startDate
  const endDate = filters.endDate ?? selectedDates.endDate
  const startDay = isValid(startDate) ? format(startDate, "yyyy-MM-dd") : null
  const endDay = isValid(endDate) ? format(endDate, "yyyy-MM-dd") : null
  const validDates = Boolean(startDay && endDay && startDay <= endDay)
  const validSite = Boolean(currentSite?.id && currentSite.id !== "default")
  const waitingForReadiness = Boolean(authLoading || siteLoading || !shouldExecuteWidgets || (user?.id && !validSite))
  const enabled = !waitingForReadiness && user?.id && validSite && validDates
  const params = new URLSearchParams({
    siteId: currentSite?.id ?? "",
    segmentId: filters.segmentId ?? "all",
    startDate: startDay ?? "",
    endDate: endDay ?? "",
  })
  // Keep legacy calendar-day bounds. Identity isolates the cache, not URL authorization.
  const key: [string, string] | null = enabled ? [`/api/traffic/${endpoint}?${params}`, user.id] : null
  const resource = useReportResource<TrafficMetricData, ReportRequestError>(key, fetchTrafficMetric, waitingForReadiness)
  const error = resource.isLoading ? undefined
    : !user?.id ? new ReportRequestError("Sign in to view this report.", 401)
    : !validDates ? new ReportRequestError("Select a valid date range.", 400)
    : resource.error
  const data = resource.data
  const changeText = !data ? ""
    : data.actual === null ? "Unavailable for the selected period."
    : data.percentChange === null ? "Comparison unavailable."
    : `${data.percentChange}% from ${formatPeriodType(data.periodType)}`

  return {
    ...resource,
    error,
    changeText,
    isPositiveChange: data?.actual != null && data.percentChange !== null ? data.percentChange > 0 : undefined,
    startDate,
    endDate,
    onDateChange: (startDate: Date, endDate: Date) => setSelectedDates({ startDate, endDate }),
  }
}