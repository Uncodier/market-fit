import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { requireSalesReportVisibility, SalesReportVisibilityError } from "@/app/api/revenue/report-visibility"
import { SalesReportLimitError } from "@/app/api/sales/sales-query"
import { loadCatalogSalesHistory } from "@/app/catalog/load-sales-history"

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
})
const inputSchema = z.object({ id: z.string().uuid(), siteId: z.string().uuid(), startDate: date, endDate: date })
  .refine(value => {
    const days = (Date.parse(value.endDate) - Date.parse(value.startDate)) / 86_400_000
    return days >= 0 && days < 366
  })
const headers = { "Cache-Control": "private, no-store" }

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const search = new URL(request.url).searchParams
    const parsed = inputSchema.safeParse({ id, siteId: search.get("siteId"),
      startDate: search.get("startDate"), endDate: search.get("endDate") })
    if (!parsed.success) return NextResponse.json({ error: "Invalid item, site or date range (maximum 366 days)." }, { status: 400, headers })
    const { siteId, startDate, endDate } = parsed.data
    const access = await requireSiteAccess(request, siteId)
    if (access.error) return access.error
    if (!await userCanOnSite(access.supabase, siteId, "select")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers })
    }
    await requireSalesReportVisibility(access.supabase, siteId, access.userId)
    const item = await access.supabase.from("catalog_items").select("id")
      .eq("site_id", siteId).eq("id", id).maybeSingle()
    if (item.error) throw new Error("Unable to load catalog item")
    if (!item.data) return NextResponse.json({ error: "Catalog item not found" }, { status: 404, headers })
    const history = await loadCatalogSalesHistory(access.supabase, siteId, id, startDate, endDate)
    return NextResponse.json(history, { headers })
  } catch (error) {
    if (error instanceof SalesReportVisibilityError || error instanceof SalesReportLimitError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof SalesReportVisibilityError ? 403 : 422, headers })
    }
    return NextResponse.json({ error: "Failed to load item sales. Please try again." }, { status: 500, headers })
  }
}