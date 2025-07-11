import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get("siteId");
  const userId = searchParams.get("userId");
  const segmentId = searchParams.get("segmentId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!siteId || !userId) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  const supabase = await createServiceClient(); // Use service client to bypass RLS for analytics data

  try {
    console.log(`[Browsers API] Querying visitor_sessions for site_id: ${siteId}, dates: ${startDate} to ${endDate}`);
    
    // Get browser data from visitor_sessions (browser is stored as jsonb)
    const { data: browserData, error: browserError } = await supabase
      .from('visitor_sessions')
      .select('browser, device')
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    console.log(`[Browsers API] Query result:`, { 
      count: browserData?.length || 0, 
      error: browserError?.message || 'none' 
    });

    if (browserError) {
      console.log(`[Browsers API] Database error:`, browserError);
      return NextResponse.json({ data: [] });
    }

    // Count visits by browser from browser jsonb
    const browserCounts = new Map<string, number>();
    
    browserData?.forEach(session => {
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
    
    console.log(`[Browsers API] Returning real data:`, response);
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching browsers data:", error);
    
    // Return empty data instead of demo data
    return NextResponse.json({ data: [] });
  }
} 