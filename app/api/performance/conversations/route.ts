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

    // Get current period conversations count
    let currentQuery;
    
    if (segmentId && segmentId !== "all") {
      // Join with leads to filter by segment
      currentQuery = supabase
        .from("conversations")
        .select(`
          id,
          leads!inner(
            segment_id
          )
        `, { count: "exact", head: true })
        .eq("site_id", siteId)
        .eq("is_archived", false)
        .eq("leads.segment_id", segmentId)
        .gte("created_at", currentStart.toISOString())
        .lte("created_at", currentEnd.toISOString());
    } else {
      // No segment filter
      currentQuery = supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("site_id", siteId)
        .eq("is_archived", false)
        .gte("created_at", currentStart.toISOString())
        .lte("created_at", currentEnd.toISOString());
    }

    const { count: currentCount, error: currentError } = await currentQuery

    if (currentError) {
      console.error("Error fetching current conversations:", currentError)
      return NextResponse.json({ error: "Failed to fetch current conversations" }, { status: 500 })
    }

    // Get previous period conversations count
    let previousQuery;
    
    if (segmentId && segmentId !== "all") {
      // Join with leads to filter by segment
      previousQuery = supabase
        .from("conversations")
        .select(`
          id,
          leads!inner(
            segment_id
          )
        `, { count: "exact", head: true })
        .eq("site_id", siteId)
        .eq("is_archived", false)
        .eq("leads.segment_id", segmentId)
        .gte("created_at", previousStart.toISOString())
        .lte("created_at", previousEnd.toISOString());
    } else {
      // No segment filter
      previousQuery = supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("site_id", siteId)
        .eq("is_archived", false)
        .gte("created_at", previousStart.toISOString())
        .lte("created_at", previousEnd.toISOString());
    }

    const { count: previousCount, error: previousError } = await previousQuery

    if (previousError) {
      console.error("Error fetching previous conversations:", previousError)
      return NextResponse.json({ error: "Failed to fetch previous conversations" }, { status: 500 })
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
    console.error("Error in conversations API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}