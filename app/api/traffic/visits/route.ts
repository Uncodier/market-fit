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
    console.log(`[Visits API] Querying visitor_sessions for site_id: ${siteId}, dates: ${startDate} to ${endDate}`);
    
    // Get current period visits from visitor_sessions
    const { data: currentSessions, error: currentError } = await supabase
      .from('visitor_sessions')
      .select('id')
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    console.log(`[Visits API] Current query result:`, { 
      count: currentSessions?.length || 0, 
      error: currentError?.message || 'none' 
    });

    if (currentError) {
      console.log(`[Visits API] Database error:`, currentError);
      return NextResponse.json({
        actual: 0,
        percentChange: 0,
        periodType: "monthly"
      });
    }

    const currentVisits = currentSessions?.length || 0;
    
    // Calculate previous period for comparison
    const startDateObj = new Date(startDate!);
    const endDateObj = new Date(endDate!);
    const periodLength = endDateObj.getTime() - startDateObj.getTime();
    const previousStart = new Date(startDateObj.getTime() - periodLength);
    const previousEnd = new Date(startDateObj.getTime());

    console.log(`[Visits API] Previous period: ${previousStart.toISOString()} to ${previousEnd.toISOString()}`);

    // Get previous period visits
    const { data: previousSessions, error: previousError } = await supabase
      .from('visitor_sessions')
      .select('id')
      .eq('site_id', siteId)
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString());

    console.log(`[Visits API] Previous query result:`, { 
      count: previousSessions?.length || 0, 
      error: previousError?.message || 'none' 
    });

    const previousVisits = previousSessions?.length || 0;
    
    // Calculate percentage change
    const percentChange = previousVisits > 0 
      ? ((currentVisits - previousVisits) / previousVisits) * 100 
      : 0;

    const response = {
      actual: currentVisits,
      percentChange: Math.round(percentChange * 10) / 10,
      periodType: "monthly"
    };

    console.log(`[Visits API] Returning real data:`, response);
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching visits data:", error);
    
    // Return zero data instead of demo data
    return NextResponse.json({
      actual: 0,
      percentChange: 0,
      periodType: "monthly"
    });
  }
} 