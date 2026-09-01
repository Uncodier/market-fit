import { NextRequest, NextResponse } from "next/server"
import { createServiceApiClient } from "@/lib/supabase/server-client"
import { buildRecentActivityFeed } from "./build-feed"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const siteId = searchParams.get("siteId")
    const limit = parseInt(searchParams.get("limit") || "6", 10)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    if (!siteId) {
      return NextResponse.json({ error: "Site ID is required" }, { status: 400 })
    }


    const supabase = createServiceApiClient()
    const activities = await buildRecentActivityFeed(supabase, {
      siteId,
      limit,
      startDate,
      endDate,
    })

    return NextResponse.json({ activities })
  } catch (error) {
    console.error("[recent-activity] Unexpected error:", error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
}
