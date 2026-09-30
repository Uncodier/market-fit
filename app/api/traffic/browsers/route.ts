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
    namespace: "traffic:browsers:v2",
    siteId: access.siteId,
    load: async () => {
      try {
        const supabase = await createServiceClient();

        // Get browser data from visitor_sessions (browser is stored as jsonb)
        const query = supabase
          .from('visitor_sessions')
          .select('browser, device')
          .eq('site_id', siteId)
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        const { data: browserData, error: browserError } = await query;

        if (browserError) {
          return NextResponse.json({ error: "Unable to load browsers report" }, { status: 500 });
        }

        // Count visits by browser from browser jsonb
        const browserCounts = new Map<string, number>();

        browserData?.forEach((session: TrafficSession) => {
          let browserName = 'Unknown';

          if (session.browser) {
            // Extract browser name from browser jsonb
            const browser = session.browser as any;

            if (browser.name) {
              browserName = browser.name;
            } else if (browser.browser) {
              browserName = browser.browser;
            } else if (browser.family) {
              browserName = browser.family;
            } else if (browser.userAgent) {
              // Try to extract browser from user agent
              const userAgent = browser.userAgent.toLowerCase();
              if (userAgent.includes('chrome') && !userAgent.includes('edge')) {
                browserName = 'Chrome';
              } else if (userAgent.includes('firefox')) {
                browserName = 'Firefox';
              } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
                browserName = 'Safari';
              } else if (userAgent.includes('edge')) {
                browserName = 'Edge';
              } else if (userAgent.includes('opera')) {
                browserName = 'Opera';
              } else if (userAgent.includes('internet explorer') || userAgent.includes('msie')) {
                browserName = 'Internet Explorer';
              }
            }
          } else if (session.device) {
            // Fallback to device jsonb if browser info is not available
            const device = session.device as any;
            if (device.browser) {
              browserName = device.browser;
            } else if (device.userAgent) {
              const userAgent = device.userAgent.toLowerCase();
              if (userAgent.includes('chrome') && !userAgent.includes('edge')) {
                browserName = 'Chrome';
              } else if (userAgent.includes('firefox')) {
                browserName = 'Firefox';
              } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
                browserName = 'Safari';
              } else if (userAgent.includes('edge')) {
                browserName = 'Edge';
              } else if (userAgent.includes('opera')) {
                browserName = 'Opera';
              } else if (userAgent.includes('internet explorer') || userAgent.includes('msie')) {
                browserName = 'Internet Explorer';
              }
            }
          }

          // Normalize browser names
          if (browserName.toLowerCase().includes('chrome')) {
            browserName = 'Chrome';
          } else if (browserName.toLowerCase().includes('firefox')) {
            browserName = 'Firefox';
          } else if (browserName.toLowerCase().includes('safari')) {
            browserName = 'Safari';
          } else if (browserName.toLowerCase().includes('edge')) {
            browserName = 'Edge';
          } else if (browserName.toLowerCase().includes('opera')) {
            browserName = 'Opera';
          } else if (browserName.toLowerCase().includes('internet explorer') || browserName.toLowerCase().includes('msie')) {
            browserName = 'Internet Explorer';
          } else if (browserName.toLowerCase().includes('samsung')) {
            browserName = 'Samsung Internet';
          } else if (browserName.toLowerCase().includes('brave')) {
            browserName = 'Brave';
          } else if (browserName.toLowerCase().includes('vivaldi')) {
            browserName = 'Vivaldi';
          } else if (browserName.toLowerCase() === 'unknown') {
            browserName = 'Other';
          }

          browserCounts.set(browserName, (browserCounts.get(browserName) || 0) + 1);
        });

        // Convert to array and sort by count
        const sortedBrowsers = Array.from(browserCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10) // Top 10 browsers
          .map(([name, value]) => ({ name, value }));

        const response = { data: sortedBrowsers };

        return NextResponse.json(response);

      } catch (error) {

        return NextResponse.json({ error: "Unable to load browsers report" }, { status: 500 });
  }
    },
  });
}
