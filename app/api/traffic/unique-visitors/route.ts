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
    console.log(`[UniqueVisitors API] Querying visitor_sessions for site_id: ${siteId}, dates: ${startDate} to ${endDate}`);
    
    // Get current period unique visitors
    const { data: currentData, error: currentError } = await supabase
      .from('visitor_sessions')
      .select('visitor_id')
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    console.log(`[UniqueVisitors API] Current query result:`, { 
      count: currentData?.length || 0, 
      error: currentError?.message || 'none' 
    });

    if (currentError) {
      console.log(`[UniqueVisitors API] Database error:`, currentError);
      return NextResponse.json({
        actual: 0,
        percentChange: 0,
        periodType: "monthly"
      });
    }

    // Count unique visitor IDs
    const uniqueVisitorIds = new Set(currentData?.map(session => session.visitor_id) || []);
    const currentUniqueVisitors = uniqueVisitorIds.size;
    
    console.log(`[UniqueVisitors API] Found ${currentUniqueVisitors} unique visitors`);
    
    // Calculate previous period for comparison
    const startDateObj = new Date(startDate!);
    const endDateObj = new Date(endDate!);
    const periodLength = endDateObj.getTime() - startDateObj.getTime();
    const previousStart = new Date(startDateObj.getTime() - periodLength);
    const previousEnd = new Date(startDateObj.getTime());

    console.log(`[UniqueVisitors API] Previous period: ${previousStart.toISOString()} to ${previousEnd.toISOString()}`);

    // Get previous period unique visitors
    const { data: previousData, error: previousError } = await supabase
      .from('visitor_sessions')
      .select('visitor_id')
      .eq('site_id', siteId)
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString());

    console.log(`[UniqueVisitors API] Previous query result:`, { 
      count: previousData?.length || 0, 
      error: previousError?.message || 'none' 
    });

    const previousUniqueVisitorIds = new Set(previousData?.map(session => session.visitor_id) || []);
    const previousUniqueVisitors = previousUniqueVisitorIds.size;
    
    // Calculate percentage change
    const percentChange = previousUniqueVisitors > 0 
      ? ((currentUniqueVisitors - previousUniqueVisitors) / previousUniqueVisitors) * 100 
      : 0;

    const response = {
      actual: currentUniqueVisitors,
      percentChange: Math.round(percentChange * 10) / 10,
      periodType: "monthly"
    };

    console.log(`[UniqueVisitors API] Returning real data:`, response);
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching unique visitors data:", error);
    
    // Return zero data instead of demo data
    return NextResponse.json({
      actual: 0,
      percentChange: 0,
      periodType: "monthly"
    });
  }
} 