import type { DistributionLead, DistributionSale } from "@/app/api/distribution-types";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access";
import {
  normalizedRequestCacheKey,
  readThroughJsonCache,
} from "@/lib/redis/json-cache";

function analyticsAccessRequest(request: Request) {
  const url = new URL(request.url);
  const endValue = url.searchParams.get("endDate");
  const endDate = endValue ? new Date(endValue) : new Date();

  if (!endValue) url.searchParams.set("endDate", endDate.toISOString());
  if (!url.searchParams.has("startDate")) {
    const startDate = new Date(
      (Number.isFinite(endDate.getTime()) ? endDate : new Date()).getTime()
        - 30 * 24 * 60 * 60 * 1000
    );
    url.searchParams.set("startDate", startDate.toISOString());
  }

  return new Request(url, { headers: request.headers });
}

async function withAnalyticsCache(
  request: Request,
  namespace: string,
  load: (request: Request) => Promise<Response>
) {
  const scopedRequest = analyticsAccessRequest(request);
  const access = await requireAnalyticsAccess(scopedRequest);
  if (access.error) return access.error;

  try {
    const key = await normalizedRequestCacheKey(namespace, request);
    const result = await readThroughJsonCache({
      key,
      ttlSeconds: 45,
      compute: async () => {
        const response = await load(scopedRequest);
        if (!response.ok) throw response;
        return {
          body: await response.json(),
          headers: Object.fromEntries(response.headers.entries()),
        };
      },
    });

    if (result.status === "busy") {
      return NextResponse.json(
        { error: "Analytics are being refreshed" },
        { status: 503, headers: { "Retry-After": "2" } }
      );
    }

    const headers = new Headers(result.value.headers);
    headers.set("X-Cache", result.status.toUpperCase());
    return NextResponse.json(result.value.body, { headers });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}

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
    // Use the passed service client and only get active campaigns
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, title, type")
      .eq("site_id", siteId)
      .eq("status", "active") // Only get active campaigns
      .order("created_at", { ascending: false });

    if (error) {
      return [];
    }

    return data || [];
  } catch (error) {
    return [];
  }
}

async function getClientsByCampaign(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const siteId = searchParams.get("siteId");
  const userId = null;
  const segmentId = searchParams.get("segmentId");

  if (!siteId) {
    return NextResponse.json(
      { error: "Site ID is required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    // Parse dates
    const startDate = startDateParam ? new Date(startDateParam) : subDays(new Date(), 30);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();

    // Keep the requested calendar boundaries, including the remainder of today.

    // Get all campaigns for the site
    const campaigns = await getCampaignsForSite(supabase, siteId);

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

    // Filter directly: an empty segment must not fall back to all leads.
    if (segmentId && segmentId !== "all") leadsQuery = leadsQuery.eq("segment_id", segmentId);

    // Execute the query
    const { data: leadsData, error: leadsError } = await leadsQuery;

    if (leadsError) {
      return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
    }

    const hasLeadsData = leadsData && leadsData.length > 0;

    if (hasLeadsData) {
      totalLeads += leadsData.length;

      // Count leads per campaign
      leadsData.forEach((lead: DistributionLead) => {
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
      salesQuery = salesQuery.eq("segment_id", segmentId);
    }

    const { data: salesData, error: salesError } = await salesQuery;

    if (salesError) {
      return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
    }

    const hasSalesData = salesData && salesData.length > 0;

    if (hasSalesData) {
      // Create a Set to track already counted leads to avoid duplicates
      const countedLeads = new Set<string>();

      // First, add all lead IDs we've already processed from the leads table
      if (hasLeadsData) {
        leadsData.forEach((lead: DistributionLead) => {
          if (lead.id) {
            countedLeads.add(lead.id);
          }
        });
      }

      // Now process sales
      salesData.forEach((sale: DistributionSale) => {
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
        clientsByCampaign.push({
          name: "Unassigned campaign",
          value: unassignedCount,
          color: "#64748b" // slate
        });
      }

      // Filter out campaigns with no leads and sort by value (descending)
      const finalResults = clientsByCampaign.filter(campaign => campaign.value > 0);
      finalResults.sort((a, b) => b.value - a.value);

      // Check if we only have "Unassigned campaign" in the results and no sales in the date range
      const onlyHasUnassignedCampaign =
        finalResults.length === 1 &&
        finalResults[0].name === "Unassigned campaign" &&
        (salesData ?? []).length === 0;

      // Don't return data if we only have unassigned leads and no sales
      if (onlyHasUnassignedCampaign) {
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

      return NextResponse.json(finalResult, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } else {
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return withAnalyticsCache(request, "clients-by-campaign:v2", getClientsByCampaign);
}
