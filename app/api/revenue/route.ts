import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { salesReportFilters, salesReportPeriod, SalesReportInputError } from "@/lib/sales/report-period"
import { queryReportSales, SalesReportLimitError } from "@/app/api/sales/sales-query"
import { buildSalesReport, SalesCurrencyRequiredError } from "./build-sales-report"

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const filters = salesReportFilters(params)
    const period = salesReportPeriod(params)
    const access = await requireAnalyticsAccess(request)
    if (access.error) return access.error

    // Explicit authorization plus user-scoped RLS; never use a service role for reports.
    const client = await createClient(true)
    const sales = await queryReportSales(client, access.siteId, filters.segmentId, period.previousStart, period.endExclusive)
    const report = await buildSalesReport(client, sales, period, filters)
    return NextResponse.json(report, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    if (error instanceof SalesCurrencyRequiredError) {
      return NextResponse.json({ error: error.message, availableCurrencies: error.availableCurrencies }, { status: 422 })
    }
    if (error instanceof SalesReportInputError || error instanceof SalesReportLimitError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to load the sales report. Please try again." }, { status: 500 })
  }
}