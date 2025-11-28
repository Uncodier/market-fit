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

    // Get meetings in current period
    // Include tasks with specific types (call, meeting, website_visit, demo, onboarding) OR stage='consideration'
    let currentQuery;
    if (segmentId && segmentId !== "all") {
      // Join with leads to filter by segment
      currentQuery = supabase
        .from("tasks")
        .select(`
          id,
          leads!inner(
            segment_id
          )
        `)
        .eq("site_id", siteId)
        .or("type.in.(call,meeting,website_visit,demo,onboarding),stage.eq.consideration")
        .eq("leads.segment_id", segmentId)
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate);
    } else {
      currentQuery = supabase
        .from("tasks")
        .select("id")
        .eq("site_id", siteId)
        .or("type.in.(call,meeting,website_visit,demo,onboarding),stage.eq.consideration")
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate);
    }

    const { data: currentData, error: currentError } = await currentQuery;

    if (currentError) {
      console.error("Error fetching current meetings:", currentError);
      return NextResponse.json({
        actual: 0,
        percentChange: 0,
        periodType: "monthly"
      });
    }

    // Get meetings in previous period
    // Include tasks with specific types (call, meeting, website_visit, demo, onboarding) OR stage='consideration'
    let previousQuery;
    if (segmentId && segmentId !== "all") {
      // Join with leads to filter by segment
      previousQuery = supabase
        .from("tasks")
        .select(`
          id,
          leads!inner(
            segment_id
          )
        `)
        .eq("site_id", siteId)
        .or("type.in.(call,meeting,website_visit,demo,onboarding),stage.eq.consideration")
        .eq("leads.segment_id", segmentId)
        .gte("scheduled_date", previousStart.toISOString())
        .lte("scheduled_date", previousEnd.toISOString());
    } else {
      previousQuery = supabase
        .from("tasks")
        .select("id")
        .eq("site_id", siteId)
        .or("type.in.(call,meeting,website_visit,demo,onboarding),stage.eq.consideration")
        .gte("scheduled_date", previousStart.toISOString())
        .lte("scheduled_date", previousEnd.toISOString());
    }

    const { data: previousData, error: previousError } = await previousQuery;

    if (previousError) {
      console.error("Error fetching previous meetings:", previousError);
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
    console.error("Error in meetings API:", error);
    return NextResponse.json({
      actual: 0,
      percentChange: 0,
      periodType: "monthly"
    });
  }
}
