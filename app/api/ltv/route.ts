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
      .single();
    
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
      unit: "currency",
      type: kpiParams.type,
      period_start: formattedStart,
      period_end: formattedEnd,
      segment_id: kpiParams.segmentId,
      is_highlighted: true,
      target_value: null,
      metadata: {
        period_type: periodType,
        currency: "USD"
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
      .single();
    
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
  // Usar el cliente de servicio con permisos elevados para evitar restricciones RLS
  const supabase = createServiceApiClient();
  
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get('siteId');
  const userId = searchParams.get('userId');
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');
  const skipKpiCreation = searchParams.get('skipKpiCreation') === 'true';
  const segmentId = searchParams.get('segmentId');
  
  // Validate required parameters
  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }
  
  console.log('[LTV API] Request for site ID:', siteId, segmentId ? `and segment ID: ${segmentId}` : '');
  
  try {
    // Calculate period dates
    let periodStart = startDateStr ? new Date(startDateStr) : subDays(new Date(), 30);
    let periodEnd = endDateStr ? new Date(endDateStr) : new Date();
    const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 3600 * 24));
    
    // Standardize dates for consistency
    const { periodStart: standardizedStart, periodEnd: standardizedEnd, periodType } = 
      standardizePeriodDates(periodStart, periodEnd);
    
    // Calculate previous period dates based on current period length
    let standardizedPrevStart: Date;
    let standardizedPrevEnd: Date;
    
    if (periodType === "daily") {
      standardizedPrevStart = subDays(standardizedStart, 1);
      standardizedPrevEnd = subDays(standardizedEnd, 1);
    } else if (periodType === "weekly") {
      standardizedPrevStart = subDays(standardizedStart, 7);
      standardizedPrevEnd = subDays(standardizedEnd, 7);
    } else if (periodType === "monthly") {
      standardizedPrevStart = subMonths(standardizedStart, 1);
      standardizedPrevEnd = subMonths(standardizedEnd, 1);
    } else if (periodType === "quarterly") {
      standardizedPrevStart = subQuarters(standardizedStart, 1);
      standardizedPrevEnd = subQuarters(standardizedEnd, 1);
    } else {
      standardizedPrevStart = subYears(standardizedStart, 1);
      standardizedPrevEnd = subYears(standardizedEnd, 1);
    }
    
    // STEP 1: Get all purchase tasks with status completed
    let purchaseTasksQuery = supabase
      .from('tasks')
      .select('id, amount, lead_id')
      .eq('site_id', siteId)
      .eq('stage', 'purchase')
      .eq('status', 'completed')
      .gte('created_at', standardizedStart.toISOString())
      .lte('created_at', standardizedEnd.toISOString());

    // If segmentId is provided and not 'all', we need to filter tasks by leads with that segment
    if (segmentId && segmentId !== 'all') {
      // First, get all leads with the specified segment
      const { data: segmentLeads } = await supabase
        .from('leads')
        .select('id')
        .eq('site_id', siteId)
        .eq('segment_id', segmentId);
      
      if (segmentLeads && segmentLeads.length > 0) {
        // Get the lead IDs to filter tasks
        const leadIds = segmentLeads.map(lead => lead.id);
        // Filter tasks by these lead IDs
        purchaseTasksQuery = purchaseTasksQuery.in('lead_id', leadIds);
      }
    }
    
    const { data: purchaseTasks, error: tasksError } = await purchaseTasksQuery;
    
    if (tasksError) {
      console.error('[LTV API] Error fetching purchase tasks:', tasksError);
      return NextResponse.json({ 
        error: 'Failed to fetch purchase tasks',
        details: tasksError 
      }, { status: 500 });
    }
    
    // STEP 2: Get all converted leads
    let leadsQuery = supabase
      .from('leads')
      .select('id')
      .eq('site_id', siteId)
      .eq('status', 'converted')
      .gte('created_at', standardizedStart.toISOString())
      .lte('created_at', standardizedEnd.toISOString());
    
    // If segmentId is provided, filter by segment
    if (segmentId && segmentId !== 'all') {
      leadsQuery = leadsQuery.eq('segment_id', segmentId);
    }
    
    const { data: convertedLeads, error: leadsError } = await leadsQuery;
    
    if (leadsError) {
      console.error('[LTV API] Error fetching converted leads:', leadsError);
      return NextResponse.json({ 
        error: 'Failed to fetch converted leads',
        details: leadsError 
      }, { status: 500 });
    }
    
    // STEP 3: Calculate LTV
    let ltvValue = 0;
    
    // If we have converted leads and purchase tasks
    if (convertedLeads && convertedLeads.length > 0 && purchaseTasks && purchaseTasks.length > 0) {
      // Sum all purchase amounts
      const totalPurchaseAmount = purchaseTasks.reduce((sum, task) => {
        return sum + (task.amount || 0);
      }, 0);
      
      // Calculate LTV as average purchase amount per converted lead
      ltvValue = Math.round(totalPurchaseAmount / convertedLeads.length);
      
      console.log(`[LTV API] Calculated LTV: $${ltvValue} (total purchases: $${totalPurchaseAmount}, converted leads: ${convertedLeads.length})`);
    } else {
      // Fallback to approximation using revenue / leads converted
      // Get revenue
      let revenueQuery = supabase
        .from('sales')
        .select('amount')
        .eq('site_id', siteId)
        .eq('status', 'completed')
        .gte('created_at', standardizedStart.toISOString())
        .lte('created_at', standardizedEnd.toISOString());
      
      // If segmentId is provided and not 'all', apply segment filter (if sales has segment_id column)
      if (segmentId && segmentId !== 'all') {
        // Check if segment_id column exists in sales table
        const { data: salesColumns } = await supabase
          .from('sales')
          .select('segment_id')
          .limit(1)
          .maybeSingle();
        
        // If segment_id column exists, filter by it
        if (salesColumns && 'segment_id' in salesColumns) {
          revenueQuery = revenueQuery.eq('segment_id', segmentId);
        } else {
          // If segment_id doesn't exist, you might need to filter via a relationship
          // This depends on your database schema
          console.log('[LTV API] Warning: Could not filter sales by segment_id as column doesn\'t exist');
        }
      }
      
      const { data: revenue, error: revenueError } = await revenueQuery;
      
      if (!revenueError && revenue && revenue.length > 0) {
        const totalRevenue = revenue.reduce((sum, sale) => sum + (sale.amount || 0), 0);
        
        // If we have converted leads but no purchases, use revenue
        if (convertedLeads && convertedLeads.length > 0) {
          ltvValue = Math.round(totalRevenue / convertedLeads.length);
        } else {
          // Last resort - use a static estimate
          ltvValue = 2420; // Fallback value
        }
        
        console.log(`[LTV API] Approximated LTV: $${ltvValue} (using revenue: $${totalRevenue})`);
      } else {
        // No data available, use default
        ltvValue = 2420;
        console.log('[LTV API] Using default LTV: $2,420');
      }
    }
    
    // Get previous period LTV for comparison
    let previousValue = 0;
    let percentChange = 0;
    
    // Create a Supabase admin client for writing to the KPIs table
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    if (userId && !skipKpiCreation) {
      // First try to find existing KPI for previous period
      const { kpi: prevKpi } = await findOrCreateKpi(
        supabase,
        supabaseAdmin,
        {
          siteId,
          userId,
          segmentId: segmentId !== 'all' ? segmentId : null,
          periodStart: standardizedPrevStart,
          periodEnd: standardizedPrevEnd,
          type: "ltv",
          name: "Customer Lifetime Value",
          value: 0, // Will be updated if needed
          previousValue: undefined
        }
      );
      
      if (prevKpi) {
        // If we found an existing KPI, use its value
        previousValue = prevKpi.value;
        console.log(`[LTV API] Found previous KPI with value: $${previousValue}`);
      } else {
        // Calculate previous period LTV
        let prevPurchaseTasksQuery = supabase
          .from('tasks')
          .select('id, amount, lead_id')
          .eq('site_id', siteId)
          .eq('stage', 'purchase')
          .eq('status', 'completed')
          .gte('created_at', standardizedPrevStart.toISOString())
          .lte('created_at', standardizedPrevEnd.toISOString());
        
        // If segmentId is provided and not 'all', we need to filter tasks by leads with that segment
        if (segmentId && segmentId !== 'all') {
          // First, get all leads with the specified segment
          const { data: prevSegmentLeads } = await supabase
            .from('leads')
            .select('id')
            .eq('site_id', siteId)
            .eq('segment_id', segmentId);
          
          if (prevSegmentLeads && prevSegmentLeads.length > 0) {
            // Get the lead IDs to filter tasks
            const leadIds = prevSegmentLeads.map(lead => lead.id);
            // Filter tasks by these lead IDs
            prevPurchaseTasksQuery = prevPurchaseTasksQuery.in('lead_id', leadIds);
          }
        }
        
        const { data: prevPurchaseTasks } = await prevPurchaseTasksQuery;
        
        let prevLeadsQuery = supabase
          .from('leads')
          .select('id')
          .eq('site_id', siteId)
          .eq('status', 'converted')
          .gte('created_at', standardizedPrevStart.toISOString())
          .lte('created_at', standardizedPrevEnd.toISOString());
        
        // If segmentId is provided, filter by segment
        if (segmentId && segmentId !== 'all') {
          prevLeadsQuery = prevLeadsQuery.eq('segment_id', segmentId);
        }
        
        const { data: prevConvertedLeads } = await prevLeadsQuery;
        
        if (prevPurchaseTasks && prevPurchaseTasks.length > 0 && 
            prevConvertedLeads && prevConvertedLeads.length > 0) {
          // Calculate previous LTV
          const prevTotalAmount = prevPurchaseTasks.reduce((sum, task) => sum + (task.amount || 0), 0);
          previousValue = Math.round(prevTotalAmount / prevConvertedLeads.length);
        } else {
          // Use fallback or default value for previous period
          previousValue = ltvValue * 0.9; // Assume a 10% lower LTV in previous period as fallback
        }
        
        // Store the previous period LTV
        await findOrCreateKpi(
          supabase,
          supabaseAdmin,
          {
            siteId,
            userId,
            segmentId: segmentId !== 'all' ? segmentId : null,
            periodStart: standardizedPrevStart,
            periodEnd: standardizedPrevEnd,
            type: "ltv",
            name: "Customer Lifetime Value",
            value: previousValue,
            previousValue: undefined
          }
        );
      }
      
      // Create or update the current period KPI
      const { kpi: currentKpi } = await findOrCreateKpi(
        supabase,
        supabaseAdmin,
        {
          siteId,
          userId,
          segmentId: segmentId !== 'all' ? segmentId : null,
          periodStart: standardizedStart,
          periodEnd: standardizedEnd,
          type: "ltv",
          name: "Customer Lifetime Value",
          value: ltvValue,
          previousValue
        }
      );
      
      if (currentKpi) {
        // Use the stored trend value if available
        percentChange = currentKpi.trend;
      } else {
        // Calculate trend if KPI creation failed
        percentChange = calculateTrend(ltvValue, previousValue);
      }
    } else {
      // If no userId or skipping KPI creation, just calculate trend
      previousValue = ltvValue * 0.9; // Default assumption
      percentChange = calculateTrend(ltvValue, previousValue);
    }
    
    const responseData = {
      actual: ltvValue,
      currency: "USD",
      percentChange,
      periodType,
      details: {
        purchaseTasksCount: purchaseTasks?.length || 0,
        convertedLeadsCount: convertedLeads?.length || 0
      }
    };
    
    console.log('[LTV API] Response data:', responseData);
    console.log('[LTV API] Final LTV value type:', typeof ltvValue, 'value:', ltvValue);
    
    // Test with explicit 0 to see how frontend handles it
    if (searchParams.get('testZero') === 'true') {
      console.log('[LTV API] Testing with explicit zero value');
      responseData.actual = 0;
    }
    
    // Return the LTV data
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('[LTV API] Error calculating LTV:', error);
    return NextResponse.json({ 
      error: 'Failed to calculate LTV',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 