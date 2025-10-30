import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get("siteId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const segmentId = searchParams.get("segmentId");

  if (!siteId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();
    
    // Calculate previous period for comparison
    const currentStart = new Date(startDate);
    const currentEnd = new Date(endDate);
    const periodLength = currentEnd.getTime() - currentStart.getTime();
    const previousEnd = new Date(currentStart.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - periodLength);

    // Get video instance_logs for current period
    let currentQuery = supabase
      .from("instance_logs")
      .select("duration_ms")
      .eq("site_id", siteId)
      .ilike("tool_name", "%video%")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    const { data: currentData, error: currentError } = await currentQuery;

    if (currentError) {
      console.error("Error fetching current video minutes:", currentError);
      return NextResponse.json({
        actual: 0,
        percentChange: 0,
        periodType: "monthly"
      });
    }

    // Get video instance_logs for previous period
    let previousQuery = supabase
      .from("instance_logs")
      .select("duration_ms")
      .eq("site_id", siteId)
      .ilike("tool_name", "%video%")
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());

    const { data: previousData, error: previousError } = await previousQuery;

    if (previousError) {
      console.error("Error fetching previous video minutes:", previousError);
    }

    // Calculate totals in minutes
    const currentTotalMs = currentData?.reduce((sum, log) => sum + (log.duration_ms || 0), 0) || 0;
    const previousTotalMs = previousData?.reduce((sum, log) => sum + (log.duration_ms || 0), 0) || 0;
    
    const currentMinutes = Math.round((currentTotalMs / 60000) * 10) / 10; // Convert to minutes with 1 decimal
    const previousMinutes = Math.round((previousTotalMs / 60000) * 10) / 10;
    
    const percentChange = previousMinutes > 0 
      ? ((currentMinutes - previousMinutes) / previousMinutes) * 100 
      : currentMinutes > 0 ? 100 : 0;

    return NextResponse.json({
      actual: currentMinutes,
      percentChange: Math.round(percentChange * 10) / 10,
      periodType: "monthly"
    });

  } catch (error) {
    console.error("Error in video minutes API:", error);
    return NextResponse.json({
      actual: 0,
      percentChange: 0,
      periodType: "monthly"
    });
  }
}
