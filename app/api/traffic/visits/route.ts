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
      error: previousError?.message || 'none' 
    });

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