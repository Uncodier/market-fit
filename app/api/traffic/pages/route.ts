import type { TrafficSession } from "@/app/api/distribution-types";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access";
import { readThroughAnalyticsResponseCache } from "@/lib/redis/analytics-response-cache";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const segmentId = searchParams.get("segmentId");

  const access = await requireAnalyticsAccess(request);
  if (access.error) return access.error;
  // Session attribution does not yet include a segment column.
  if (segmentId && segmentId !== "all") {
    return NextResponse.json({ error: "Segment filtering is not available for this report. Select all segments." }, { status: 422 });
  }
  const { siteId } = access;
  const startDate = access.startDate.toISOString();
  const endDate = access.endDate.toISOString();

  return readThroughAnalyticsResponseCache({
    request,
    namespace: "traffic:pages:v2",
    siteId: access.siteId,
    load: async () => {
      try {
        const supabase = await createServiceClient();

        // Get page views data from visitor_sessions (using landing_url and current_url)
        const query = supabase
          .from('visitor_sessions')
          .select('landing_url, current_url, custom_data')
          .eq('site_id', siteId)
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        const { data: pageData, error: pageError } = await query;

        if (pageError) {
          return NextResponse.json({ error: "Unable to load pages report" }, { status: 500 });
        }

        // Count page views and group by page
        const pageViews = new Map<string, number>();

        pageData?.forEach((session: TrafficSession) => {
          // Process both landing_url and current_url
          const urls = [];
          if (session.landing_url) urls.push(session.landing_url);
          if (session.current_url && session.current_url !== session.landing_url) {
            urls.push(session.current_url);
          }

          // Check if there's page title in custom_data
          let customPageTitle = null;
          if (session.custom_data) {
            const customData = session.custom_data as any;
            if (customData.page_title || customData.title) {
              customPageTitle = customData.page_title || customData.title;
            }
          }

          urls.forEach(url => {
            let pageName = 'Unknown Page';

            if (customPageTitle) {
              pageName = customPageTitle;
            } else if (url) {
              try {
                // Extract path from URL and make it readable
                const urlObj = new URL(url);
                const path = urlObj.pathname;

                if (path === '/' || path === '') {
                  pageName = 'Home Page';
                } else {
                  // Convert path to readable format
                  pageName = path
                    .replace(/^\//, '') // Remove leading slash
                    .replace(/\/$/, '') // Remove trailing slash
                    .replace(/-/g, ' ') // Replace hyphens with spaces
                    .replace(/_/g, ' ') // Replace underscores with spaces
                    .replace(/\//g, ' > ') // Replace slashes with breadcrumb
                    .replace(/\b\w/g, (l: string) => l.toUpperCase()); // Capitalize words

                  if (!pageName) pageName = 'Home Page';
                }
              } catch (e) {
                // If URL parsing fails, use the raw URL
                pageName = url.replace(/https?:\/\/[^\/]+/, '') || 'Home Page';
              }
            }

            pageViews.set(pageName, (pageViews.get(pageName) || 0) + 1);
          });
        });

        // Convert to array and sort by views
        const sortedPages = Array.from(pageViews.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10) // Top 10 pages
          .map(([name, value]) => ({ name, value }));

        const response = { data: sortedPages };

        return NextResponse.json(response);

      } catch (error) {

        return NextResponse.json({ error: "Unable to load pages report" }, { status: 500 });
  }
    },
  });
}
