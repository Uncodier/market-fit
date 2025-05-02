import { createApiClient } from "@/lib/supabase/server-client";
import { NextResponse } from "next/server";
import { format, subDays } from "date-fns";

interface CampaignInfo {
  id: string;
  title: string;
  type?: string;
}

async function getCampaignsForSite(supabase: any, siteId: string): Promise<CampaignInfo[]> {
  try {
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
    console.error("[Revenue By Campaign API] Missing site ID");
    return NextResponse.json(
      { error: "Site ID is required" },
      { status: 400 }
    );
  }
  
  try {
    const supabase = createApiClient();
    console.log(`[Revenue By Campaign API] Received request for site: ${siteId}`);
    
    // Parse dates
    const startDate = startDateParam ? new Date(startDateParam) : subDays(new Date(), 30);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    console.log(`[Revenue By Campaign API] Period: ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`);
    
    // Get all campaigns for the site
    const campaigns = await getCampaignsForSite(supabase, siteId);
    console.log(`[Revenue By Campaign API] Found ${campaigns.length} campaigns`);
    
    // Get sales for the period
    let salesQuery = supabase
      .from("sales")
      .select("id, amount, campaign_id, created_at")
      .eq("site_id", siteId)
      .gte("created_at", format(startDate, "yyyy-MM-dd"))
      .lte("created_at", format(endDate, "yyyy-MM-dd"));
    
    // Apply segment filter if provided
    if (segmentId && segmentId !== "all") {
      console.log(`[Revenue By Campaign API] Filtering by segment: ${segmentId}`);
      salesQuery = salesQuery.eq("segment_id", segmentId);
    }
    
    const { data: salesData, error: salesError } = await salesQuery;
    
    if (salesError) {
      console.error("[Revenue By Campaign API] Error fetching sales:", salesError);
      return NextResponse.json(
        { error: "Failed to fetch sales" },
        { status: 500 }
      );
    }
    
    // If we have sales, process them
    if (salesData && salesData.length > 0) {
      console.log(`[Revenue By Campaign API] Found ${salesData.length} sales for the period`);
      
      // Group sales by campaign
      const campaignRevenue: Record<string, number> = {};
      let unassignedRevenue = 0;
      
      salesData.forEach(sale => {
        const amount = Number(sale.amount) || 0;
        console.log(`[Revenue By Campaign API] Processing sale: amount=${amount}, campaign_id=${sale.campaign_id || "unassigned"}`);
        if (sale.campaign_id) {
          campaignRevenue[sale.campaign_id] = (campaignRevenue[sale.campaign_id] || 0) + amount;
        } else {
          unassignedRevenue += amount;
        }
      });
      
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
      const revenueByCampaign = campaigns.map(campaign => {
        // Determine color based on campaign type
        const type = campaign.type || "default";
        const color = campaignColors[type] || campaignColors.default;
        
        return {
          name: campaign.title,
          value: campaignRevenue[campaign.id] || 0,
          color
        };
      });
      
      // Add unassigned campaign if there's unassigned revenue
      if (unassignedRevenue > 0) {
        console.log(`[Revenue By Campaign API] Adding unassigned revenue: ${unassignedRevenue}`);
        revenueByCampaign.push({
          name: "Sin Campaña",
          value: unassignedRevenue,
          color: "#64748b" // slate
        });
      }
      
      // Filter out campaigns with no revenue and sort by value (descending)
      const finalResults = revenueByCampaign.filter(campaign => campaign.value > 0);
      finalResults.sort((a, b) => b.value - a.value);
      
      console.log(`[Revenue By Campaign API] Returning ${finalResults.length} campaigns with revenue`);
      return NextResponse.json({ campaigns: finalResults });
    } else {
      console.log("[Revenue By Campaign API] No sales found for the period");
      // Return empty array if no sales found
      return NextResponse.json({ campaigns: [] });
    }
  } catch (error) {
    console.error("Error in revenue by campaign API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 