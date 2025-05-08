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
    // Usar el cliente de servicio para la consulta de segmentos
    const serviceClient = createServiceApiClient();
    
    // Buscar en la tabla de segmentos filtrando solo por site_id
    const { data, error } = await serviceClient
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
    console.error("[Clients By Segment API] Missing site ID");
    return NextResponse.json(
      { error: "Site ID is required" },
      { status: 400 }
    );
  }
  
  try {
    const supabase = createServiceApiClient();
    console.log(`[Clients By Segment API] Received request for site: ${siteId}`);
    
    // Parse dates
    const startDate = startDateParam ? new Date(startDateParam) : subDays(new Date(), 30);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    console.log(`[Clients By Segment API] Period: ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`);
    
    // Get all segments for the site
    const segments = await getSegmentsForSite(supabase, siteId);
    console.log(`[Clients By Segment API] Found ${segments.length} segments`);
    
    // Get leads for the period
    const { data: leadsData, error: leadsError } = await supabase
      .from("leads")
      .select("id")
      .eq("site_id", siteId)
      .gte("created_at", format(startDate, "yyyy-MM-dd"))
      .lte("created_at", format(endDate, "yyyy-MM-dd"));
    
    if (leadsError) {
      console.error("[Clients By Segment API] Error fetching leads:", leadsError);
      return NextResponse.json(
        { error: "Failed to fetch leads" },
        { status: 500 }
      );
    }
    
    // Also get leads from sales in case there are sales with leads not directly in the leads table
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("lead_id, segment_id")
      .eq("site_id", siteId)
      .not("lead_id", "is", null)
      .gte("created_at", format(startDate, "yyyy-MM-dd"))
      .lte("created_at", format(endDate, "yyyy-MM-dd"));
    
    if (salesError) {
      console.error("[Clients By Segment API] Error fetching sales:", salesError);
      // Continue anyway with the leads we have
    }
    
    // Combine leads from both sources, removing duplicates
    let allLeadIds = new Set<string>();
    
    // Track lead-to-segment mapping from sales
    const leadToSegmentMap: Record<string, string> = {};
    
    // Add leads from leads table
    if (leadsData && leadsData.length > 0) {
      leadsData.forEach(lead => {
        if (lead.id) allLeadIds.add(lead.id);
      });
    }
    
    // Add leads from sales table
    if (salesData && salesData.length > 0) {
      salesData.forEach(sale => {
        if (sale.lead_id) {
          allLeadIds.add(sale.lead_id);
          // If this sale has a segment_id, map the lead to that segment
          if (sale.segment_id) {
            leadToSegmentMap[sale.lead_id] = sale.segment_id;
          }
        }
      });
      console.log(`[Clients By Segment API] Found ${salesData.length} sales with leads`);
    }
    
    const leadIdsArray = Array.from(allLeadIds);
    console.log(`[Clients By Segment API] Total unique leads: ${leadIdsArray.length}`);
    
    // If we have leads, process them
    if (leadIdsArray.length > 0) {
      // Create a mapping to track segments from both leads and sales
      const segmentCounts: Record<string, number> = {};
      let unassignedCount = leadIdsArray.length; // Assume all are unassigned initially
      
      // Track unknown segment IDs
      const unknownSegmentIds = new Set<string>();
      
      // First, process the leads with known segments from sales
      Object.entries(leadToSegmentMap).forEach(([leadId, segmentId]) => {
        if (!segmentCounts[segmentId]) {
          segmentCounts[segmentId] = 0;
          
          // Check if this segment exists in our segment list
          const segmentExists = segments.some(segment => segment.id === segmentId);
          if (!segmentExists) {
            unknownSegmentIds.add(segmentId);
          }
        }
        segmentCounts[segmentId]++;
        unassignedCount--; // One less unassigned
      });
      
      // Then try to get lead-segment associations from lead_segments table for remaining leads
      try {
        // Filter out leads that already have segments from sales
        const remainingLeadIds = leadIdsArray.filter(id => !leadToSegmentMap[id]);
        
        if (remainingLeadIds.length > 0) {
          const { data: leadSegmentsData, error: leadSegmentsError } = await supabase
            .from("lead_segments")
            .select("lead_id, segment_id")
            .in("lead_id", remainingLeadIds);
          
          if (!leadSegmentsError && leadSegmentsData && leadSegmentsData.length > 0) {
            console.log(`[Clients By Segment API] Found ${leadSegmentsData.length} lead-segment associations`);
            
            // Count leads per segment
            leadSegmentsData.forEach(leadSegment => {
              if (leadSegment.segment_id && leadSegment.lead_id) {
                if (!segmentCounts[leadSegment.segment_id]) {
                  segmentCounts[leadSegment.segment_id] = 0;
                  
                  // Check if this segment exists in our segment list
                  const segmentExists = segments.some(segment => segment.id === leadSegment.segment_id);
                  if (!segmentExists) {
                    unknownSegmentIds.add(leadSegment.segment_id);
                  }
                }
                segmentCounts[leadSegment.segment_id]++;
                unassignedCount--; // One less unassigned
              }
            });
          }
        }
      } catch (error) {
        console.log("[Clients By Segment API] Error fetching lead_segments:", error);
        // Continue with what we have
      }
      
      // Unassigned count is now the number of leads without segment assignments
      console.log(`[Clients By Segment API] Unassigned leads: ${unassignedCount}`);
      
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
      const clientsBySegment = segments.map((segment, index) => ({
        name: segment.name,
        value: segmentCounts[segment.id] || 0,
        color: segmentColors[index % segmentColors.length]
      }));
      
      // Analyze all segment IDs with clients
      console.log(`[Clients By Segment API] Known segment IDs: ${segments.map(s => s.id).join(', ') || 'none'}`);
      console.log(`[Clients By Segment API] Segment IDs with clients: ${Object.keys(segmentCounts).join(', ') || 'none'}`);
      
      // Add segments for unknown segment IDs found in lead associations
      let colorIndex = segments.length;
      unknownSegmentIds.forEach(segmentId => {
        console.log(`[Clients By Segment API] Adding unknown segment: id=${segmentId}, count=${segmentCounts[segmentId] || 0}`);
        clientsBySegment.push({
          name: `Segmento desconocido`,
          value: segmentCounts[segmentId] || 0,
          color: segmentColors[colorIndex % segmentColors.length]
        });
        colorIndex++;
      });
      
      // Add unassigned segment if there are any unassigned leads
      if (unassignedCount > 0) {
        console.log(`[Clients By Segment API] Adding unassigned count: ${unassignedCount}`);
        clientsBySegment.push({
          name: "Sin Segmento",
          value: unassignedCount,
          color: "#64748b" // slate
        });
      }
      
      // Filter out entries with zero and sort by value (descending)
      const finalResults = clientsBySegment.filter(item => item.value > 0);
      finalResults.sort((a, b) => b.value - a.value);
      
      console.log(`[Clients By Segment API] Returning ${finalResults.length} segments with clients`);
      return NextResponse.json({ segments: finalResults });
    } else {
      console.log("[Clients By Segment API] No leads found for the period");
      // Return empty array if no leads found
      return NextResponse.json({ segments: [] });
    }
  } catch (error) {
    console.error("Error in clients by segment API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 