import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = await createServiceClient()

  const { searchParams } = new URL(request.url)
  const siteId = searchParams.get("siteId")
  const userId = searchParams.get("userId")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const segmentId = searchParams.get("segmentId")

  if (!siteId || !userId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
  }

  try {
    const currentStart = new Date(startDate)
    const currentEnd = new Date(endDate)
    const periodLength = currentEnd.getTime() - currentStart.getTime()
    const previousEnd = new Date(currentStart.getTime() - 1)
    const previousStart = new Date(previousEnd.getTime() - periodLength)

    // Get current period completed requirements count
    let currentQuery = supabase
      .from("requirements")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .eq("completion_status", "completed")
      .gte("created_at", currentStart.toISOString())
      .lte("created_at", currentEnd.toISOString())

    // Apply segment filter if not 'all' - requirements don't have direct segment relationship
    // We'll need to join with requirement_segments table if segment filtering is needed
    if (segmentId && segmentId !== "all") {
      currentQuery = currentQuery
        .select("id, requirement_segments!inner(segment_id)", { count: "exact", head: true })
        .eq("requirement_segments.segment_id", segmentId)
    }

    const { count: currentCount, error: currentError } = await currentQuery

    if (currentError) {
      console.error("Error fetching current completed requirements:", currentError)
      return NextResponse.json({ error: "Failed to fetch current completed requirements" }, { status: 500 })
    }

    // Get previous period completed requirements count
    let previousQuery = supabase
      .from("requirements")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .eq("completion_status", "completed")
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString())

    // Apply segment filter if not 'all'
    if (segmentId && segmentId !== "all") {
      previousQuery = previousQuery
        .select("id, requirement_segments!inner(segment_id)", { count: "exact", head: true })
        .eq("requirement_segments.segment_id", segmentId)
    }

    const { count: previousCount, error: previousError } = await previousQuery

    if (previousError) {
      console.error("Error fetching previous completed requirements:", previousError)
      return NextResponse.json({ error: "Failed to fetch previous completed requirements" }, { status: 500 })
    }

    const actual = currentCount || 0
    const previous = previousCount || 0
    const percentChange = previous > 0 
      ? ((actual - previous) / previous) * 100 
      : actual > 0 ? 100 : 0

    return NextResponse.json({
      actual,
      percentChange: Math.round(percentChange * 10) / 10,
      periodType: "monthly"
    })

  } catch (error) {
    console.error("Error in requirements-completed API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
