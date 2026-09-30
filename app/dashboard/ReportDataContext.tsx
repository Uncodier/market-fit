"use client"

import { createContext, useContext } from "react"
import type { OverviewGroup, PerformanceGroup } from "@/lib/dashboard/report-groups"

export type ReportDataGroups = {
  performanceGroup?: PerformanceGroup
  overviewGroup?: OverviewGroup
  currency?: string
}

// An absent group preserves the full-batch contract for consumers outside reports.
export const ReportDataContext = createContext<ReportDataGroups>({})
export const ReportDataProvider = ReportDataContext.Provider

export function useReportDataContext() {
  return useContext(ReportDataContext)
}