"use client"

import { useAuth } from "@/app/hooks/use-auth"
import { useReportResource } from "@/app/hooks/use-report-resource"
import { reportDateLimits, DEFAULT_ANALYTICS_RANGE_DAYS, type ReportDateLimits } from "@/lib/dashboard/report-date-limits"
import { isKnownDemoSite } from "@/lib/demo-data"
import { REPORTS, type ReportId } from "./report-sections"

async function fetchLimits([url]: [string, string]): Promise<ReportDateLimits> {
  if (isKnownDemoSite(new URL(url, "http://demo.local").searchParams.get("siteId"))) {
    return reportDateLimits(DEFAULT_ANALYTICS_RANGE_DAYS)
  }
  const response = await fetch(url)
  if (!response.ok) throw new Error("Unable to load report date options. Please retry.")
  const body = await response.json()
  for (const [report, definition] of Object.entries(REPORTS)) {
    for (const section of definition.sections) {
      const value = body?.limits?.[report]?.[section.id]
      if (!Number.isSafeInteger(value) || value < 1) throw new Error("The report date options were incomplete.")
    }
  }
  return body.limits
}

export function useReportDateLimits(siteId: string | undefined, report: ReportId, section: string) {
  const { user, isLoading: authLoading } = useAuth()
  const localDemo = isKnownDemoSite(siteId)
  const identity = user?.id || (localDemo ? siteId : undefined)
  const enabled = !!siteId && siteId !== "default" && !!identity && (localDemo || !authLoading)
  const result = useReportResource(enabled ? [`/api/dashboard/date-limits?siteId=${encodeURIComponent(siteId)}`, identity] : null,
    fetchLimits, !localDemo && authLoading)
  const limits = result.data?.[report] as Record<string, number> | undefined
  return { ...result, maxRangeDays: limits?.[section], signedOut: !localDemo && !authLoading && !user }
}