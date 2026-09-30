"use client"

import { useState } from "react"
import { useReportResource } from "@/app/hooks/use-report-resource"
import { format, isValid, subDays } from "date-fns"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { CohortReportError, parseCohortReport, type CohortKind } from "./cohort-report-data"

export type CohortFilters = { segmentId?: string; startDate?: Date; endDate?: Date }

async function fetchCohortReport([url, , kind]: [string, string, CohortKind]) {
  const response = await fetch(url).catch(() => {
    throw new CohortReportError("Unable to connect to the cohort report. Please try again.")
  })
  if (!response.ok) {
    const message = response.status === 401 ? "Sign in to view cohort reports."
      : response.status === 403 ? "You do not have access to this report."
      : response.status === 400 ? "Select valid filters and a shorter date range."
      : response.status === 422 ? "Too many cohort records. Select a shorter date range or a segment."
      : response.status === 429 ? "Too many report requests. Please try again shortly."
      : "Unable to load cohort data. Please try again."
    throw new CohortReportError(message, response.status)
  }
  const body: unknown = await response.json().catch(() => {
    throw new CohortReportError("The cohort report returned an invalid response.")
  })
  return parseCohortReport(body, kind)
}

export function useCohortReport(kind: CohortKind, filters: CohortFilters) {
  const { currentSite, isLoading: siteLoading } = useSite()
  const { user, isLoading: authLoading } = useAuth()
  const [fallback] = useState(() => ({ startDate: subDays(new Date(), 30), endDate: new Date() }))
  const start = filters.startDate ?? fallback.startDate
  const end = filters.endDate ?? fallback.endDate
  const invalidDates = !isValid(start) || !isValid(end) || start > end
  const hasSite = !!currentSite?.id && currentSite.id !== "default"
  const params = invalidDates ? null : new URLSearchParams({
    siteId: currentSite?.id ?? "", segmentId: filters.segmentId ?? "all",
    startDate: format(start, "yyyy-MM-dd"), endDate: format(end, "yyyy-MM-dd"),
  })
  const key: [string, string, CohortKind] | null = params && hasSite && user?.id && !authLoading && !siteLoading
    ? [`/api/${kind === "customers" ? "cohorts" : "leads-cohorts"}?${params}`, user.id, kind] : null
  const result = useReportResource(key, fetchCohortReport, Boolean(authLoading || siteLoading))
  return { ...result, data: key && !result.error ? result.data : undefined, authLoading, signedIn: !!user?.id, hasSite, invalidDates }
}