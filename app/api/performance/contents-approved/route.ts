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

    // Get current period approved contents count
    let currentQuery = supabase
      .from("content")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .eq("status", "approved")
      .gte("created_at", currentStart.toISOString())
      .lte("created_at", currentEnd.toISOString())

    // Apply segment filter if not 'all'
    if (segmentId && segmentId !== "all") {
      currentQuery = currentQuery.eq("segment_id", segmentId)
    }

    const { count: currentCount, error: currentError } = await currentQuery

    if (currentError) {
      console.error("Error fetching current approved contents:", currentError)
      return NextResponse.json({ error: "Failed to fetch current approved contents" }, { status: 500 })
    }

    // Get previous period approved contents count
    let previousQuery = supabase
      .from("content")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .eq("status", "approved")
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString())

    // Apply segment filter if not 'all'
    if (segmentId && segmentId !== "all") {
      previousQuery = previousQuery.eq("segment_id", segmentId)
    }

    const { count: previousCount, error: previousError } = await previousQuery

    if (previousError) {
      console.error("Error fetching previous approved contents:", previousError)
      return NextResponse.json({ error: "Failed to fetch previous approved contents" }, { status: 500 })
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
    console.error("Error in contents-approved API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
