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
    console.log(`[LeadConversion API] Querying visitor_sessions for site_id: ${siteId}, dates: ${startDate} to ${endDate}`);
    
    // Get current period visitor sessions and count those with lead_id
    const { data: currentData, error: currentError } = await supabase
      .from('visitor_sessions')
      .select('visitor_id, lead_id')
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    console.log(`[LeadConversion API] Current query result:`, { 
      count: currentData?.length || 0, 
      error: currentError?.message || 'none' 
    });

    if (currentError) {
      console.log(`[LeadConversion API] Database error:`, currentError);
      return NextResponse.json({
        actual: 0,
        percentChange: 0,
        periodType: "monthly"
      });
    }

    // Count unique visitors and unique visitors who became leads
    const uniqueVisitors = new Set(currentData?.map(session => session.visitor_id) || []);
    const uniqueLeads = new Set(currentData?.filter(session => session.lead_id).map(session => session.visitor_id) || []);
    
    const visitorCount = uniqueVisitors.size;
    const leadCount = uniqueLeads.size;
    
    const currentConversionRate = visitorCount > 0 ? (leadCount / visitorCount) * 100 : 0;
    
    console.log(`[LeadConversion API] Found ${visitorCount} unique visitors, ${leadCount} became leads. Rate: ${currentConversionRate}%`);
    
    // Calculate previous period for comparison
    const startDateObj = new Date(startDate!);
    const endDateObj = new Date(endDate!);
    const periodLength = endDateObj.getTime() - startDateObj.getTime();
    const previousStart = new Date(startDateObj.getTime() - periodLength);
    const previousEnd = new Date(startDateObj.getTime());

    console.log(`[LeadConversion API] Previous period: ${previousStart.toISOString()} to ${previousEnd.toISOString()}`);

    // Get previous period data
    const { data: previousData, error: previousError } = await supabase
      .from('visitor_sessions')
      .select('visitor_id, lead_id')
      .eq('site_id', siteId)
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString());

    console.log(`[LeadConversion API] Previous query result:`, { 
      count: previousData?.length || 0, 
      error: previousError?.message || 'none' 
    });

    const previousUniqueVisitors = new Set(previousData?.map(session => session.visitor_id) || []);
    const previousUniqueLeads = new Set(previousData?.filter(session => session.lead_id).map(session => session.visitor_id) || []);
    
    const previousVisitorCount = previousUniqueVisitors.size;
    const previousLeadCount = previousUniqueLeads.size;
    
    const previousConversionRate = previousVisitorCount > 0 ? (previousLeadCount / previousVisitorCount) * 100 : 0;
    
    // Calculate percentage change
    let percentChange = 0;
    if (previousConversionRate > 0) {
      // Normal calculation when there's previous data
      percentChange = ((currentConversionRate - previousConversionRate) / previousConversionRate) * 100;
    } else if (currentConversionRate > 0) {
      // If no previous data but current data exists, show 100% growth
      percentChange = 100;
    }
    // If both are 0, percentChange remains 0

    const response = {
      actual: Math.round(currentConversionRate * 10) / 10,
      percentChange: Math.round(percentChange * 10) / 10,
      periodType: "monthly"
    };

    console.log(`[LeadConversion API] Returning real data:`, response);
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching lead conversion data:", error);
    
    // Return zero data instead of demo data
    return NextResponse.json({
      actual: 0,
      percentChange: 0,
      periodType: "monthly"
    });
  }
} 