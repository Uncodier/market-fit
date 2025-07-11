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
    console.log(`[Regions API] Querying visitor_sessions for site_id: ${siteId}, dates: ${startDate} to ${endDate}`);
    
    // Get location data from visitor_sessions (location is stored as jsonb)
    const { data: regionData, error: regionError } = await supabase
      .from('visitor_sessions')
      .select('location')
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('location', 'is', null);

    console.log(`[Regions API] Query result:`, { 
      count: regionData?.length || 0, 
      error: regionError?.message || 'none' 
    });

    if (regionError) {
      console.log(`[Regions API] Database error:`, regionError);
      return NextResponse.json({ data: [] });
    }

    // Count visits by region/country from location jsonb
    const regionCounts = new Map<string, number>();
    
    regionData?.forEach(session => {
      let regionName = 'Unknown';
      
      if (session.location) {
        // Extract country from location jsonb
        const location = session.location as any;
        
        if (location.country) {
          regionName = location.country;
        } else if (location.countryCode) {
          // Convert country code to country name if needed
          regionName = location.countryCode;
        } else if (location.region) {
          regionName = location.region;
        } else if (location.city) {
          regionName = location.city;
        }
      }
      
      // Normalize common country names and codes
      if (regionName.toLowerCase().includes('united states') || regionName.toLowerCase() === 'us' || regionName.toLowerCase() === 'usa') {
        regionName = 'United States';
      } else if (regionName.toLowerCase().includes('united kingdom') || regionName.toLowerCase() === 'gb' || regionName.toLowerCase() === 'uk') {
        regionName = 'United Kingdom';
      } else if (regionName.toLowerCase() === 'ca' || regionName.toLowerCase().includes('canada')) {
        regionName = 'Canada';
      } else if (regionName.toLowerCase() === 'au' || regionName.toLowerCase().includes('australia')) {
        regionName = 'Australia';
      } else if (regionName.toLowerCase() === 'de' || regionName.toLowerCase().includes('germany')) {
        regionName = 'Germany';
      } else if (regionName.toLowerCase() === 'fr' || regionName.toLowerCase().includes('france')) {
        regionName = 'France';
      } else if (regionName.toLowerCase() === 'es' || regionName.toLowerCase().includes('spain')) {
        regionName = 'Spain';
      } else if (regionName.toLowerCase() === 'it' || regionName.toLowerCase().includes('italy')) {
        regionName = 'Italy';
      } else if (regionName.toLowerCase() === 'br' || regionName.toLowerCase().includes('brazil')) {
        regionName = 'Brazil';
      } else if (regionName.toLowerCase() === 'in' || regionName.toLowerCase().includes('india')) {
        regionName = 'India';
      } else if (regionName.toLowerCase() === 'jp' || regionName.toLowerCase().includes('japan')) {
        regionName = 'Japan';
      } else if (regionName.toLowerCase() === 'cn' || regionName.toLowerCase().includes('china')) {
        regionName = 'China';
      } else if (regionName.toLowerCase() === 'mx' || regionName.toLowerCase().includes('mexico')) {
        regionName = 'Mexico';
      } else if (regionName.toLowerCase() === 'nl' || regionName.toLowerCase().includes('netherlands')) {
        regionName = 'Netherlands';
      } else if (regionName.toLowerCase() === 'sg' || regionName.toLowerCase().includes('singapore')) {
        regionName = 'Singapore';
      }
      
      regionCounts.set(regionName, (regionCounts.get(regionName) || 0) + 1);
    });

    // Convert to array and sort by count
    const sortedRegions = Array.from(regionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Top 10 regions
      .map(([name, value]) => ({ name, value }));

    const response = { data: sortedRegions };
    
    console.log(`[Regions API] Returning real data:`, response);
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching regions data:", error);
    
    // Return empty data instead of demo data
    return NextResponse.json({ data: [] });
  }
} 