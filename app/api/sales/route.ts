import { format, endOfDay } from "date-fns";
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
  
  if (!siteId) {
    return NextResponse.json({ error: "Site ID is required" }, { status: 400 });
  }

  try {
    // Parse dates
    const startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Create Supabase client with service role key to bypass RLS
    const supabase = createServiceApiClient();
    
    // Build query
    let query = supabase
      .from("sales")
      .select("*")
      .eq("site_id", siteId)
      .gte("created_at", format(startDate, "yyyy-MM-dd"))
      .lte("created_at", format(endOfDay(endDate), "yyyy-MM-dd'T'23:59:59.999'Z'"))
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(limit);
    
    // Apply segment filter if provided and not 'all'
    if (segmentId && segmentId !== "all") {
      query = query.eq("segment_id", segmentId);
    }
    
    // Log the query execution for debugging
    console.log(`[Sales API] Fetching sales for site ${siteId} from ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`);
    
    // Execute query
    const { data, error } = await query;
    
    if (error) {
      console.error("[Sales API] Error fetching sales:", error);
      return NextResponse.json({ error: "Failed to fetch sales data" }, { status: 500 });
    }
    
    console.log(`[Sales API] Found ${data?.length || 0} sales records`);
    
    // Format and return the data
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("[Sales API] Unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
} 