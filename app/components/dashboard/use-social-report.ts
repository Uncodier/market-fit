"use client"

import { useContext } from "react"
import { useReportResource } from "@/app/hooks/use-report-resource"
import { useSite } from "@/app/context/SiteContext"
import { startOfDay, endOfDay } from "date-fns"
import { AuthContext } from "@/app/components/auth/auth-context"
import { getSocialPerformanceData, getTopCommentersData } from "./social-actions"

type SocialKey = readonly [string, string, number, number, string, string | undefined]

async function fetchPerformance([, siteId, start, end, timeZone]: SocialKey) {
  const result = await getSocialPerformanceData(siteId, new Date(start), new Date(end), timeZone)
  if ("error" in result && result.error) throw new Error("Unable to load social performance")
  if (!("kpis" in result) || !result.kpis || !Array.isArray(result.data) || !Array.isArray(result.networks) ||
    !result.trends || !Object.entries(result.kpis).every(([key, value]) =>
      key === "avgEngagementRate" && value === null || typeof value === "number" && Number.isFinite(value))) {
    throw new Error("Unable to load social performance")
  }
  return result
}

async function fetchCommenters([, siteId, start, end, timeZone]: SocialKey) {
  const result = await getTopCommentersData(siteId, new Date(start), new Date(end), timeZone)
  if (result.error || !Array.isArray(result.data)) throw new Error("Unable to load top commenters")
  return result.data
}

export function useSocialReport(siteId: string | undefined, startDate: Date, endDate: Date, includeCommenters: boolean) {
  const auth = useContext(AuthContext)
  const { isLoading: siteLoading } = useSite()
  const start = startOfDay(startDate).getTime()
  const end = endOfDay(endDate).getTime()
  const invalidDates = !Number.isFinite(start) || !Number.isFinite(end) || startDate > endDate
  const authLoading = auth?.isLoading ?? false
  const signedOut = auth !== undefined && !authLoading && !auth.user
  const waitingForReadiness = Boolean(authLoading || siteLoading)
  const enabled = !!siteId && siteId !== "default" && !invalidDates && !waitingForReadiness && !signedOut
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const performance = useReportResource(enabled ? ["social-performance", siteId, start, end, timeZone, auth?.user?.id] as const : null,
    fetchPerformance, waitingForReadiness)
  const commenters = useReportResource(enabled && includeCommenters
    ? ["social-commenters", siteId, start, end, timeZone, auth?.user?.id] as const : null,
    fetchCommenters, includeCommenters && waitingForReadiness)
  return { performance, commenters, invalidDates, enabled, authLoading, signedOut }
}