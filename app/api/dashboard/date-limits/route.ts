import { NextResponse } from "next/server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { reportDateLimits } from "@/lib/dashboard/report-date-limits"

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const siteId = params.get("siteId")
  if (params.getAll("siteId").length !== 1 || !siteId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteId)) {
    return NextResponse.json({ error: "A valid site ID is required" }, { status: 400 })
  }
  try {
    const access = await requireSiteAccess(request, siteId)
    if (access.error) return access.error
    return NextResponse.json({ limits: reportDateLimits() }, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return NextResponse.json({ error: "Unable to load report date options. Please retry." }, {
      status: 500, headers: { "Cache-Control": "private, no-store" },
    })
  }
}