import { format, endOfDay, isAfter, isFuture, subDays } from "date-fns";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createApiClient, createServiceApiClient } from "@/lib/supabase/server-client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const segmentId = searchParams.get("segmentId");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const siteId = searchParams.get("siteId");
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 100;
  
  console.log(`[Sales API] Received request with params: `, {
    siteId,
    startDate: startDateParam,
    endDate: endDateParam,
    segmentId,
    limit
  });
  
  if (!siteId) {
    console.error("[Sales API] Missing site ID");
    return NextResponse.json({ error: "Site ID is required" }, { status: 400 });
  }

  try {
    console.log(`[Sales API] Processing request for site: ${siteId}`);
    
    // Parse dates with detailed validation
    let startDate: Date;
    let endDate: Date;
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Process start date with validation
    if (startDateParam) {
      startDate = new Date(startDateParam);
      console.log(`[Sales API] Raw start date: ${startDateParam}, parsed as: ${startDate.toISOString()}`);
      
      // Validate start date
      if (isNaN(startDate.getTime())) {
        console.error(`[Sales API] Invalid start date: ${startDateParam}`);
        startDate = subDays(now, 30);
        console.log(`[Sales API] Using fallback start date: ${startDate.toISOString()}`);
      } else if (startDate.getFullYear() > currentYear) {
        console.warn(`[Sales API] Future year in start date: ${startDate.toISOString()}`);
        startDate = new Date(startDate);
        startDate.setFullYear(currentYear - 1);
        console.log(`[Sales API] Adjusted start date year: ${startDate.toISOString()}`);
      } else if (isFuture(startDate)) {
        console.warn(`[Sales API] Future start date: ${startDate.toISOString()}`);
        startDate = subDays(now, 30);
        console.log(`[Sales API] Using safe start date: ${startDate.toISOString()}`);
      }
    } else {
      startDate = subDays(now, 30);
      console.log(`[Sales API] No start date provided, using default: ${startDate.toISOString()}`);
    }
    
    // Process end date with validation
    if (endDateParam) {
      endDate = new Date(endDateParam);
      console.log(`[Sales API] Raw end date: ${endDateParam}, parsed as: ${endDate.toISOString()}`);
      
      // Validate end date
      if (isNaN(endDate.getTime())) {
        console.error(`[Sales API] Invalid end date: ${endDateParam}`);
        endDate = now;
        console.log(`[Sales API] Using fallback end date: ${endDate.toISOString()}`);
      } else if (endDate.getFullYear() > currentYear) {
        console.warn(`[Sales API] Future year in end date: ${endDate.toISOString()}`);
        endDate = now;
        console.log(`[Sales API] Adjusted end date to today: ${endDate.toISOString()}`);
      } else if (isFuture(endDate)) {
        console.warn(`[Sales API] Future end date: ${endDate.toISOString()}`);
        endDate = now;
        console.log(`[Sales API] Using safe end date: ${endDate.toISOString()}`);
      }
    } else {
      endDate = now;
      console.log(`[Sales API] No end date provided, using default: ${endDate.toISOString()}`);
    }
    
    // Make sure start date is before end date
    if (isAfter(startDate, endDate)) {
      console.warn(`[Sales API] Start date (${startDate.toISOString()}) is after end date (${endDate.toISOString()})`);
      startDate = subDays(endDate, 30);
      console.log(`[Sales API] Adjusted start date to be 30 days before end date: ${startDate.toISOString()}`);
    }
    
    const formattedStartDate = startDate.toISOString();
    const formattedEndDate = endDate.toISOString();
    
    // Create Supabase client with service role key to bypass RLS
    const supabase = createServiceApiClient();
    
    // Build query
    let query = supabase
      .from("sales")
      .select("*")
      .eq("site_id", siteId)
      .gte("created_at", formattedStartDate)
      .lte("created_at", formattedEndDate)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(limit);
    
    // Apply segment filter if provided and not 'all'
    if (segmentId && segmentId !== "all") {
      console.log(`[Sales API] Adding segment filter for segment: ${segmentId}`);
      query = query.eq("segment_id", segmentId);
    }
    
    // Log the query execution for debugging
    console.log(`[Sales API] Fetching sales for site ${siteId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Execute query
    const { data, error, status } = await query;
    
    console.log(`[Sales API] Query executed with status: ${status}`);
    
    if (error) {
      console.error("[Sales API] Error fetching sales:", error);
      return NextResponse.json({ error: "Failed to fetch sales data", details: error }, { status: 500 });
    }
    
    // Log summary of results
    console.log(`[Sales API] Query returned ${data?.length || 0} sales records`);
    
    if (data && data.length > 0) {
      console.log(`[Sales API] First sale: ${JSON.stringify(data[0])}`);
      console.log(`[Sales API] Last sale: ${JSON.stringify(data[data.length - 1])}`);
      
      // Calculate total revenue
      const totalRevenue = data.reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0);
      console.log(`[Sales API] Total revenue in period: ${totalRevenue}`);
      
      // Sample data by month or day to help with debugging date ranges
      const months: Record<string, number> = {};
      data.forEach(sale => {
        const date = new Date(sale.created_at);
        const monthKey = format(date, "yyyy-MM");
        months[monthKey] = (months[monthKey] || 0) + 1;
      });
      console.log(`[Sales API] Distribution by month:`, months);
    } else {
      console.log(`[Sales API] No sales found for the specified period and filters`);
      
      // Try a broader query to see if there's any data at all
      console.log(`[Sales API] Attempting a broader query to check if there's any sales data...`);
      const { data: allSiteSales, error: broadError } = await supabase
        .from("sales")
        .select("created_at, amount")
        .eq("site_id", siteId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (!broadError && allSiteSales && allSiteSales.length > 0) {
        console.log(`[Sales API] Found ${allSiteSales.length} sales in total for site (ignoring date filters)`);
        console.log(`[Sales API] Earliest sale from broader query:`, allSiteSales[allSiteSales.length - 1]);
        console.log(`[Sales API] Latest sale from broader query:`, allSiteSales[0]);
      } else {
        console.log(`[Sales API] No sales found at all for site: ${siteId}`);
      }
    }
    
    console.log(`[Sales API] Found ${data?.length || 0} sales records`);
    
    // Format and return the data
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("[Sales API] Unexpected error:", error);
    return NextResponse.json({ 
      error: "An unexpected error occurred", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 