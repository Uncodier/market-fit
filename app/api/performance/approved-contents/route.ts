import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("siteId")
    const userId = searchParams.get("userId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const segmentId = searchParams.get("segmentId")

    if (!siteId || !userId || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Calculate previous period for comparison
    const currentStart = new Date(startDate)
    const currentEnd = new Date(endDate)
    const periodLength = currentEnd.getTime() - currentStart.getTime()
    const previousEnd = new Date(currentStart.getTime() - 1)
    const previousStart = new Date(previousEnd.getTime() - periodLength)

    // Get current period approved contents count
    let contentsQuery = supabase
      .from("content")
      .select("id, updated_at, segment_id")
      .eq("site_id", siteId)
      .eq("status", "approved")
      .gte("updated_at", startDate)
      .lte("updated_at", endDate)

    // Apply segment filter if not "all"
    if (segmentId && segmentId !== "all") {
      contentsQuery = contentsQuery.eq("segment_id", segmentId)
    }

    const { data: contentsData, error: contentsError } = await contentsQuery

    if (contentsError) {
      console.error("Error fetching approved contents:", contentsError)
      return NextResponse.json({ error: "Failed to fetch approved contents" }, { status: 500 })
    }

    // Get previous period approved contents count
    let prevContentsQuery = supabase
      .from("content")
      .select("id, updated_at, segment_id")
      .eq("site_id", siteId)
      .eq("status", "approved")
      .gte("updated_at", previousStart.toISOString())
      .lte("updated_at", previousEnd.toISOString())

    // Apply segment filter if not "all"
    if (segmentId && segmentId !== "all") {
      prevContentsQuery = prevContentsQuery.eq("segment_id", segmentId)
    }

    const { data: prevContentsData, error: prevContentsError } = await prevContentsQuery

    if (prevContentsError) {
      console.error("Error fetching previous approved contents:", prevContentsError)
      return NextResponse.json({ error: "Failed to fetch previous approved contents" }, { status: 500 })
    }

    const currentCount = contentsData?.length || 0
    const previousCount = prevContentsData?.length || 0

    const percentChange = previousCount > 0 
      ? ((currentCount - previousCount) / previousCount) * 100 
      : currentCount > 0 ? 100 : 0

    return NextResponse.json({
      actual: currentCount,
      percentChange: Math.round(percentChange * 10) / 10,
      periodType: "monthly"
    })

  } catch (error) {
    console.error("Error in approved contents API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
