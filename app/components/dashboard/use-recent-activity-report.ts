"use client"

import { useContext } from "react"
import { format } from "date-fns"
import { AuthContext } from "@/app/components/auth/auth-context"
import { useReportResource } from "@/app/hooks/use-report-resource"
import { useSite } from "@/app/context/SiteContext"
import type { Activity } from "@/app/api/recent-activity/format"
import { isKnownDemoSite } from "@/lib/demo-data"

async function fetchActivities([url]: readonly [string, string]) {
  const params = new URL(url, "http://demo.local").searchParams
  if (isKnownDemoSite(params.get("siteId"))) {
    const { loadDemoRecentActivity } = await import("@/lib/demo-data/activity-report")
    return loadDemoRecentActivity(params)
  }
  const response = await fetch(url)
  if (!response.ok) throw new Error("Unable to load recent activity. Please try again.")
  const body: unknown = await response.json()
  if (!body || typeof body !== "object" || !("activities" in body) || !Array.isArray(body.activities) ||
    !body.activities.every(item => item && typeof item.id === "string" && typeof item.date === "string" &&
      typeof item.user?.name === "string" && (item.kind === "task" || item.kind === "sale"))) {
    throw new Error("The recent activity response was incomplete.")
  }
  return { activities: body.activities as Activity[] }
}

export function useRecentActivityReport(limit: number, startDate?: Date, endDate?: Date) {
  const { currentSite, isLoading: siteLoading } = useSite()
  const auth = useContext(AuthContext)
  const params = new URLSearchParams({ siteId: currentSite?.id ?? "", limit: String(limit > 0 ? limit : 6) })
  if (startDate) params.set("startDate", format(startDate, "yyyy-MM-dd"))
  if (endDate) params.set("endDate", format(endDate, "yyyy-MM-dd"))
  const localDemo = isKnownDemoSite(currentSite?.id)
  const identity = auth?.user?.id || (localDemo ? currentSite?.id : undefined)
  const enabled = currentSite?.id && currentSite.id !== "default" && identity && (localDemo || !auth?.isLoading) && !siteLoading
  return useReportResource(enabled ? [`/api/recent-activity?${params}`, identity] as const : null,
    fetchActivities, Boolean((!localDemo && auth?.isLoading) || siteLoading))
}