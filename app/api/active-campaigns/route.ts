import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { subDays, subMonths, format, startOfMonth, endOfMonth, subQuarters, subYears } from 'date-fns';
import { createApiClient, createServiceApiClient } from "@/lib/supabase/server-client";
import crypto from 'crypto';

interface KpiData {
  id: string;
  name: string;
  description: string | null;
  value: number;
  previous_value: number;
  unit: string;
  type: string;
  period_start: string;
  period_end: string;
  segment_id: string | null;
  is_highlighted: boolean;
  target_value: number | null;
  metadata: any;
  site_id: string;
  user_id: string | null;
  trend: number;
  benchmark: number | null;
}

// Helper function to format date for DB
function formatDateForDb(date: Date): string {
  return date.toISOString();
}

// Helper function to calculate trend percentage
function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

// Helper function to standardize period dates
function standardizePeriodDates(
  periodStart: Date,
  periodEnd: Date
): { periodStart: Date; periodEnd: Date; periodType: string } {
  const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 3600 * 24));
  
  let periodType = "monthly";
  let standardizedStart = periodStart;
  let standardizedEnd = periodEnd;
  
  if (daysDiff <= 1) {
    periodType = "daily";
    // Keep as is
  } else if (daysDiff <= 7) {
    periodType = "weekly";
    // Keep as is
  } else if (daysDiff <= 31) {
    periodType = "monthly";
    standardizedStart = startOfMonth(periodStart);
    standardizedEnd = endOfMonth(periodStart);
  } else if (daysDiff <= 90) {
    periodType = "quarterly";
    // First day of current quarter to last day of current quarter
    standardizedStart = startOfMonth(periodStart);
    standardizedEnd = endOfMonth(new Date(periodStart.getFullYear(), periodStart.getMonth() + 2, 1));
  } else {
    periodType = "yearly";
    standardizedStart = new Date(periodStart.getFullYear(), 0, 1);
    standardizedEnd = new Date(periodStart.getFullYear(), 11, 31);
  }
  
  return { periodStart: standardizedStart, periodEnd: standardizedEnd, periodType };
}

