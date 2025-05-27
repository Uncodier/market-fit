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
    console.error("[Clients By Segment API] Missing site ID");
    return NextResponse.json(
      { error: "Site ID is required" },
      { status: 400 }
    );
  }
  
  try {
    const supabase = createServiceApiClient();
    console.log(`[Clients By Segment API] Received request for site: ${siteId}`);
    console.log(`[Clients By Segment API] Date parameters: startDate=${startDateParam}, endDate=${endDateParam}`);
    
    // Parse dates
    const startDate = startDateParam ? new Date(startDateParam) : subDays(new Date(), 30);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Check for future dates
    const now = new Date();
    
    // Validate that we're not querying future data
    if (startDate > now || endDate > now) {
      console.warn(`[Clients By Segment API] Future date detected in request - startDate: ${startDate.toISOString()}, endDate: ${endDate.toISOString()}`);
      return NextResponse.json({ 
        segments: [],
        debug: {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          segmentsCount: 0,
          segmentsWithClientsCount: 0,
          totalLeads: 0,
          originalParams: {
            startDateParam,
            endDateParam,
            siteId,
            userId
          },
          message: "Future dates were requested - no data available"
        }
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    // If dates are valid but in the future compared to data, adjust them
    if (startDate > now) {
      console.warn(`[Clients By Segment API] Future start date detected: ${startDate.toISOString()}, using 30 days ago instead`);
      startDate.setTime(subDays(now, 30).getTime());
    }
    if (endDate > now) {
      console.warn(`[Clients By Segment API] Future end date detected: ${endDate.toISOString()}, using today instead`);
      endDate.setTime(now.getTime());
    }
    
    console.log(`[Clients By Segment API] Validated period: ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`);
    
    // Get all segments for the site using service client
    const segments = await getSegmentsForSite(supabase, siteId);
    console.log(`[Clients By Segment API] Found ${segments.length} segments`);
    
    // Get leads for the period
    const { data: leadsData, error: leadsError } = await supabase
      .from("leads")
      .select("id, created_at")
      .eq("site_id", siteId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());
    
    if (leadsError) {
      console.error("[Clients By Segment API] Error fetching leads:", leadsError);
      return NextResponse.json(
        { error: "Failed to fetch leads" },
        { status: 500 }
      );
    }
    
    console.log(`[Clients By Segment API] Found ${leadsData?.length || 0} leads for the period`);
    
    // Diagnóstico: Mostrar las fechas de los leads encontrados
    if (leadsData && leadsData.length > 0) {
      console.log(`[Clients By Segment API] Lead dates sample (first 5):`);
      leadsData.slice(0, 5).forEach((lead, index) => {
        console.log(`  Lead ${index+1}: ID=${lead.id}, Created=${new Date(lead.created_at).toISOString()}`);
      });
    }
    
    // Also get leads from sales in case there are sales with leads not directly in the leads table
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("lead_id, segment_id, created_at, amount")
      .eq("site_id", siteId)
      .not("lead_id", "is", null)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());
    
    if (salesError) {
      console.error("[Clients By Segment API] Error fetching sales:", salesError);
      // Continue anyway with the leads we have
    }
    
    // Diagnóstico: Mostrar las fechas de las ventas encontradas
    if (salesData && salesData.length > 0) {
      console.log(`[Clients By Segment API] Sales dates sample (first 5):`);
      salesData.slice(0, 5).forEach((sale, index) => {
        console.log(`  Sale ${index+1}: Lead=${sale.lead_id}, Segment=${sale.segment_id}, Created=${new Date(sale.created_at).toISOString()}, Amount=${sale.amount}`);
      });
    }
    
    // Diagnóstico: Obtener TODAS las ventas sin filtro de fechas para comparar
    try {
      const { data: allSalesData } = await supabase
        .from("sales")
        .select("lead_id, segment_id, created_at, amount")
        .eq("site_id", siteId)
        .not("lead_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (allSalesData && allSalesData.length > 0) {
        console.log(`[Clients By Segment API] All sales sample (first 10, regardless of date range):`);
        allSalesData.forEach((sale, index) => {
          console.log(`  AllSale ${index+1}: Lead=${sale.lead_id}, Segment=${sale.segment_id}, Created=${new Date(sale.created_at).toISOString()}, Amount=${sale.amount}`);
        });
      }
    } catch (error) {
      console.error("[Clients By Segment API] Error fetching all sales for diagnosis:", error);
    }
    
    // Check if we have any data at all for the specified period
    const hasLeads = leadsData && leadsData.length > 0;
    const hasSales = salesData && salesData.length > 0;
    
    if (!hasLeads && !hasSales) {
      console.log("[Clients By Segment API] No leads or sales found for the period");
      return NextResponse.json({ 
        segments: [],
        debug: {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          segmentsCount: segments.length,
          segmentsWithClientsCount: 0,
          totalLeads: 0,
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
      
      // Then try to get segment information from leads table for remaining leads
      try {
        // Filter out leads that already have segments from sales
        const remainingLeadIds = leadIdsArray.filter(id => !leadToSegmentMap[id]);
        
        if (remainingLeadIds.length > 0) {
          const { data: leadSegmentsData, error: leadSegmentsError } = await supabase
            .from("leads")
            .select("id, segment_id")
            .in("id", remainingLeadIds)
            .not("segment_id", "is", null);
          
          if (!leadSegmentsError && leadSegmentsData && leadSegmentsData.length > 0) {
            console.log(`[Clients By Segment API] Found ${leadSegmentsData.length} leads with segments`);
            
            // Count leads per segment
            leadSegmentsData.forEach(lead => {
              if (lead.segment_id && lead.id) {
                if (!segmentCounts[lead.segment_id]) {
                  segmentCounts[lead.segment_id] = 0;
                  
                  // Check if this segment exists in our segment list
                  const segmentExists = segments.some(segment => segment.id === lead.segment_id);
                  if (!segmentExists) {
                    unknownSegmentIds.add(lead.segment_id);
                  }
                }
                segmentCounts[lead.segment_id]++;
                unassignedCount--; // One less unassigned
              }
            });
          }
        }
      } catch (error) {
        console.log("[Clients By Segment API] Error fetching leads with segments:", error);
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
      
      // Check if we only have "Sin Segmento" in the results and no sales in the date range
      const onlyHasUnassignedSegment = 
        finalResults.length === 1 && 
        finalResults[0].name === "Sin Segmento" && 
        (salesData?? []).length === 0;
      
      // Don't return data if we only have unassigned leads and no sales
      if (onlyHasUnassignedSegment) {
        console.log("[Clients By Segment API] Only unassigned leads found with no sales in date range - returning empty result");
        return NextResponse.json({ 
          segments: [],
          debug: {
            startDate: format(startDate, "yyyy-MM-dd"),
            endDate: format(endDate, "yyyy-MM-dd"),
            segmentsCount: segments.length,
            segmentsWithClientsCount: 0,
            totalLeads: leadIdsArray.length,
            message: "Only unassigned leads with no sales in date range",
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
      
      // Return the data with debug information
      const finalResult = {
        segments: finalResults,
        debug: {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          segmentsCount: segments.length,
          segmentsWithClientsCount: finalResults.length,
          totalLeads: leadIdsArray.length,
          originalParams: {
            startDateParam,
            endDateParam,
            siteId,
            userId
          }
        }
      };
      
      console.log(`[Clients By Segment API] Returning ${finalResults.length} segments with clients`);
      return NextResponse.json(finalResult, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } else {
      console.log("[Clients By Segment API] No leads found for the period");
      // Return empty array if no leads found
      return NextResponse.json({ 
        segments: [],
        debug: {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          segmentsCount: segments.length,
          segmentsWithClientsCount: 0,
          totalLeads: 0,
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
    console.error("Error in clients by segment API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 