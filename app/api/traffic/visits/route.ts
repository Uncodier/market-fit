import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access";
import { readThroughAnalyticsResponseCache } from "@/lib/redis/analytics-response-cache";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get("siteId");
  const segmentId = searchParams.get("segmentId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const access = await requireAnalyticsAccess(request);
  if (access.error) return access.error;

  return readThroughAnalyticsResponseCache({
    request,
    namespace: "traffic:visits:v2",
    siteId: access.siteId,
    load: async () => {
  try {
    const supabase = await createServiceClient();
    console.log(`[Visits API] Querying visitor_sessions for site_id: ${siteId}, dates: ${startDate} to ${endDate}`);
    
    // Build query for current period visits
    let currentQuery = supabase
      .from('visitor_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (segmentId && segmentId !== 'all') {
      currentQuery = currentQuery.eq('segment_id', segmentId);
    }

    const { count: currentVisits, error: currentError } = await currentQuery;

    console.log(`[Visits API] Current query result:`, { 
      count: currentVisits || 0, 
      hasError: Boolean(currentError)
    });

    if (currentError) {
      throw new Error("Current visits query failed");
    }

    const actualVisits = currentVisits || 0;
    
    // Calculate previous period for comparison
    const startDateObj = new Date(startDate!);
    const endDateObj = new Date(endDate!);
    const periodLength = endDateObj.getTime() - startDateObj.getTime();
    const previousStart = new Date(startDateObj.getTime() - periodLength);
    const previousEnd = new Date(startDateObj.getTime());

    console.log(`[Visits API] Previous period: ${previousStart.toISOString()} to ${previousEnd.toISOString()}`);

    // Build query for previous period visits
    let previousQuery = supabase
      .from('visitor_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString());

    if (segmentId && segmentId !== 'all') {
      previousQuery = previousQuery.eq('segment_id', segmentId);
    }

    const { count: previousVisits, error: previousError } = await previousQuery;

    console.log(`[Visits API] Previous query result:`, { 
      count: previousVisits || 0, 
      hasError: Boolean(previousError)
    });

    if (previousError) {
      throw new Error("Previous visits query failed");
    }

    const prevVisitsCount = previousVisits || 0;
    
    // Calculate percentage change
    const percentChange = prevVisitsCount > 0 
      ? ((actualVisits - prevVisitsCount) / prevVisitsCount) * 100 
      : 0;

    const response = {
      actual: actualVisits,
      percentChange: Math.round(percentChange * 10) / 10,
      periodType: "monthly"
    };

    console.log(`[Visits API] Returning real data:`, response);
    return NextResponse.json(response);

  } catch {
    console.error("[Visits API] Unable to load visits report");
    return NextResponse.json({ error: "Unable to load visits report" }, { status: 500 });
  }
    },
  });
} 