// Helper function to check if a KPI exists and create it if it doesn't
async function findOrCreateKpi(
  supabase: any,
  supabaseAdmin: any,
  kpiParams: {
    siteId: string,
    userId: string | null,
    segmentId: string | null,
    periodStart: Date,
    periodEnd: Date,
    type: string,
    name: string,
    value: number,
    previousValue?: number
  }
): Promise<{ kpi: any, created: boolean }> {
  // Get the period type and standardize dates for consistency
  const { periodStart, periodEnd, periodType } = standardizePeriodDates(
    kpiParams.periodStart,
    kpiParams.periodEnd
  );
  
  // Format dates consistently for DB
  const formattedStart = formatDateForDb(periodStart);
  const formattedEnd = formatDateForDb(periodEnd);
  
  // Create a deterministic ID for this KPI based on its key attributes
  // This ensures the same KPI always has the same ID, preventing duplicates
  const segmentPart = kpiParams.segmentId ? kpiParams.segmentId : "00000000-0000-0000-0000-000000000000";
  
  const idBase = `${kpiParams.type}:${kpiParams.name}:${kpiParams.siteId}:${formattedStart}:${formattedEnd}:${segmentPart}`;
  
  // Create a consistent UUID v5 from the string
  const deterministicId = crypto.createHash('md5').update(idBase).digest('hex');
  const kpiId = [
    deterministicId.substring(0, 8),
    deterministicId.substring(8, 12),
    deterministicId.substring(12, 16),
    deterministicId.substring(16, 20),
    deterministicId.substring(20, 32),
  ].join('-');
  
  console.log(`Finding/creating KPI with deterministic ID: ${kpiId} for ${idBase}`);
  
  // Create query parameters
  const queryParams = {
    type: kpiParams.type,
    name: kpiParams.name,
    site_id: kpiParams.siteId,
    period_start: formattedStart,
    period_end: formattedEnd
  };
  
  // Build query to find existing KPI by attributes
  let query = supabase
    .from("kpis")
    .select("*")
    .match(queryParams);
    
  // Handle segment ID specifically
  if (kpiParams.segmentId) {
    query = query.eq("segment_id", kpiParams.segmentId);
  } else {
    query = query.is("segment_id", null);
  }
  
  try {
    // First try to find by ID directly - fastest lookup
    const { data: existingKpiById, error: idError } = await supabase
      .from("kpis")
      .select("*")
      .eq("id", kpiId)
      .maybeSingle();
    
    if (!idError && existingKpiById) {
      console.log(`Found existing KPI by ID: ${existingKpiById.id}`);
      return { kpi: existingKpiById, created: false };
    }
    
    // If ID lookup failed, try attributes lookup
    const { data: existingKpi, error: fetchError } = await query;
    
    if (fetchError) {
      console.error("Error checking for existing KPI:", fetchError);
    } else if (existingKpi && existingKpi.length > 0) {
      console.log(`Found existing KPI by attributes: ${existingKpi[0].id}`);
      return { kpi: existingKpi[0], created: false };
    }
    
    // Only create KPI if we have a user ID
    if (!kpiParams.userId) {
      console.log("Skipping KPI creation: no user ID provided");
      return { kpi: null, created: false };
    }
    
    // Prepare KPI data with our deterministic ID
    const trend = kpiParams.previousValue !== undefined ? 
      calculateTrend(kpiParams.value, kpiParams.previousValue) : 0;
    
    const newKpi: Partial<KpiData> = {
      id: kpiId, // Use our deterministic ID
      name: kpiParams.name,
      description: `${kpiParams.name} for ${periodType} period`,
      value: kpiParams.value,
      previous_value: kpiParams.previousValue || 0,
      unit: "count",
      type: kpiParams.type,
      period_start: formattedStart,
      period_end: formattedEnd,
      segment_id: kpiParams.segmentId,
      is_highlighted: true,
      target_value: null,
      metadata: {
        period_type: periodType
      },
      site_id: kpiParams.siteId,
      user_id: kpiParams.userId,
      trend,
      benchmark: null
    };
    
    // Try to insert with upsert semantics - will update existing records with same ID
    console.log(`Creating new KPI with ID: ${kpiId}`);
    const { data: insertedKpi, error: insertError } = await supabaseAdmin
      .from("kpis")
      .upsert(newKpi)
      .select()
      .maybeSingle();
    
    if (insertError) {
      console.error("Error inserting KPI:", insertError);
      
      // Last chance - query again to see if it exists
      const { data: finalCheckKpi } = await query;
      if (finalCheckKpi && finalCheckKpi.length > 0) {
        console.log(`Found KPI in final check: ${finalCheckKpi[0].id}`);
        return { kpi: finalCheckKpi[0], created: false };
      }
      
      return { kpi: null, created: false };
    }
    
    console.log(`Successfully created KPI with ID: ${insertedKpi.id}`);
    return { kpi: insertedKpi, created: true };
  } catch (error) {
    console.error("Exception during KPI creation:", error);
    
    // Final fallback check
    try {
      const { data: recoveryCheckKpi } = await query;
      if (recoveryCheckKpi && recoveryCheckKpi.length > 0) {
        console.log(`Found KPI during recovery: ${recoveryCheckKpi[0].id}`);
        return { kpi: recoveryCheckKpi[0], created: false };
      }
    } catch (recoveryError) {
      console.error("Error during recovery check:", recoveryError);
    }
    
    return { kpi: null, created: false };
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  // Use service client with elevated permissions to avoid RLS restrictions
  const supabase = createServiceApiClient();
  
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get('siteId');
  const userId = searchParams.get('userId');
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');
  const skipKpiCreation = searchParams.get('skipKpiCreation') === 'true';
  const segmentId = searchParams.get('segmentId');
  
  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }
  
  console.log(`[ActiveCampaignsAPI] Processing request for site: ${siteId}`);
  
  try {
    // Parse dates
    const startDate = startDateStr ? new Date(startDateStr) : subDays(new Date(), 30);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    
    console.log(`[ActiveCampaignsAPI] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Get standardized period dates
    const { periodStart, periodEnd, periodType } = standardizePeriodDates(startDate, endDate);
    
    console.log(`[ActiveCampaignsAPI] Period type: ${periodType}, standardized dates: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    
    // Calculate previous period dates
    const periodLengthInDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 3600 * 24));
    const previousPeriodEnd = new Date(periodStart.getTime() - 1);
    const previousPeriodStart = new Date(previousPeriodEnd.getTime() - (periodLengthInDays * 24 * 60 * 60 * 1000));
    
    console.log(`[ActiveCampaignsAPI] Previous period: ${previousPeriodStart.toISOString()} to ${previousPeriodEnd.toISOString()}`);
    
    // Create admin client for KPI operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // First, let's check if there are ANY campaigns for this site
    console.log(`[ActiveCampaignsAPI] Checking if site has any campaigns at all...`);
    const { data: allCampaigns, error: allCampaignsError } = await supabase
      .from('campaigns')
      .select('id, title, created_at, metadata')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (allCampaignsError) {
      console.error('[ActiveCampaignsAPI] Error checking all campaigns:', allCampaignsError);
    } else {
      console.log(`[ActiveCampaignsAPI] Found ${allCampaigns?.length || 0} total campaigns for site`);
      if (allCampaigns && allCampaigns.length > 0) {
        console.log(`[ActiveCampaignsAPI] Sample campaigns:`, allCampaigns.slice(0, 3));
        console.log(`[ActiveCampaignsAPI] Oldest campaign:`, allCampaigns[allCampaigns.length - 1]);
        console.log(`[ActiveCampaignsAPI] Newest campaign:`, allCampaigns[0]);
      }
    }
    
    // Query campaigns created in current period for comparison
    console.log(`[ActiveCampaignsAPI] Querying campaigns created during ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    const { data: currentCampaigns, error: currentError } = await supabase
      .from('campaigns')
      .select('id, title, created_at, metadata')
      .eq('site_id', siteId)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString());
    
    if (currentError) {
      console.error('[ActiveCampaignsAPI] Error fetching current campaigns:', currentError);
      return NextResponse.json({ error: 'Failed to fetch current campaigns' }, { status: 500 });
    }
    
    console.log(`[ActiveCampaignsAPI] Found ${currentCampaigns?.length || 0} campaigns created in current period`);
    
    // Query campaigns for previous period
    const { data: previousCampaigns, error: previousError } = await supabase
      .from('campaigns')
      .select('id, title, created_at, metadata')
      .eq('site_id', siteId)
      .gte('created_at', previousPeriodStart.toISOString())
      .lte('created_at', previousPeriodEnd.toISOString());
    
    if (previousError) {
      console.error('[ActiveCampaignsAPI] Error fetching previous campaigns:', previousError);
      return NextResponse.json({ error: 'Failed to fetch previous campaigns' }, { status: 500 });
    }
    
    const currentCount = currentCampaigns?.length || 0;
    const previousCount = previousCampaigns?.length || 0;
    
    console.log(`[ActiveCampaignsAPI] Previous period: ${previousCount} campaigns created`);
    
    console.log(`[ActiveCampaignsAPI] Current campaigns: ${currentCount}, Previous campaigns: ${previousCount}`);
    
    // Calculate trend
    const percentChange = calculateTrend(currentCount, previousCount);
    
    // Create or update KPI if needed
    if (userId && !skipKpiCreation) {
      await findOrCreateKpi(
        supabase,
        supabaseAdmin,
        {
          siteId,
          userId,
          segmentId,
          periodStart,
          periodEnd,
          type: 'engagement',
          name: 'Active Campaigns',
          value: currentCount,
          previousValue: previousCount
        }
      );
    }
    
    const result = {
      actual: currentCount,
      percentChange,
      periodType,
      campaigns: currentCampaigns || []
    };
    
    console.log(`[ActiveCampaignsAPI] Returning result:`, result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[ActiveCampaignsAPI] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 