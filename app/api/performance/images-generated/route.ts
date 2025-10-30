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

    // Get image instance_logs for current period
    let currentQuery = supabase
      .from("instance_logs")
      .select("id")
      .eq("site_id", siteId)
      .ilike("tool_name", "%image%")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    const { data: currentData, error: currentError } = await currentQuery;

    if (currentError) {
      console.error("Error fetching current images generated:", currentError);
      return NextResponse.json({
        actual: 0,
        percentChange: 0,
        periodType: "monthly"
      });
    }

    // Get image instance_logs for previous period
    let previousQuery = supabase
      .from("instance_logs")
      .select("id")
      .eq("site_id", siteId)
      .ilike("tool_name", "%image%")
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());

    const { data: previousData, error: previousError } = await previousQuery;

    if (previousError) {
      console.error("Error fetching previous images generated:", previousError);
    }

    const currentCount = currentData?.length || 0;
    const previousCount = previousData?.length || 0;
    
    const percentChange = previousCount > 0 
      ? ((currentCount - previousCount) / previousCount) * 100 
      : currentCount > 0 ? 100 : 0;

    return NextResponse.json({
      actual: currentCount,
      percentChange: Math.round(percentChange * 10) / 10,
      periodType: "monthly"
    });

  } catch (error) {
    console.error("Error in images generated API:", error);
    return NextResponse.json({
      actual: 0,
      percentChange: 0,
      periodType: "monthly"
    });
  }
}
