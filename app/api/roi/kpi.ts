import type { SupabaseClient } from '@supabase/supabase-js';
import { startOfMonth, endOfMonth } from 'date-fns';
import crypto from 'crypto';
import type { KpiData } from '../_shared/marketing-query-types';
import type { QueryResult } from '../_shared/query-result';

/**
 * ROI Calculation Strategy:
 * 
 * This API calculates ROI using multiple strategies depending on available data:
 * 
 * 1. Standard ROI: ((Revenue - Transaction Costs) / Transaction Costs) * 100
 *    - Used when transaction data is available
 *    - Most accurate measure of marketing ROI based on actual expenditures
 * 
 * 2. Alternative ROI: ((Revenue - Campaign Budgets) / Campaign Budgets) * 100
 *    - Used as fallback when transaction data is unavailable
 *    - Less accurate as it uses budgeted amounts rather than actual expenditures
 * 
 * 3. Simplified ROI: 100%
 *    - Used when there is revenue but no cost data available
 *    - Represents a positive return but with unmeasured magnitude
 * 
 * 4. Default ROI: 0%
 *    - Used when no revenue or cost data is available
 *    - Represents no measurable return
 */

// Helper function to format date for DB
function formatDateForDb(date: Date): string {
  return date.toISOString();
}

// Helper function to calculate trend percentage
export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

// Helper function to standardize period dates
export function standardizePeriodDates(
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
export async function findOrCreateKpi(
  supabase: SupabaseClient,
  supabaseAdmin: SupabaseClient,
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
): Promise<{ kpi: KpiData | null, created: boolean }> {
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

  // Skip query if siteId or segmentId are not valid UUIDs to prevent postgres crash
  const isUUID = (id: string) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isUUID(kpiParams.siteId) || (kpiParams.segmentId && !isUUID(kpiParams.segmentId))) {
    console.warn(`Invalid UUID detected in KPI params: siteId=${kpiParams.siteId}, segmentId=${kpiParams.segmentId}. Skipping DB query.`);
    return { kpi: null, created: false };
  }
  
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
    const { data: existingKpiById, error: idError }: QueryResult<KpiData> = await supabase
      .from("kpis")
      .select("*")
      .eq("id", kpiId)
      .maybeSingle();
    
    if (!idError && existingKpiById) {
      console.log(`Found existing KPI by ID: ${existingKpiById.id}`);
      return { kpi: existingKpiById, created: false };
    }
    
    // If ID lookup failed, try attributes lookup
    const { data: existingKpi, error: fetchError }: QueryResult<KpiData[]> = await query;
    
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
      
      // Validate that the site exists before creating KPI
      const { data: siteExists, error: siteError } = await supabase
        .from('sites')
        .select('id')
        .eq('id', kpiParams.siteId)
        .single();
      
      if (siteError || !siteExists) {
        console.log(`Skipping KPI creation: site ${kpiParams.siteId} does not exist`);
        return { kpi: null, created: false };
      }
    
    // Prepare KPI data with our deterministic ID
    const trend = kpiParams.previousValue !== undefined ? 
      calculateTrend(kpiParams.value, kpiParams.previousValue) : 0;
    
    const newKpi: KpiData = {
      id: kpiId, // Use our deterministic ID
      name: kpiParams.name,
      description: `${kpiParams.name} for ${periodType} period`,
      value: kpiParams.value,
      previous_value: kpiParams.previousValue || 0,
      unit: "percentage",
      type: kpiParams.type,
      period_start: formattedStart,
      period_end: formattedEnd,
      segment_id: kpiParams.segmentId,
      is_highlighted: true,
      target_value: null,
      metadata: {
        period_type: periodType,
        unit: "%"
      },
      site_id: kpiParams.siteId,
      user_id: kpiParams.userId,
      trend,
      benchmark: null
    };
    
    // Try to insert with upsert semantics - will update existing records with same ID
    console.log(`Creating new KPI with ID: ${kpiId}`);
    const { data: insertedKpi, error: insertError }: QueryResult<KpiData> = await supabaseAdmin
      .from("kpis")
      .upsert(newKpi)
      .select()
      .maybeSingle();
    
    if (insertError || !insertedKpi) {
      console.error("Error inserting KPI:", insertError);
      
      // Last chance - query again to see if it exists
      const { data: finalCheckKpi }: QueryResult<KpiData[]> = await query;
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
      const { data: recoveryCheckKpi }: QueryResult<KpiData[]> = await query;
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

