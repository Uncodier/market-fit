import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access";
import { readThroughAnalyticsResponseCache } from "@/lib/redis/analytics-response-cache";
import type { QueryResult } from "@/app/api/_shared/query-result";

type SessionDuration = { duration: number | null; started_at: number | null; last_activity_at: number | null };

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get("siteId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const access = await requireAnalyticsAccess(request);
  if (access.error) return access.error;

  return readThroughAnalyticsResponseCache({
    request,
    namespace: "traffic:session-time:v2",
    siteId: access.siteId,
    load: async () => {
  try {
    const supabase = await createServiceClient();
    console.log(`[SessionTime API] Querying visitor_sessions for site_id: ${siteId}, dates: ${startDate} to ${endDate}`);
    
    // Get current period visitor sessions with duration data
    const { data: currentData, error: currentError }: QueryResult<SessionDuration[]> = await supabase
      .from('visitor_sessions')
      .select('duration, started_at, last_activity_at')
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('last_activity_at', 'is', null);

    console.log(`[SessionTime API] Current query result:`, { 
      count: currentData?.length || 0, 
      hasError: Boolean(currentError)
    });

    if (currentError) {
      throw new Error("Current session time query failed");
    }

    // Calculate average session time for current period
    const calculateAverageSessionTime = (sessions: SessionDuration[]) => {
      if (!sessions || sessions.length === 0) return 0;
      
      const totalTime = sessions.reduce((sum, session) => {
        let durationInSeconds = 0;
        
        // Use the duration column if available (already in seconds)
        if (session.duration && session.duration > 0) {
          durationInSeconds = session.duration;
        } else if (session.started_at && session.last_activity_at) {
          // Calculate duration from timestamps (bigint timestamps are in milliseconds)
          const startTime = session.started_at;
          const endTime = session.last_activity_at;
          durationInSeconds = Math.max(0, (endTime - startTime) / 1000);
        }
        
        // Cap at 1 hour per session for realistic averages
        return sum + Math.min(durationInSeconds, 3600);
      }, 0);
      
      return totalTime / sessions.length;
    };

    const currentAvgTime = calculateAverageSessionTime(currentData || []);
    
    console.log(`[SessionTime API] Found ${currentData?.length || 0} sessions, avg time: ${currentAvgTime}`);
    
    // Calculate previous period for comparison
    const startDateObj = new Date(startDate!);
    const endDateObj = new Date(endDate!);
    const periodLength = endDateObj.getTime() - startDateObj.getTime();
    const previousStart = new Date(startDateObj.getTime() - periodLength);
    const previousEnd = new Date(startDateObj.getTime());

    console.log(`[SessionTime API] Previous period: ${previousStart.toISOString()} to ${previousEnd.toISOString()}`);

    // Get previous period sessions
    const { data: previousData, error: previousError }: QueryResult<SessionDuration[]> = await supabase
      .from('visitor_sessions')
      .select('duration, started_at, last_activity_at')
      .eq('site_id', siteId)
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString())
      .not('last_activity_at', 'is', null);

    console.log(`[SessionTime API] Previous query result:`, { 
      count: previousData?.length || 0, 
      hasError: Boolean(previousError)
    });

    if (previousError) {
      throw new Error("Previous session time query failed");
    }

    const previousAvgTime = calculateAverageSessionTime(previousData || []);
    
    // Calculate percentage change
    const percentChange = previousAvgTime > 0 
      ? ((currentAvgTime - previousAvgTime) / previousAvgTime) * 100 
      : 0;

    const response = {
      actual: Math.round(currentAvgTime),
      percentChange: Math.round(percentChange * 10) / 10,
      periodType: "monthly"
    };

    console.log(`[SessionTime API] Returning real data:`, response);
    return NextResponse.json(response);

  } catch {
    console.error("[SessionTime API] Unable to load session time report");
    return NextResponse.json({ error: "Unable to load session time report" }, { status: 500 });
  }
    },
  });
} 