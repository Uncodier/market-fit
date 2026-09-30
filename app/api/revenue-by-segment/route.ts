import type { DistributionSale } from "@/app/api/distribution-types";
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

    // Read segments scoped to the authorized site.
    const { data, error } = await supabase
      .from("segments")
      .select("id, name, audience, engagement, is_active, site_id")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });

    if (error) {
      return [];
    }

    return data || [];
  } catch (error) {
    return [];
  }
}

async function getRevenueBySegment(request: Request) {
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

    // Get all segments for the site
    const segments = await getSegmentsForSite(supabase, siteId);

    // Get sales for the period
    let salesQuery = supabase
      .from("sales")
      .select("id, amount, segment_id, created_at")
      .eq("site_id", siteId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());
    if (segmentId && segmentId !== "all") salesQuery = salesQuery.eq("segment_id", segmentId);
    const { data: salesData, error: salesError } = await salesQuery;

    if (salesError) {
      return NextResponse.json(
        { error: "Failed to fetch sales" },
        { status: 500 }
      );
    }

    // If we have sales, process them
    if (salesData && salesData.length > 0) {
      // Group sales by segment
      const segmentRevenue: Record<string, number> = {};
      let unassignedRevenue = 0;

      // Track unknown segment IDs that we find in sales
      const unknownSegmentIds = new Set<string>();

      salesData.forEach((sale: DistributionSale) => {
        const amount = Number(sale.amount) || 0;
        if (sale.segment_id) {
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

        return {
          name: segment.name,
          value: segmentRevenue[segment.id] || 0,
          color: segmentColors[index % segmentColors.length]
        };
      });

      // Analyze all segment IDs with revenue

      // Add segments for unknown segment IDs found in sales
      let colorIndex = segments.length;
      unknownSegmentIds.forEach(segmentId => {
        revenueBySegment.push({
          name: `Unknown segment`,
          value: segmentRevenue[segmentId] || 0,
          color: segmentColors[colorIndex % segmentColors.length]
        });
        colorIndex++;
      });

      // Add unassigned segment if there's unassigned revenue
      if (unassignedRevenue > 0) {
        revenueBySegment.push({
          name: "Unassigned segment",
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

      return NextResponse.json(finalResult, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } else {
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return withAnalyticsCache(request, "revenue-by-segment:v2", getRevenueBySegment);
}
