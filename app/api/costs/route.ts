import { NextRequest, NextResponse } from "next/server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { costReportInput, CostReportError } from "./cost-input"
import { loadCostData } from "./cost-data"
import { buildCostReport } from "./cost-report"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const input = costReportInput(request.nextUrl.searchParams)
    const access = await requireSiteAccess(request, input.siteId)
    if (access.error) return access.error

    // Use the authenticated client returned by the site boundary; RLS remains active.
    const { rows, currency, availableCurrencies } = await loadCostData(access.supabase, input)
    return NextResponse.json(buildCostReport(rows, currency, input, availableCurrencies), {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch (error) {
    const known = error instanceof CostReportError
    return NextResponse.json({
      error: known ? error.message : "Failed to load cost report data. Please try again.",
      ...(known && error.availableCurrencies ? { availableCurrencies: error.availableCurrencies } : {}),
    }, { status: known ? error.status : 500, headers: { "Cache-Control": "private, no-store" } })
  }
}