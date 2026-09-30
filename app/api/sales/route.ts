import { NextResponse } from "next/server"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { createClient } from "@/lib/supabase/server"
import { readThroughAnalyticsResponseCache } from "@/lib/redis/analytics-response-cache"
import { salesCurrency } from "@/lib/sales/report-format"
import { salesReportFilters, salesReportPeriod, SalesReportInputError } from "@/lib/sales/report-period"
import { readSalesPages, SALES_REPORT_FIELDS, SalesReportLimitError, type ReportSale } from "./sales-query"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const filters = salesReportFilters(url.searchParams)
    const period = salesReportPeriod(url.searchParams)
    // Keep the completed-sale / created-date array contract. A limit is a safety
    // ceiling, never permission to silently truncate the chart's monetary totals.
    const limitValue = url.searchParams.get("limit")
    const limit = limitValue === null ? 50_000 : Number(limitValue)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50_000) {
      throw new SalesReportInputError("Limit must be an integer between 1 and 50000")
    }
    const start = url.searchParams.get("startDate") || `${period.start}T00:00:00.000Z`
    const end = url.searchParams.get("endDate") || `${period.end}T23:59:59.999Z`
    url.searchParams.set("startDate", start)
    url.searchParams.set("endDate", end)
    const scopedRequest = new Request(url, { headers: request.headers })
    const access = await requireAnalyticsAccess(scopedRequest)
    if (access.error) return access.error
    return await readThroughAnalyticsResponseCache({
      request: scopedRequest, namespace: `sales-v2:${access.userId}`, siteId: access.siteId, lockTtlMs: 30_000,
      load: async () => {
        const client = await createClient(true)
        const sales = await readSalesPages<ReportSale>(() => {
          let query = client.from("sales").select(SALES_REPORT_FIELDS).eq("site_id", access.siteId)
            .eq("status", "completed").gte("created_at", start)
          query = end.length === 10 ? query.lt("created_at", `${period.endExclusive}T00:00:00.000Z`) : query.lte("created_at", end)
          if (filters.segmentId !== "all") query = query.eq("segment_id", filters.segmentId)
          return query
        }, limit)
        const currencies = Array.from(new Set(sales.map((sale) => salesCurrency(sale.currency)))).sort()
        if (!filters.currency && currencies.length > 1) {
          return NextResponse.json({ error: "Select a currency to avoid combining monetary amounts.", availableCurrencies: currencies }, { status: 422 })
        }
        return NextResponse.json(sales.filter((sale) => !filters.currency || salesCurrency(sale.currency) === filters.currency), {
          headers: { "Cache-Control": "private, no-store" },
        })
      },
    })
  } catch (error) {
    if (error instanceof SalesReportInputError || error instanceof SalesReportLimitError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to load sales data. Please try again." }, { status: 500 })
  }
}