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
    console.log(`[Pages API] Querying visitor_sessions for site_id: ${siteId}, dates: ${startDate} to ${endDate}`);
    
    // Get page views data from visitor_sessions (using landing_url and current_url)
    const { data: pageData, error: pageError } = await supabase
      .from('visitor_sessions')
      .select('landing_url, current_url, custom_data')
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    console.log(`[Pages API] Query result:`, { 
      count: pageData?.length || 0, 
      error: pageError?.message || 'none' 
    });

    if (pageError) {
      console.log(`[Pages API] Database error:`, pageError);
      return NextResponse.json({ data: [] });
    }

    // Count page views and group by page
    const pageViews = new Map<string, number>();
    
    pageData?.forEach(session => {
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
    
    console.log(`[Pages API] Returning real data:`, response);
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching pages data:", error);
    
    // Return empty data instead of demo data
    return NextResponse.json({ data: [] });
  }
} 