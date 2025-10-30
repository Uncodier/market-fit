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

    // Get leads with messages FROM them in current period
    let currentQuery = supabase
      .from("leads")
      .select(`
        id,
        conversations!inner(
          id,
          messages!inner(
            id,
            created_at,
            role
          )
        )
      `)
      .eq("site_id", siteId)
      .eq("conversations.messages.role", "user")
      .gte("conversations.messages.created_at", startDate)
      .lte("conversations.messages.created_at", endDate);

    if (segmentId && segmentId !== "all") {
      currentQuery = currentQuery.eq("segment_id", segmentId);
    }

    const { data: currentData, error: currentError } = await currentQuery;

    if (currentError) {
      console.error("Error fetching current leads in conversation:", currentError);
      return NextResponse.json({
        actual: 0,
        percentChange: 0,
        periodType: "monthly"
      });
    }

    // Get leads with messages FROM them in previous period
    let previousQuery = supabase
      .from("leads")
      .select(`
        id,
        conversations!inner(
          id,
          messages!inner(
            id,
            created_at,
            role
          )
        )
      `)
      .eq("site_id", siteId)
      .eq("conversations.messages.role", "user")
      .gte("conversations.messages.created_at", previousStart.toISOString())
      .lte("conversations.messages.created_at", previousEnd.toISOString());

    if (segmentId && segmentId !== "all") {
      previousQuery = previousQuery.eq("segment_id", segmentId);
    }

    const { data: previousData, error: previousError } = await previousQuery;

    if (previousError) {
      console.error("Error fetching previous leads in conversation:", previousError);
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
    console.error("Error in leads in conversation API:", error);
    return NextResponse.json({
      actual: 0,
      percentChange: 0,
      periodType: "monthly"
    });
  }
}
