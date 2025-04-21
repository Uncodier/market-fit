import { createApiClient } from "@/lib/supabase/server-client";
import { NextResponse } from "next/server";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { KpiData } from "@/app/types";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Helper function to determine period type based on date range
function determinePeriodType(startDate: Date, endDate: Date): string {
  const diffInDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffInDays <= 1) return "daily";
  if (diffInDays <= 7) return "weekly";
  if (diffInDays <= 31) return "monthly";
  if (diffInDays <= 92) return "quarterly";
  if (diffInDays <= 366) return "yearly";
  return "custom";
}

// Helper function to normalize date to start of day - removes time component
function normalizeDate(date: Date): Date {
  return startOfDay(date);
}

// Helper function to get previous period dates
function getPreviousPeriodDates(startDate: Date, endDate: Date): { prevStart: Date, prevEnd: Date } {
  const diffInDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - diffInDays + 1);
  
  // Normalize both dates to start of day to avoid millisecond differences
  return { 
    prevStart: normalizeDate(prevStart), 
    prevEnd: normalizeDate(prevEnd) 
  };
}

// Helper function to calculate trend percentage
function calculateTrend(currentValue: number, previousValue: number): number {
  if (previousValue === 0) return currentValue > 0 ? 100 : 0;
  return parseFloat(((currentValue - previousValue) / previousValue * 100).toFixed(2));
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
  // Format dates consistently for DB
  const formattedStart = formatDateForDb(kpiParams.periodStart);
  const formattedEnd = formatDateForDb(kpiParams.periodEnd);
  
  // Build query to find existing KPI
  let query = supabase
    .from("kpis")
    .select("*")
    .eq("type", kpiParams.type)
    .eq("name", kpiParams.name)
    .eq("site_id", kpiParams.siteId)
    .eq("period_start", formattedStart)
    .eq("period_end", formattedEnd);
  
  if (kpiParams.segmentId && kpiParams.segmentId !== "all") {
    query = query.eq("segment_id", kpiParams.segmentId);
  } else {
    query = query.is("segment_id", null);
  }
  
  // Try to find existing KPI
  const { data: existingKpi, error: fetchError } = await query;
  
  if (fetchError) {
    console.error("Error checking for existing KPI:", fetchError);
    return { kpi: null, created: false };
  }
  
  // If KPI exists, return it
  if (existingKpi && existingKpi.length > 0) {
    return { kpi: existingKpi[0], created: false };
  }
  
  // Only create KPI if we have a user ID
  if (!kpiParams.userId) {
    return { kpi: null, created: false };
  }
  
  // One more check to prevent race conditions
  const { data: doubleCheckKpi } = await query;
  if (doubleCheckKpi && doubleCheckKpi.length > 0) {
    return { kpi: doubleCheckKpi[0], created: false };
  }
  
  // Calculate period type
  const periodType = determinePeriodType(kpiParams.periodStart, kpiParams.periodEnd);
  
  // Prepare KPI data
  const trend = kpiParams.previousValue !== undefined ? 
    calculateTrend(kpiParams.value, kpiParams.previousValue) : undefined;
  
  const newKpi: Partial<KpiData> = {
    id: uuidv4(),
    name: kpiParams.name,
    description: `${kpiParams.name} for ${periodType} period`,
    value: kpiParams.value,
    previous_value: kpiParams.previousValue,
    unit: "currency",
    type: kpiParams.type,
    period_start: formattedStart,
    period_end: formattedEnd,
    segment_id: kpiParams.segmentId !== "all" ? kpiParams.segmentId : null,
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
  
  // Use RPC call for atomicity if possible, or fallback to standard insert
  try {
    const { data: insertedKpi, error: insertError } = await supabaseAdmin
      .from("kpis")
      .insert(newKpi)
      .select()
      .single();
    
    if (insertError) {
      // If unique constraint violation, query one more time
      if (insertError.code === '23505') {
        const { data: finalCheckKpi } = await query;
        return { kpi: finalCheckKpi?.[0] || null, created: false };
      }
      console.error("Error inserting KPI:", insertError);
      return { kpi: null, created: false };
    }
    
    return { kpi: insertedKpi, created: true };
  } catch (error) {
    console.error("Exception during KPI creation:", error);
    return { kpi: null, created: false };
  }
}

// Format date consistently for database storage
function formatDateForDb(date: Date): string {
  return format(date, "yyyy-MM-dd'T'00:00:00.000'Z'");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const segmentId = searchParams.get("segmentId");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const siteId = searchParams.get("siteId");
  const userId = searchParams.get("userId");
  
  if (!siteId) {
    return NextResponse.json(
      {
        actual: 0,
        projected: 0,
        estimated: 0,
        currency: "USD",
        percentChange: 0,
        periodType: "monthly"
      },
      { status: 400 }
    );
  }

  // Normalize dates to eliminate time component
  const startDate = normalizeDate(startDateParam ? new Date(startDateParam) : subDays(new Date(), 30));
  const endDate = normalizeDate(endDateParam ? new Date(endDateParam) : new Date());
  
  const periodType = determinePeriodType(startDate, endDate);
  const { prevStart, prevEnd } = getPreviousPeriodDates(startDate, endDate);
  
  try {
    // Use regular client for reading data
    const supabase = createApiClient();
    
    // Create admin client for writing data
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // First get previous period value - either from KPI or calculated
    let previousValue = 0;
    
    // Try to find existing KPI for previous period, or create it if needed
    if (userId) {
      // Only try to find or create KPI if we have a userId
      const { kpi: prevKpi } = await findOrCreateKpi(
        supabase,
        supabaseAdmin,
        {
          siteId,
          userId,
          segmentId,
          periodStart: prevStart,
          periodEnd: prevEnd,
          type: "revenue",
          name: "Total Revenue",
          value: 0, // This will be updated if we need to create
          previousValue: undefined
        }
      );
      
      if (prevKpi) {
        // If we found an existing KPI, use its value
        previousValue = prevKpi.value;
      } else {
        // Calculate previous period value from sales data
        const prevSalesQuery = await fetchPreviousPeriodSales(
          supabase,
          siteId,
          segmentId,
          prevStart, 
          prevEnd
        );
        
        // If we successfully calculated a value, create the KPI
        if (prevSalesQuery.value !== null) {
          previousValue = prevSalesQuery.value;
          
          // Try creating the KPI again with the calculated value
          await findOrCreateKpi(
            supabase,
            supabaseAdmin,
            {
              siteId,
              userId,
              segmentId,
              periodStart: prevStart,
              periodEnd: prevEnd,
              type: "revenue",
              name: "Total Revenue",
              value: previousValue,
              previousValue: undefined
            }
          );
        }
      }
    } else {
      // If no userId, just calculate the value without creating KPI
      const prevSalesQuery = await fetchPreviousPeriodSales(
        supabase,
        siteId,
        segmentId,
        prevStart, 
        prevEnd
      );
      
      if (prevSalesQuery.value !== null) {
        previousValue = prevSalesQuery.value;
      }
    }
    
    // Now calculate current period value (always dynamic)
    const currentSalesQuery = await fetchCurrentPeriodSales(
      supabase,
      siteId,
      segmentId,
      startDate,
      endDate
    );
    
    const currentValue = currentSalesQuery.value || 0;
    
    // Calculate trend
    const trend = calculateTrend(currentValue, previousValue);
    
    // Return the revenue data without saving current period KPI
    const revenue = {
      actual: currentValue,
      projected: currentValue * 1.2, // Example projection
      estimated: currentValue * 1.5, // Example estimation
      currency: "USD",
      percentChange: trend,
      periodType
    };
    
    return NextResponse.json(revenue);
  } catch (error) {
    console.error("Error in revenue API:", error);
    return NextResponse.json(
      {
        actual: 0,
        projected: 0,
        estimated: 0,
        currency: "USD",
        percentChange: 0,
        periodType: "monthly"
      },
      { status: 500 }
    );
  }
}

// Helper function to fetch previous period sales
async function fetchPreviousPeriodSales(
  supabase: any,
  siteId: string,
  segmentId: string | null,
  startDate: Date,
  endDate: Date
): Promise<{ value: number | null, error: any }> {
  try {
    let salesQuery = supabase
      .from("sales")
      .select("amount, segment_id, status, created_at")
      .eq("status", "completed")
      .eq("site_id", siteId)
      .gte("created_at", format(startDate, "yyyy-MM-dd"))
      .lte("created_at", format(endOfDay(endDate), "yyyy-MM-dd'T'23:59:59.999'Z'"));
    
    if (segmentId && segmentId !== "all") {
      salesQuery = salesQuery.eq("segment_id", segmentId);
    }
    
    const { data, error } = await salesQuery;
    
    if (error) {
      console.error("Error fetching previous period sales:", error);
      return { value: null, error };
    }
    
    const total = data?.reduce((sum: number, sale: { amount: number | string }) => 
      sum + parseFloat(sale.amount.toString()), 0) || 0;
    return { value: total, error: null };
  } catch (err) {
    console.error("Exception fetching previous period sales:", err);
    return { value: null, error: err };
  }
}

// Helper function to fetch current period sales
async function fetchCurrentPeriodSales(
  supabase: any,
  siteId: string,
  segmentId: string | null,
  startDate: Date,
  endDate: Date
): Promise<{ value: number | null, error: any }> {
  try {
    let salesQuery = supabase
      .from("sales")
      .select("amount, segment_id, status, created_at")
      .eq("status", "completed")
      .eq("site_id", siteId)
      .gte("created_at", format(startDate, "yyyy-MM-dd"))
      .lte("created_at", format(endOfDay(endDate), "yyyy-MM-dd'T'23:59:59.999'Z'"));
    
    if (segmentId && segmentId !== "all") {
      salesQuery = salesQuery.eq("segment_id", segmentId);
    }
    
    const { data, error } = await salesQuery;
    
    if (error) {
      console.error("Error fetching current period sales:", error);
      return { value: null, error };
    }
    
    const total = data?.reduce((sum: number, sale: { amount: number | string }) => 
      sum + parseFloat(sale.amount.toString()), 0) || 0;
    return { value: total, error: null };
  } catch (err) {
    console.error("Exception fetching current period sales:", err);
    return { value: null, error: err };
  }
} 