import { createApiClient, createServiceApiClient } from "@/lib/supabase/server-client";
import { NextResponse } from "next/server";
import { format, subDays } from "date-fns";

interface SegmentInfo {
  id: string;
  name: string;
  audience?: string;
  engagement?: number;
  is_active?: boolean;
  site_id?: string;
}

async function getSegmentsForSite(supabase: any, siteId: string): Promise<SegmentInfo[]> {
  try {
    // Use the passed service client instead of creating a new one
    // This ensures we're using the same client with admin permissions
    
    // Buscar en la tabla de segmentos filtrando solo por site_id
    const { data, error } = await supabase
      .from("segments")
      .select("id, name, audience, engagement, is_active, site_id")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });
      
    if (error) {
      console.error("[getSegmentsForSite] Error al buscar segmentos:", error);
      return [];
    }
    
    console.log(`[getSegmentsForSite] Found ${data?.length || 0} segments for site ${siteId}`);
    
    // Muestra detalles de los segmentos encontrados
    if (data && data.length > 0) {
      data.forEach((seg: SegmentInfo, index: number) => {
        console.log(`[getSegmentsForSite] Segmento ${index+1}: id=${seg.id}, name='${seg.name}', is_active=${seg.is_active}, site_id=${seg.site_id}`);
      });
    }
    
    return data || [];
  } catch (error) {
    console.error("Error fetching segments for site:", error);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const siteId = searchParams.get("siteId");
  const userId = searchParams.get("userId");
  
  if (!siteId) {
    console.error("[Revenue By Segment API] Missing site ID");
    return NextResponse.json(
      { error: "Site ID is required" },
      { status: 400 }
    );
  }
  
  try {
    const supabase = createServiceApiClient();
    console.log(`[Revenue By Segment API] Received request for site: ${siteId}`);
    console.log(`[Revenue By Segment API] Date parameters: startDate=${startDateParam}, endDate=${endDateParam}`);
    
    // Parse dates
    const startDate = startDateParam ? new Date(startDateParam) : subDays(new Date(), 30);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Check for future dates
    const now = new Date();
    if (startDate > now) {
      console.warn(`[Revenue By Segment API] Future start date detected: ${startDate.toISOString()}, using 30 days ago instead`);
      startDate.setTime(subDays(now, 30).getTime());
    }
    if (endDate > now) {
      console.warn(`[Revenue By Segment API] Future end date detected: ${endDate.toISOString()}, using today instead`);
      endDate.setTime(now.getTime());
    }
    
    console.log(`[Revenue By Segment API] Validated period: ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`);
    
    // Get all segments for the site
    const segments = await getSegmentsForSite(supabase, siteId);
    console.log(`[Revenue By Segment API] Found ${segments.length} segments`);
    
    // Get sales for the period
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("id, amount, segment_id, created_at")
      .eq("site_id", siteId)
      .gte("created_at", format(startDate, "yyyy-MM-dd"))
      .lte("created_at", format(endDate, "yyyy-MM-dd"));
    
    if (salesError) {
      console.error("[Revenue By Segment API] Error fetching sales:", salesError);
      return NextResponse.json(
        { error: "Failed to fetch sales" },
        { status: 500 }
      );
    }
    
    // If we have sales, process them
    if (salesData && salesData.length > 0) {
      console.log(`[Revenue By Segment API] Found ${salesData.length} sales for the period`);
      
      // Group sales by segment
      const segmentRevenue: Record<string, number> = {};
      let unassignedRevenue = 0;
      
      // Track unknown segment IDs that we find in sales
      const unknownSegmentIds = new Set<string>();
      
      salesData.forEach(sale => {
        const amount = Number(sale.amount) || 0;
        if (sale.segment_id) {
          // Log the segment_id for debugging
          console.log(`[Revenue By Segment API] Processing sale: amount=${amount}, segment_id=${sale.segment_id}`);
          
          if (!segmentRevenue[sale.segment_id]) {
            segmentRevenue[sale.segment_id] = 0;
            
            // Check if this segment_id is in our segments list
            const segmentExists = segments.some(segment => segment.id === sale.segment_id);
            if (!segmentExists) {
              unknownSegmentIds.add(sale.segment_id);
            }
          }
          segmentRevenue[sale.segment_id] += amount;
        } else {
          unassignedRevenue += amount;
        }
      });
      
      // Prepare the final data
      const segmentColors = [
        "#3b82f6", // blue
        "#f97316", // orange
        "#10b981", // green
        "#8b5cf6", // purple
        "#ec4899", // pink
        "#ef4444", // red
        "#eab308", // yellow
        "#14b8a6", // teal
        "#6366f1", // indigo
        "#a855f7", // violet
      ];
      
      // Map known segments
      const revenueBySegment = segments.map((segment, index) => {
        // Log the segment mapping for debugging
        console.log(`[Revenue By Segment API] Mapping segment: id=${segment.id}, name=${segment.name}, revenue=${segmentRevenue[segment.id] || 0}`);
        
        return {
          name: segment.name,
          value: segmentRevenue[segment.id] || 0,
          color: segmentColors[index % segmentColors.length]
        };
      });
      
      // Analyze all segment IDs with revenue
      console.log(`[Revenue By Segment API] Known segment IDs: ${segments.map(s => s.id).join(', ') || 'none'}`);
      console.log(`[Revenue By Segment API] Segment IDs with revenue: ${Object.keys(segmentRevenue).join(', ') || 'none'}`);
      
      // Add segments for unknown segment IDs found in sales
      let colorIndex = segments.length;
      unknownSegmentIds.forEach(segmentId => {
        console.log(`[Revenue By Segment API] Adding unknown segment: id=${segmentId}, revenue=${segmentRevenue[segmentId] || 0}`);
        revenueBySegment.push({
          name: `Segmento desconocido`,
          value: segmentRevenue[segmentId] || 0,
          color: segmentColors[colorIndex % segmentColors.length]
        });
        colorIndex++;
      });
      
      // Add unassigned segment if there's unassigned revenue
      if (unassignedRevenue > 0) {
        console.log(`[Revenue By Segment API] Adding unassigned revenue: ${unassignedRevenue}`);
        revenueBySegment.push({
          name: "Sin Segmento",
          value: unassignedRevenue,
          color: "#64748b" // slate
        });
      }
      
      // Filter out entries with zero revenue and sort by value (descending)
      const finalResults = revenueBySegment.filter(item => item.value > 0);
      finalResults.sort((a, b) => b.value - a.value);
      
      // Return the data with debug information
      const finalResult = {
        segments: finalResults,
        debug: {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          segmentsCount: segments.length,
          segmentsWithRevenueCount: finalResults.length,
          totalSales: salesData?.length || 0,
          totalRevenue: Object.values(segmentRevenue).reduce((sum: number, val: number) => sum + val, 0) + unassignedRevenue,
          originalParams: {
            startDateParam,
            endDateParam,
            siteId,
            userId
          }
        }
      };
      
      console.log(`[Revenue By Segment API] Returning ${finalResults.length} segments with revenue`);
      return NextResponse.json(finalResult, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } else {
      console.log("[Revenue By Segment API] No sales found for the period");
      // Return empty array if no sales found
      return NextResponse.json({ 
        segments: [],
        debug: {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          segmentsCount: segments.length,
          segmentsWithRevenueCount: 0,
          totalSales: 0,
          totalRevenue: 0,
          originalParams: {
            startDateParam,
            endDateParam,
            siteId,
            userId
          }
        }
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
  } catch (error) {
    console.error("Error in revenue by segment API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 