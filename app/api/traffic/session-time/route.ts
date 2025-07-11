import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get("siteId");
  const userId = searchParams.get("userId");
  const segmentId = searchParams.get("segmentId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!siteId || !userId) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  const supabase = await createServiceClient(); // Use service client to bypass RLS for analytics data

  try {
    console.log(`[SessionTime API] Querying visitor_sessions for site_id: ${siteId}, dates: ${startDate} to ${endDate}`);
    
    // Get current period visitor sessions with duration data
    const { data: currentData, error: currentError } = await supabase
      .from('visitor_sessions')
      .select('duration, started_at, last_activity_at')
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('last_activity_at', 'is', null);

    console.log(`[SessionTime API] Current query result:`, { 
      count: currentData?.length || 0, 
      error: currentError?.message || 'none' 
    });

    if (currentError) {
      console.log(`[SessionTime API] Database error:`, currentError);
      return NextResponse.json({
        actual: 0,
        percentChange: 0,
        periodType: "monthly"
      });
    }

    // Calculate average session time for current period
    const calculateAverageSessionTime = (sessions: any[]) => {
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
    const { data: previousData, error: previousError } = await supabase
      .from('visitor_sessions')
      .select('duration, started_at, last_activity_at')
      .eq('site_id', siteId)
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString())
      .not('last_activity_at', 'is', null);

    console.log(`[SessionTime API] Previous query result:`, { 
      count: previousData?.length || 0, 
      error: previousError?.message || 'none' 
    });

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

  } catch (error) {
    console.error("Error fetching session time data:", error);
    
    // Return zero data instead of demo data
    return NextResponse.json({
      actual: 0,
      percentChange: 0,
      periodType: "monthly"
    });
  }
} 