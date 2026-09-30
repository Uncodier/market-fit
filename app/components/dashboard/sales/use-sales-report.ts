"use client"

import { useReportResource } from "@/app/hooks/use-report-resource"
import { format, isValid } from "date-fns"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { useWidgetContext } from "@/app/context/WidgetContext"
import type { SalesReportData } from "@/lib/sales/report-types"

export class SalesReportFetchError extends Error {
  constructor(message: string, readonly status: number, readonly availableCurrencies: string[] = []) {
    super(message)
  }
}

export function salesReportUrl(siteId: string, start: Date, end: Date, segmentId: string, currency: string, categories: boolean) {
  if (!isValid(start) || !isValid(end) || start > end) return null
  const params = new URLSearchParams({
    siteId, startDate: format(start, "yyyy-MM-dd"), endDate: format(end, "yyyy-MM-dd"),
    segmentId, includeCategories: String(categories),
  })
  if (currency) params.set("currency", currency)
  return `/api/revenue?${params}`
}

export async function fetchSalesReport([, url]: readonly [string, string]): Promise<SalesReportData> {
  const response = await fetch(url, { cache: "no-store" }).catch(() => {
    throw new SalesReportFetchError("Unable to connect to the sales report. Please try again.", 0)
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const currencies = Array.isArray(body?.availableCurrencies)
      ? body.availableCurrencies.filter((value: unknown) => typeof value === "string" && /^(?:[A-Z]{3}|UNSPECIFIED)$/.test(value))
      : []
    const message = response.status === 400 && typeof body?.error === "string" ? body.error
      : response.status === 422 ? "Select a currency to view sales without combining different currencies."
      : response.status === 403 ? "This report requires access to all linked sales and orders. Ask a site manager to review your record visibility."
      : "Unable to load sales data. Please try again."
    throw new SalesReportFetchError(message, response.status, currencies)
  }
  if (!body?.totalSales || !body?.metadata || !body?.transactions || !Array.isArray(body?.monthlyData)) {
    throw new SalesReportFetchError("The sales report response was incomplete. Please try again.", 502)
  }
  return body as SalesReportData
}

export function useSalesReport(start: Date, end: Date, segmentId: string, currency: string, categories: boolean) {
  const { currentSite, isLoading: siteLoading } = useSite()
  const { user, isLoading: authLoading } = useAuth()
  const { shouldExecuteWidgets } = useWidgetContext()
  const url = currentSite?.id && currentSite.id !== "default"
    ? salesReportUrl(currentSite.id, start, end, segmentId, currency, categories) : null
  const invalidDates = !isValid(start) || !isValid(end) || start > end
  const waitingForReadiness = Boolean(authLoading || siteLoading || (user?.id && url && !shouldExecuteWidgets))
  const enabled = Boolean(user?.id && url && shouldExecuteWidgets && !authLoading && !siteLoading)
  const result = useReportResource<SalesReportData, SalesReportFetchError>(
    enabled ? [user!.id, url!] as const : null, fetchSalesReport,
    waitingForReadiness,
  )
  return { ...result, enabled, invalidDates }
}