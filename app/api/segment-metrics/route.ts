import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface SegmentMetrics {
  visitors: {
    current: number;
    previous: number;
    percentChange: number;
  };
  clicks: {
    current: number;
    previous: number;
    percentChange: number;
  };
  conversions: {
    current: number;
    previous: number;
    percentChange: number;
  };
  ctr: {
    current: number;
    previous: number;
    percentChange: number;
  };
  periodType: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const segmentId = searchParams.get("segmentId");
  const siteId = searchParams.get("siteId");
  const userId = searchParams.get("userId");
  
  if (!siteId) {
    console.error("[Segment Metrics API] Missing required parameters");
    return NextResponse.json(
      { error: "Site ID is required" },
      { status: 400 }
    );
  }
  
  try {
    const supabase = await createClient();
    console.log(`[Segment Metrics API] Fetching metrics for segment: ${segmentId || 'ALL'}, site: ${siteId}`);
    
    // 1. Get Visitors (unique visitors from session_events)
    let visitorsQuery = supabase
      .from("session_events")
      .select("visitor_id")
      .eq("site_id", siteId)
      .not("visitor_id", "is", null);

    if (segmentId) {
      visitorsQuery = visitorsQuery.eq("segment_id", segmentId);
    }
    
    // 2. Get Clicks (click events from session_events)
    let clicksQuery = supabase
      .from("session_events")
      .select("id")
      .eq("site_id", siteId)
      .eq("event_type", "click");

    if (segmentId) {
      clicksQuery = clicksQuery.eq("segment_id", segmentId);
    }
    
    // 3. Get Conversions (leads with status 'converted')
    let conversionsQuery = supabase
      .from("leads")
      .select("id")
      .eq("site_id", siteId)
      .eq("status", "converted");
    
    if (segmentId) {
      conversionsQuery = conversionsQuery.eq("segment_id", segmentId);
    }
    

    
    // Execute all queries in parallel
    const [
      visitorsResult,
      clicksResult,
      conversionsResult
    ] = await Promise.all([
      visitorsQuery,
      clicksQuery,
      conversionsQuery
    ]);
    
    // Check for errors
    if (visitorsResult.error) {
      console.error("[Segment Metrics API] Error fetching visitors:", visitorsResult.error);
      throw visitorsResult.error;
    }
    
    if (clicksResult.error) {
      console.error("[Segment Metrics API] Error fetching clicks:", clicksResult.error);
      throw clicksResult.error;
    }
    
    if (conversionsResult.error) {
      console.error("[Segment Metrics API] Error fetching conversions:", conversionsResult.error);
      throw conversionsResult.error;
    }
    
    // Calculate unique visitors
    const currentVisitors = new Set(visitorsResult.data?.map((v: any) => v.visitor_id).filter(Boolean)).size;
    
    // Calculate clicks
    const currentClicks = clicksResult.data?.length || 0;
    
    // Calculate conversions
    const currentConversions = conversionsResult.data?.length || 0;
    
    // Calculate CTR (conversions / visitors * 100)
    const currentCTR = currentVisitors > 0 ? (currentConversions / currentVisitors) * 100 : 0;
    
    const metrics: SegmentMetrics = {
      visitors: {
        current: currentVisitors,
        previous: 0, // No previous period for now
        percentChange: 0
      },
      clicks: {
        current: currentClicks,
        previous: 0, // No previous period for now
        percentChange: 0
      },
      conversions: {
        current: currentConversions,
        previous: 0, // No previous period for now
        percentChange: 0
      },
      ctr: {
        current: parseFloat(currentCTR.toFixed(2)),
        previous: 0, // No previous period for now
        percentChange: 0
      },
      periodType: "all-time"
    };
    
    console.log(`[Segment Metrics API] Raw counts:`, {
      visitorsData: `total: ${visitorsResult.data?.length || 0}`,
      clicksData: `total: ${clicksResult.data?.length || 0}`,
      conversionsData: `total: ${conversionsResult.data?.length || 0}`
    });

    console.log(`[Segment Metrics API] Calculated metrics:`, {
      visitors: `${currentVisitors}`,
      clicks: `${currentClicks}`,
      conversions: `${currentConversions}`,
      ctr: `${currentCTR.toFixed(2)}%`
    });
    
    return NextResponse.json(metrics);
    
  } catch (error) {
    console.error("Error in segment metrics API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 