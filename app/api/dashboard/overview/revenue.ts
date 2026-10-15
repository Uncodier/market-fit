import { NextResponse } from "next/server"
import { GET as revenue } from "@/app/api/revenue/route"
import { CostReportError } from "@/app/api/costs/cost-input"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { salesReportFilters, salesReportPeriod, SalesReportInputError } from "@/lib/sales/report-period"
import { salesCurrency } from "@/lib/sales/report-format"
import { createClient } from "@/lib/supabase/server"
import { loadOverviewPeriodCosts } from "./period-costs"

const NO_STORE = { "Cache-Control": "private, no-store" }

/** Overview enrichment only; the original revenue route retains sales visibility authorization. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const filters = salesReportFilters(params)
    const period = salesReportPeriod(params)
    const access = await requireAnalyticsAccess(request)
    if (access.error) return access.error
    const response = await revenue(request)
    if (!response.ok) return response
    const report = await response.json()
    if (!report || typeof report.currency !== "string" ||
        (report.currency !== "UNSPECIFIED" && salesCurrency(report.currency) !== report.currency)) {
      throw new Error("Invalid sales report currency")
    }
    const client = await createClient(true)
    const periodCosts = await loadOverviewPeriodCosts(client, access.siteId, filters.segmentId, period, report.currency)
    return NextResponse.json({ ...report, periodCosts }, { headers: NO_STORE })
  } catch (error) {
    if (error instanceof SalesReportInputError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: NO_STORE })
    }
    if (error instanceof CostReportError && [400, 403].includes(error.status)) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: NO_STORE })
    }
    return NextResponse.json({ error: "Failed to load Overview period costs. Please try again." }, {
      status: 500, headers: NO_STORE,
    })
  }
}