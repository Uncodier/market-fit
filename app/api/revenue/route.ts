import { createApiClient } from "@/lib/supabase/server-client";
import { NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { KpiData } from "@/app/types";

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

// Helper function to get previous period dates
function getPreviousPeriodDates(startDate: Date, endDate: Date): { prevStart: Date, prevEnd: Date } {
  const diffInDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - diffInDays + 1);
  
  return { prevStart, prevEnd };
}

// Helper function to calculate trend percentage
function calculateTrend(currentValue: number, previousValue: number): number {
  if (previousValue === 0) return currentValue > 0 ? 100 : 0;
  return parseFloat(((currentValue - previousValue) / previousValue * 100).toFixed(2));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const segmentId = searchParams.get("segmentId");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const siteId = searchParams.get("siteId");
  
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

  const startDate = startDateParam ? new Date(startDateParam) : subDays(new Date(), 30);
  const endDate = endDateParam ? new Date(endDateParam) : new Date();
  
  const periodType = determinePeriodType(startDate, endDate);
  const { prevStart, prevEnd } = getPreviousPeriodDates(startDate, endDate);
  
  try {
    const supabase = createApiClient();
    
    // Try to fetch existing KPI
    let query = supabase
      .from("kpis")
      .select("*")
      .eq("type", "revenue")
      .eq("name", "Total Revenue")
      .eq("site_id", siteId)
      .eq("period_start", format(startDate, "yyyy-MM-dd"))
      .eq("period_end", format(endDate, "yyyy-MM-dd"));
    
    if (segmentId && segmentId !== "all") {
      query = query.eq("segment_id", segmentId);
    } else {
      query = query.is("segment_id", null);
    }
    
    const { data: existingKpi, error: fetchError } = await query;
    
    if (fetchError) {
      console.error("Error fetching KPI:", fetchError);
      return NextResponse.json(
        {
          actual: 0,
          projected: 0,
          estimated: 0,
          currency: "USD",
          percentChange: 0,
          periodType
        },
        { status: 500 }
      );
    }
    
    // If KPI exists, use it
    if (existingKpi && existingKpi.length > 0) {
      const kpi = existingKpi[0];
      
      return NextResponse.json({
        actual: kpi.value,
        projected: kpi.value * 1.2, // Example projection
        estimated: kpi.value * 1.5, // Example estimation
        currency: kpi.metadata?.currency || "USD",
        percentChange: kpi.trend,
        periodType: kpi.metadata?.period_type || periodType
      });
    }
    
    // KPI doesn't exist, generate it
    // Fetch data for current period
    let salesQuery = supabase
      .from("sales")
      .select("amount, segment_id, status, created_at")
      .eq("status", "completed")
      .gte("created_at", format(startDate, "yyyy-MM-dd"))
      .lte("created_at", format(endDate, "yyyy-MM-dd"));
    
    if (segmentId && segmentId !== "all") {
      salesQuery = salesQuery.eq("segment_id", segmentId);
    }
    
    const { data: currentData, error: currentError } = await salesQuery;
    
    if (currentError) {
      console.error("Error fetching current period data:", currentError);
      return NextResponse.json(
        {
          actual: 0,
          projected: 0,
          estimated: 0,
          currency: "USD",
          percentChange: 0,
          periodType
        },
        { status: 500 }
      );
    }
    
    // Fetch data for previous period
    let prevSalesQuery = supabase
      .from("sales")
      .select("amount, segment_id, status, created_at")
      .eq("status", "completed")
      .gte("created_at", format(prevStart, "yyyy-MM-dd"))
      .lte("created_at", format(prevEnd, "yyyy-MM-dd"));
    
    if (segmentId && segmentId !== "all") {
      prevSalesQuery = prevSalesQuery.eq("segment_id", segmentId);
    }
    
    const { data: prevData, error: prevError } = await prevSalesQuery;
    
    if (prevError) {
      console.error("Error fetching previous period data:", prevError);
      return NextResponse.json(
        {
          actual: 0,
          projected: 0,
          estimated: 0,
          currency: "USD",
          percentChange: 0,
          periodType
        },
        { status: 500 }
      );
    }
    
    // Calculate values
    const currentValue = currentData?.reduce((sum, sale) => sum + parseFloat(sale.amount.toString()), 0) || 0;
    const previousValue = prevData?.reduce((sum, sale) => sum + parseFloat(sale.amount.toString()), 0) || 0;
    const trend = calculateTrend(currentValue, previousValue);
    
    // Create new KPI
    const newKpi: Partial<KpiData> = {
      id: uuidv4(),
      name: "Total Revenue",
      description: `Total Revenue for ${periodType} period`,
      value: currentValue,
      previous_value: previousValue,
      unit: "currency",
      type: "revenue",
      period_start: format(startDate, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
      period_end: format(endDate, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
      segment_id: segmentId !== "all" ? segmentId : null,
      is_highlighted: true,
      target_value: null,
      metadata: {
        period_type: periodType,
        currency: "USD"
      },
      site_id: siteId,
      trend,
      benchmark: null
    };
    
    // Insert new KPI
    const { error: insertError } = await supabase
      .from("kpis")
      .insert(newKpi);
    
    if (insertError) {
      console.error("Error inserting new KPI:", insertError);
    }
    
    // Return the revenue data
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