import { NextResponse } from "next/server"
import { createServiceApiClient } from "@/lib/supabase/server-client"
import { format, subDays, subMonths, formatDate } from "date-fns"

// Function to verify segment exists for the given site
async function verifySegmentForSite(supabase: any, segmentId: string, siteId: string) {
  const { data: segment, error } = await supabase
    .from("segments")
    .select("id")
    .eq("id", segmentId)
    .eq("site_id", siteId)
    .maybeSingle()

  if (error || !segment) {
    console.error(`[Visitor Cohorts API] Segment verification failed:`, error)
    return false
  }
  return true
}

// Function to get segment details
async function getSegmentDetails(supabase: any, segmentId: string) {
  const { data: segment, error } = await supabase
    .from("segments")
    .select("*")
    .eq("id", segmentId)
    .maybeSingle()

  if (error || !segment) {
    console.error(`[Visitor Cohorts API] Getting segment details failed:`, error)
    return null
  }
  return segment
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const segmentId = searchParams.get("segmentId");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const siteId = searchParams.get("siteId");
  const userId = searchParams.get("userId");
  
  if (!siteId) {
    console.error("[Visitor Cohorts API] Missing site ID");
    return NextResponse.json(
      { error: "Site ID is required" },
      { status: 400 }
    );
  }
  
  try {
    console.log(`[Visitor Cohorts API] Received request for site: ${siteId}, segment: ${segmentId || 'all'}`);
    
    // Use service client with appropriate permissions
    const supabase = createServiceApiClient();
    
    // Verify that the site exists before continuing
    const { data: siteData, error: siteError } = await supabase
      .from("sites")
      .select("id")
      .eq("id", siteId)
      .maybeSingle();
      
    if (siteError || !siteData) {
      console.error(`[Visitor Cohorts API] Site not found: ${siteId}`, siteError);
      return NextResponse.json({ visitorCohorts: [] });
    }
    
    console.log(`[Visitor Cohorts API] Site found: ${siteId}`);
    
    // Parameters for dates
    const startDate = startDateParam ? new Date(startDateParam) : subDays(new Date(), 30);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Cohorts always use weekly periods - date range only affects data scope
    const periodType = 'week'; // Always weekly for consistent cohort analysis
    
    console.log(`[Visitor Cohorts API] Using ${periodType} periods (always weekly for cohorts)`);
    
    // Get visitor sessions for the site
    let visitorQuery = supabase
      .from("visitor_sessions")
      .select("id, visitor_id, started_at, site_id")
      .eq("site_id", siteId);
      
    // Apply date filters if available
    if (startDateParam) {
      visitorQuery = visitorQuery.gte("started_at", Math.floor(startDate.getTime()));
    }
    if (endDateParam) {
      visitorQuery = visitorQuery.lte("started_at", Math.floor(endDate.getTime()));
    }
    
    const { data: visitorSessions, error: visitorError } = await visitorQuery.limit(10000);
    
    if (visitorError) {
      console.error(`[Visitor Cohorts API] Error fetching visitor sessions:`, visitorError);
      return NextResponse.json({ visitorCohorts: [] });
    }
    
    if (!visitorSessions || visitorSessions.length === 0) {
      console.log(`[Visitor Cohorts API] No visitor sessions for the specified period - returning empty array`);
      return NextResponse.json({ visitorCohorts: [] });
    }
    
    console.log(`[Visitor Cohorts API] Found ${visitorSessions.length} visitor sessions for the site`);
    
    // If a specific segment is requested, filter by segment
    if (segmentId && segmentId !== "all") {
      // Verify the segment exists and belongs to the site
      const isValidSegment = await verifySegmentForSite(supabase, segmentId, siteId);
      if (!isValidSegment) {
        console.log(`[Visitor Cohorts API] Segment ${segmentId} not found or not valid for site ${siteId}`);
        return NextResponse.json({ visitorCohorts: [] });
      }
      
      // Get visitors that belong to the segment
      const { data: segmentVisitors, error: segmentError } = await supabase
        .from("visitors")
        .select("id")
        .eq("segment_id", segmentId);
        
      if (segmentError) {
        console.error(`[Visitor Cohorts API] Error fetching segment visitors:`, segmentError);
        return NextResponse.json({ visitorCohorts: [] });
      }
      
      if (!segmentVisitors || segmentVisitors.length === 0) {
        console.log(`[Visitor Cohorts API] No visitors found for segment ${segmentId}`);
        return NextResponse.json({ visitorCohorts: [] });
      }
      
             const segmentVisitorIds = segmentVisitors.map((v: any) => v.id);
       // Filter sessions to only include those from segment visitors
       const filteredSessions = visitorSessions.filter((session: any) => 
         segmentVisitorIds.includes(session.visitor_id)
       );
      
      console.log(`[Visitor Cohorts API] Filtered to ${filteredSessions.length} sessions for segment ${segmentId}`);
      // Update the sessions array with filtered results
      visitorSessions.splice(0, visitorSessions.length, ...filteredSessions);
    }
    
    // Function to format period - always weekly for cohorts
    const formatPeriod = (date: Date) => {
      return `W${formatDate(date, "w")} ${formatDate(date, "yyyy")}`;
    };
    
    // Generate periods for the last 8 weeks - always weekly for cohorts
    const now = new Date();
    console.log(`[Visitor Cohorts API] Current date: ${now.toISOString()}`);
    let cohortPeriods: { cohort: string, date: Date }[] = [];
    
    for (let i = 0; i < 8; i++) {
      const date = subDays(now, i * 7); // Always weekly intervals
      
      cohortPeriods.push({
        cohort: formatPeriod(date),
        date
      });
    }
    
    console.log(`[Visitor Cohorts API] Generated ${cohortPeriods.length} cohort periods: ${cohortPeriods.map(p => p.cohort).join(', ')}`);
    
    // FIXED: Organize visitor sessions and calculate proper retention
    const sessionsByPeriod = new Map<string, Set<string>>();
    const periodsWithSessions = new Set<string>();
    const visitorFirstSeen = new Map<string, string>(); // visitor_id -> first_period
    
    // Convert started_at (timestamp) to Date and group by period
    visitorSessions.forEach((session: any) => {
      // started_at is a bigint timestamp, convert to Date
      const sessionDate = new Date(parseInt(session.started_at));
      const period = formatPeriod(sessionDate);
      
      if (!sessionsByPeriod.has(period)) {
        sessionsByPeriod.set(period, new Set());
      }
      
      sessionsByPeriod.get(period)!.add(session.visitor_id);
      periodsWithSessions.add(period);
      
      // Track first time we see each visitor (earliest period)
      if (!visitorFirstSeen.has(session.visitor_id)) {
        visitorFirstSeen.set(session.visitor_id, period);
      } else {
        const currentFirst = visitorFirstSeen.get(session.visitor_id)!;
        const currentFirstIndex = cohortPeriods.findIndex(p => p.cohort === currentFirst);
        const newPeriodIndex = cohortPeriods.findIndex(p => p.cohort === period);
        
        // If this period is earlier (higher index = older), update first seen
        if (newPeriodIndex > currentFirstIndex) {
          visitorFirstSeen.set(session.visitor_id, period);
        }
      }
    });
    
    console.log(`[Visitor Cohorts API] Found sessions in periods: ${Array.from(periodsWithSessions).join(', ')}`);
    console.log(`[Visitor Cohorts API] Tracking first visits for ${visitorFirstSeen.size} unique visitors`);
    
    // Debug: Log some sample session dates
    if (visitorSessions.length > 0) {
      const sampleSession = visitorSessions[0];
      const sampleDate = new Date(parseInt(sampleSession.started_at));
      console.log(`[Visitor Cohorts API] Sample session date: ${sampleDate.toISOString()} (${formatPeriod(sampleDate)})`);
    }
    
    // FIXED: Calculate proper cohort retention
    const visitorCohorts = cohortPeriods.map((cohort, cohortIndex) => {
      const cohortKey = cohort.cohort;
      
      // Get visitors who FIRST visited in this cohort period
      const cohortVisitors = new Set<string>();
      visitorFirstSeen.forEach((firstPeriod, visitorId) => {
        if (firstPeriod === cohortKey) {
          cohortVisitors.add(visitorId);
        }
      });
      
      const originalCount = cohortVisitors.size;
      
      // If no new visitors in this cohort period, return empty data
      if (originalCount === 0) {
        return {
          cohort: cohortKey,
          periods: Array(cohortIndex + 1).fill(0).map((_, i) => i === 0 ? null : 0)
        };
      }
      
      console.log(`[Visitor Cohorts API] Cohort ${cohortKey}: ${originalCount} first-time visitors`);
      
      // For each subsequent period, calculate how many visitors returned
      // Older cohorts (higher cohortIndex) should show more periods of retention data
      const periods = Array.from({ length: cohortIndex + 1 }).map((_, periodIndex) => {
        // First value is always 100% for period 0 (the cohort period itself)
        if (periodIndex === 0) return 100;
        
        // FIXED: Calculate the LATER period index (periodIndex weeks after cohort)
        const laterPeriodIndex = cohortIndex - periodIndex;
        if (laterPeriodIndex < 0) {
          // If we're outside the data range, no retention (0%)
          return 0;
        }
        
        const laterPeriod = cohortPeriods[laterPeriodIndex].cohort;
        if (!sessionsByPeriod.has(laterPeriod)) {
          // If no sessions in the later period, retention is 0%
          return 0;
        }
        
        // Set of all visitors who visited in the later period
        const laterPeriodVisitors = sessionsByPeriod.get(laterPeriod)!;
        
        // Count how many visitors from the original cohort also visited in the later period
        let returningVisitors = 0;
        cohortVisitors.forEach(visitor => {
          if (laterPeriodVisitors.has(visitor)) {
            returningVisitors++;
          }
        });
        
        // Calculate retention percentage
        const retentionPercent = originalCount > 0 ? Math.round((returningVisitors / originalCount) * 100) : 0;
        
        // Debug logging for first few periods
        if (periodIndex <= 3) {
          console.log(`[Visitor Cohorts API] ${cohortKey} Week ${periodIndex + 1}: ${returningVisitors}/${originalCount} = ${retentionPercent}%`);
        }
        
        return retentionPercent;
      });
      
      return {
        cohort: cohortKey,
        periods
      };
    }).filter(cohort => {
      // Only include cohorts that have first-time visitors
      const cohortVisitors = new Set<string>();
      visitorFirstSeen.forEach((firstPeriod, visitorId) => {
        if (firstPeriod === cohort.cohort) {
          cohortVisitors.add(visitorId);
        }
      });
      return cohortVisitors.size > 0;
    });
    
    // Adapt names to maintain compatibility with frontend
    const finalVisitorCohorts = visitorCohorts.map(cohort => ({
      cohort: cohort.cohort,
      weeks: cohort.periods
    }));
    
    // Log the request
    console.log(`[Visitor Cohorts API] Period: ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`);
    console.log(`[Visitor Cohorts API] Returning visitor cohorts: ${finalVisitorCohorts.length}`);
    
    // Debug: Log first cohort details
    if (finalVisitorCohorts.length > 0) {
      const firstCohort = finalVisitorCohorts[0];
      console.log(`[Visitor Cohorts API] First cohort: ${firstCohort.cohort}, weeks: [${firstCohort.weeks.join(', ')}]`);
    }
    
    return NextResponse.json({ 
      visitorCohorts: finalVisitorCohorts
    });
    
  } catch (error) {
    console.error("Error in visitor cohorts API:", error);
    
    // Don't return demo data - return empty to show actual no-data state
    console.log("[Visitor Cohorts API] Returning empty data due to error");
    return NextResponse.json({ visitorCohorts: [] });
  }
} 