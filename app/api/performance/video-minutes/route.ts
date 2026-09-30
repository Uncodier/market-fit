import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access";
import { readThroughAnalyticsResponseCache } from "@/lib/redis/analytics-response-cache";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get("siteId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const segmentId = searchParams.get("segmentId");

  if (!siteId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  const access = await requireAnalyticsAccess(request);
  if (access.error) return access.error;

  return readThroughAnalyticsResponseCache({
    request,
    namespace: "performance:video-minutes:v2",
    siteId: access.siteId,
    load: async () => {
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
      return NextResponse.json({ error: "Failed to load video minutes" }, { status: 500 });
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
      return NextResponse.json({ error: "Failed to load video minutes" }, { status: 500 });
    }

    // Calculate totals in minutes
    const sumDuration = (sum: number, log: { duration_ms: number | null }) => sum + (log.duration_ms || 0);
    const currentTotalMs = currentData?.reduce(sumDuration, 0) || 0;
    const previousTotalMs = previousData?.reduce(sumDuration, 0) || 0;
    
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
    return NextResponse.json({ error: "Failed to load video minutes" }, { status: 500 });
  }
    },
  });
}
