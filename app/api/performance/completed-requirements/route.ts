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

    // Get current period completed requirements count
    let requirementsQuery = supabase
      .from("requirements")
      .select("id, updated_at, completion_status")
      .eq("site_id", siteId)
      .eq("completion_status", "completed")
      .gte("updated_at", startDate)
      .lte("updated_at", endDate)

    // Apply segment filter if not "all" - need to join with requirement_segments
    if (segmentId && segmentId !== "all") {
      requirementsQuery = requirementsQuery
        .select("id, updated_at, completion_status, requirement_segments!inner(segment_id)")
        .eq("requirement_segments.segment_id", segmentId)
    }

    const { data: requirementsData, error: requirementsError } = await requirementsQuery

    if (requirementsError) {
      console.error("Error fetching completed requirements:", requirementsError)
      return NextResponse.json({ error: "Failed to fetch completed requirements" }, { status: 500 })
    }

    // Get previous period completed requirements count
    let prevRequirementsQuery = supabase
      .from("requirements")
      .select("id, updated_at, completion_status")
      .eq("site_id", siteId)
      .eq("completion_status", "completed")
      .gte("updated_at", previousStart.toISOString())
      .lte("updated_at", previousEnd.toISOString())

    // Apply segment filter if not "all"
    if (segmentId && segmentId !== "all") {
      prevRequirementsQuery = prevRequirementsQuery
        .select("id, updated_at, completion_status, requirement_segments!inner(segment_id)")
        .eq("requirement_segments.segment_id", segmentId)
    }

    const { data: prevRequirementsData, error: prevRequirementsError } = await prevRequirementsQuery

    if (prevRequirementsError) {
      console.error("Error fetching previous completed requirements:", prevRequirementsError)
      return NextResponse.json({ error: "Failed to fetch previous completed requirements" }, { status: 500 })
    }

    const currentCount = requirementsData?.length || 0
    const previousCount = prevRequirementsData?.length || 0

    const percentChange = previousCount > 0 
      ? ((currentCount - previousCount) / previousCount) * 100 
      : currentCount > 0 ? 100 : 0

    return NextResponse.json({
      actual: currentCount,
      percentChange: Math.round(percentChange * 10) / 10,
      periodType: "monthly"
    })

  } catch (error) {
    console.error("Error in completed requirements API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
