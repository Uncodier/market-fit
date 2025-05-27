import { createApiClient, createServiceApiClient } from "@/lib/supabase/server-client";
import { NextResponse } from "next/server";
import { format, subDays } from "date-fns";

interface CampaignInfo {
  id: string;
  title: string;
  type?: string;
}

interface LeadInfo {
  id: string;
  campaign_id?: string;
}

async function getCampaignsForSite(supabase: any, siteId: string): Promise<CampaignInfo[]> {
  try {
    // Use the passed service client
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, title, type")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });
      
    if (error) {
      console.error("[getCampaignsForSite] Error:", error);
      return [];
    }
    
    console.log(`[getCampaignsForSite] Found ${data?.length || 0} campaigns for site ${siteId}`);
    return data || [];
  } catch (error) {
    console.error("Error fetching campaigns for site:", error);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const siteId = searchParams.get("siteId");
  const userId = searchParams.get("userId");
  const segmentId = searchParams.get("segmentId");
  
  if (!siteId) {
    console.error("[Clients By Campaign API] Missing site ID");
    return NextResponse.json(
      { error: "Site ID is required" },
      { status: 400 }
    );
  }
  
  try {
    const supabase = createServiceApiClient();
    console.log(`[Clients By Campaign API] Received request for site: ${siteId}`);
    console.log(`[Clients By Campaign API] Date parameters: startDate=${startDateParam}, endDate=${endDateParam}`);
    
    // Parse dates
    const startDate = startDateParam ? new Date(startDateParam) : subDays(new Date(), 30);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Check for future dates
    const now = new Date();
    
    // Validate that we're not querying future data
    if (startDate > now || endDate > now) {
      console.warn(`[Clients By Campaign API] Future date detected in request - startDate: ${startDate.toISOString()}, endDate: ${endDate.toISOString()}`);
      return NextResponse.json({ 
        campaigns: [],
        debug: {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          campaignsCount: 0,
          campaignsWithClientsCount: 0,
          totalLeads: 0,
          segmentFilter: segmentId && segmentId !== "all" ? segmentId : null,
          originalParams: {
            startDateParam,
            endDateParam,
            siteId,
            userId,
            segmentId
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
      console.warn(`[Clients By Campaign API] Future start date detected: ${startDate.toISOString()}, using 30 days ago instead`);
      startDate.setTime(subDays(now, 30).getTime());
    }
    if (endDate > now) {
      console.warn(`[Clients By Campaign API] Future end date detected: ${endDate.toISOString()}, using today instead`);
      endDate.setTime(now.getTime());
    }
    
    console.log(`[Clients By Campaign API] Validated period: ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`);
    
    // Get all campaigns for the site
    const campaigns = await getCampaignsForSite(supabase, siteId);
    console.log(`[Clients By Campaign API] Found ${campaigns.length} campaigns`);
    
    // Initialize client tracking
    const campaignCounts: Record<string, number> = {};
    let unassignedCount = 0;
    let totalLeads = 0;
    
    // First, get leads from the leads table
    let leadsQuery = supabase
      .from("leads")
      .select("id, campaign_id, created_at")
      .eq("site_id", siteId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());
    
    // If we have a segment filter, apply it if possible
    if (segmentId && segmentId !== "all") {
      console.log(`[Clients By Campaign API] Filtering by segment: ${segmentId}`);
      try {
        // Get leads that belong to the specified segment
        const { data: segmentLeads, error: segmentLeadsError } = await supabase
          .from("leads")
          .select("id")
          .eq("segment_id", segmentId);
        
        if (!segmentLeadsError && segmentLeads && segmentLeads.length > 0) {
          const leadIds = segmentLeads.map(item => item.id);
          console.log(`[Clients By Campaign API] Found ${leadIds.length} leads in segment from leads table`);
          
          // Update query to filter by these lead IDs
          leadsQuery = supabase
            .from("leads")
            .select("id, campaign_id, created_at")
            .eq("site_id", siteId)
            .in("id", leadIds)
            .gte("created_at", startDate.toISOString())
            .lte("created_at", endDate.toISOString());
        } else {
          console.log("[Clients By Campaign API] No leads found in segment via leads table");
        }
      } catch (error) {
        console.error("[Clients By Campaign API] Error with segment filtering via leads table:", error);
      }
    }
    
    // Execute the query
    const { data: leadsData, error: leadsError } = await leadsQuery;
    
    if (leadsError) {
      console.error("[Clients By Campaign API] Error fetching leads from leads table:", leadsError);
    } 
    
    // Diagnóstico: Mostrar las fechas de los leads encontrados
    if (leadsData && leadsData.length > 0) {
      console.log(`[Clients By Campaign API] Lead dates sample (first 5):`);
      leadsData.slice(0, 5).forEach((lead, index) => {
        console.log(`  Lead ${index+1}: ID=${lead.id}, Campaign=${lead.campaign_id}, Created=${new Date(lead.created_at).toISOString()}`);
      });
    }
    
    const hasLeadsData = leadsData && leadsData.length > 0;
    
    if (hasLeadsData) {
      console.log(`[Clients By Campaign API] Found ${leadsData.length} leads from leads table`);
      totalLeads += leadsData.length;
      
      // Count leads per campaign
      leadsData.forEach(lead => {
        if (lead.campaign_id) {
          campaignCounts[lead.campaign_id] = (campaignCounts[lead.campaign_id] || 0) + 1;
        } else {
          unassignedCount++;
        }
      });
    }
    
    // Now also check for leads from sales table
    let salesQuery = supabase
      .from("sales")
      .select("lead_id, campaign_id, created_at, amount")
      .eq("site_id", siteId)
      .not("lead_id", "is", null)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());
    
    // Apply segment filter if provided
    if (segmentId && segmentId !== "all") {
      console.log(`[Clients By Campaign API] Also filtering sales by segment: ${segmentId}`);
      salesQuery = salesQuery.eq("segment_id", segmentId);
    }
    
    const { data: salesData, error: salesError } = await salesQuery;
    
    if (salesError) {
      console.error("[Clients By Campaign API] Error fetching sales:", salesError);
    }
    
    // Diagnóstico: Mostrar las fechas de las ventas encontradas
    if (salesData && salesData.length > 0) {
      console.log(`[Clients By Campaign API] Sales dates sample (first 5):`);
      salesData.slice(0, 5).forEach((sale, index) => {
        console.log(`  Sale ${index+1}: Lead=${sale.lead_id}, Campaign=${sale.campaign_id}, Created=${new Date(sale.created_at).toISOString()}, Amount=${sale.amount}`);
      });
    }
    
    // Diagnóstico: Obtener TODAS las ventas sin filtro de fechas para comparar
    try {
      const { data: allSalesData } = await supabase
        .from("sales")
        .select("lead_id, campaign_id, created_at, amount")
        .eq("site_id", siteId)
        .not("lead_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (allSalesData && allSalesData.length > 0) {
        console.log(`[Clients By Campaign API] All sales sample (first 10, regardless of date range):`);
        allSalesData.forEach((sale, index) => {
          console.log(`  AllSale ${index+1}: Lead=${sale.lead_id}, Campaign=${sale.campaign_id}, Created=${new Date(sale.created_at).toISOString()}, Amount=${sale.amount}`);
        });
      }
    } catch (error) {
      console.error("[Clients By Campaign API] Error fetching all sales for diagnosis:", error);
    }
    
    const hasSalesData = salesData && salesData.length > 0;
    
    if (hasSalesData) {
      console.log(`[Clients By Campaign API] Found ${salesData.length} sales with leads`);
      
      // Create a Set to track already counted leads to avoid duplicates
      const countedLeads = new Set<string>();
      
      // First, add all lead IDs we've already processed from the leads table
      if (hasLeadsData) {
        leadsData.forEach(lead => {
          if (lead.id) {
            countedLeads.add(lead.id);
          }
        });
      }
      
      // Now process sales
      salesData.forEach(sale => {
        if (sale.lead_id && !countedLeads.has(sale.lead_id)) {
          // This is a new lead we haven't counted yet
          totalLeads++;
          countedLeads.add(sale.lead_id);
          
          if (sale.campaign_id) {
            campaignCounts[sale.campaign_id] = (campaignCounts[sale.campaign_id] || 0) + 1;
          } else {
            unassignedCount++;
          }
        }
      });
    }
    
    // Check if we have any leads at all
    if (!hasLeadsData && !hasSalesData) {
      console.log("[Clients By Campaign API] No leads or sales found for the period");
      return NextResponse.json({ 
        campaigns: [],
        debug: {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          campaignsCount: campaigns.length,
          campaignsWithClientsCount: 0,
          totalLeads: 0,
          segmentFilter: segmentId && segmentId !== "all" ? segmentId : null,
          originalParams: {
            startDateParam,
            endDateParam,
            siteId,
            userId,
            segmentId
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
    
    console.log(`[Clients By Campaign API] Total unique leads found: ${totalLeads}`);
    
    if (totalLeads > 0) {
      // Define campaign colors based on type
      const campaignColors: Record<string, string> = {
        email: "#3b82f6",     // blue
        social: "#f97316",    // orange
        paid: "#10b981",      // green
        organic: "#8b5cf6",   // purple
        content: "#ec4899",   // pink
        referral: "#ef4444",  // red
        webinar: "#eab308",   // yellow
        partner: "#14b8a6",   // teal
        default: "#6366f1"    // indigo
      };
      
      // Prepare the final data
      const clientsByCampaign = campaigns.map(campaign => {
        // Determine color based on campaign type
        const type = campaign.type || "default";
        const color = campaignColors[type] || campaignColors.default;
        
        return {
          name: campaign.title,
          value: campaignCounts[campaign.id] || 0,
          color
        };
      });
      
      // Add unassigned campaign if there are any
      if (unassignedCount > 0) {
        console.log(`[Clients By Campaign API] Adding unassigned count: ${unassignedCount}`);
        clientsByCampaign.push({
          name: "Sin Campaña",
          value: unassignedCount,
          color: "#64748b" // slate
        });
      }
      
      // Filter out campaigns with no leads and sort by value (descending)
      const finalResults = clientsByCampaign.filter(campaign => campaign.value > 0);
      finalResults.sort((a, b) => b.value - a.value);
      
      // Check if we only have "Sin Campaña" in the results and no sales in the date range
      const onlyHasUnassignedCampaign = 
        finalResults.length === 1 && 
        finalResults[0].name === "Sin Campaña" && 
        (salesData ?? []).length === 0;
      
      // Don't return data if we only have unassigned leads and no sales
      if (onlyHasUnassignedCampaign) {
        console.log("[Clients By Campaign API] Only unassigned leads found with no sales in date range - returning empty result");
        return NextResponse.json({ 
          campaigns: [],
          debug: {
            startDate: format(startDate, "yyyy-MM-dd"),
            endDate: format(endDate, "yyyy-MM-dd"),
            campaignsCount: campaigns.length,
            campaignsWithClientsCount: 0,
            totalLeads: totalLeads,
            segmentFilter: segmentId && segmentId !== "all" ? segmentId : null,
            message: "Only unassigned leads with no sales in date range",
            originalParams: {
              startDateParam,
              endDateParam,
              siteId,
              userId,
              segmentId
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
        campaigns: finalResults,
        debug: {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          campaignsCount: campaigns.length,
          campaignsWithClientsCount: finalResults.length,
          totalLeads: totalLeads,
          segmentFilter: segmentId && segmentId !== "all" ? segmentId : null,
          originalParams: {
            startDateParam,
            endDateParam,
            siteId,
            userId,
            segmentId
          }
        }
      };
      
      console.log(`[Clients By Campaign API] Returning ${finalResults.length} campaigns with clients`);
      return NextResponse.json(finalResult, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } else {
      console.log("[Clients By Campaign API] No leads found for the period");
      // Return empty array if no leads found
      return NextResponse.json({ 
        campaigns: [],
        debug: {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          campaignsCount: campaigns.length,
          campaignsWithClientsCount: 0,
          totalLeads: 0,
          segmentFilter: segmentId && segmentId !== "all" ? segmentId : null,
          originalParams: {
            startDateParam,
            endDateParam,
            siteId,
            userId,
            segmentId
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
    console.error("Error in clients by campaign API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 