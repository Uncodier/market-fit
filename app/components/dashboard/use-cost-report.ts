"use client"

import { useContext, useState } from "react"
import { AuthContext } from "@/app/components/auth/auth-context"
import { useSite } from "@/app/context/SiteContext"
import { useReportResource } from "@/app/hooks/use-report-resource"
import { format, isValid, subDays } from "date-fns"
import type { CostData, CostRevenueData } from "./cost-report-data"

type RecordData = Record<string, unknown>
const record = (value: unknown): value is RecordData => !!value && typeof value === "object"
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)

export class CostReportRequestError extends Error {
  constructor(message: string, readonly status?: number, readonly availableCurrencies?: string[]) { super(message) }
}

async function fetchReport(url: string): Promise<RecordData> {
  const response = await fetch(url, { cache: "no-store" }).catch(() => {
    throw new CostReportRequestError("Unable to connect to the cost report. Please try again.")
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const available = record(body) ? body.availableCurrencies : undefined
    const currencies = Array.isArray(available)
      ? available.filter((value): value is string => typeof value === "string" && /^(?:[A-Z]{3}|UNSPECIFIED)$/.test(value)) : undefined
    const message = response.status === 400 ? "Select a shorter date range or valid filters."
      : response.status === 401 ? "Sign in to view cost reports."
      : response.status === 403 ? "You do not have access to this site or filter."
      : "Cost data could not be loaded. Missing costs are not zero costs."
    throw new CostReportRequestError(message, response.status, currencies)
  }
  if (!record(body) || body.error) throw new CostReportRequestError("Incomplete report data")
  return body
}

async function fetchCosts(url: string): Promise<CostData> {
  const body = await fetchReport(url)
  if (!record(body.totalCosts) || !finite(body.totalCosts.actual) ||
    !Array.isArray(body.costCategories) || !body.costCategories.every((row: unknown) => record(row) &&
      typeof row.name === "string" && finite(row.amount) && finite(row.prevAmount) && finite(row.percentChange)) ||
    !Array.isArray(body.monthlyData) || !body.monthlyData.every((row: unknown) => record(row) &&
      typeof row.month === "string" && finite(row.fixedCosts) && finite(row.variableCosts)) ||
    !Array.isArray(body.costDistribution) || !body.costDistribution.every((row: unknown) => record(row) &&
      typeof row.category === "string" && finite(row.amount) && finite(row.percentage))) {
    throw new CostReportRequestError("Incomplete cost report data")
  }
  return body as unknown as CostData
}

async function fetchRevenue(url: string): Promise<CostRevenueData> {
  const body = await fetchReport(url)
  if (!record(body.totalSales) || !finite(body.totalSales.actual)) throw new CostReportRequestError("Incomplete sales data")
  return body as unknown as CostRevenueData
}

export function useCostReport(siteId: string | undefined, start: Date | undefined, end: Date | undefined,
  segmentId: string, campaignId: string, summary: boolean, currency?: string) {
  const auth = useContext(AuthContext)
  const { isLoading: siteLoading } = useSite()
  const waitingForReadiness = Boolean(auth?.isLoading || siteLoading)
  const signedOut = auth !== undefined && !auth.isLoading && !auth.user
  const [defaultEnd] = useState(() => new Date())
  const endDate = end ?? defaultEnd
  const startDate = start ?? subDays(endDate, 30)
  const invalidDates = !isValid(startDate) || !isValid(endDate) || startDate > endDate
  const enabled = !!siteId && siteId !== "default" && !invalidDates && !waitingForReadiness && !signedOut
  const params = enabled ? new URLSearchParams({
    siteId, startDate: format(startDate, "yyyy-MM-dd"), endDate: format(endDate, "yyyy-MM-dd"),
  }) : null
  if (segmentId !== "all") params?.set("segmentId", segmentId)
  if (currency) params?.set("currency", currency)
  const revenueParams = params ? new URLSearchParams(params) : null
  revenueParams?.set("includeCategories", "false")
  if (campaignId !== "all") params?.set("campaignId", campaignId)
  const costs = useReportResource<CostData, CostReportRequestError>(params ? [`/api/costs?${params}`, auth?.user?.id] : null,
    ([url]: [string]) => fetchCosts(url), waitingForReadiness)
  if (!currency && costs.data?.currency && costs.data.currency !== "UNSPECIFIED") {
    revenueParams?.set("currency", costs.data.currency)
  }
  const revenue = useReportResource<CostRevenueData, CostReportRequestError>(summary && revenueParams && costs.data
    ? [`/api/revenue?${revenueParams}`, auth?.user?.id] : null,
    ([url]: [string]) => fetchRevenue(url), summary && (waitingForReadiness || costs.isLoading))
  return { costs, revenue, enabled, invalidDates, startDate, endDate }
}