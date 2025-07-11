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
    console.log(`[Devices API] Querying visitor_sessions for site_id: ${siteId}, dates: ${startDate} to ${endDate}`);
    
    // Get device data from visitor_sessions (device is stored as jsonb)
    const { data: deviceData, error: deviceError } = await supabase
      .from('visitor_sessions')
      .select('device, browser')
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    console.log(`[Devices API] Query result:`, { 
      count: deviceData?.length || 0, 
      error: deviceError?.message || 'none' 
    });

    if (deviceError) {
      console.log(`[Devices API] Database error:`, deviceError);
      return NextResponse.json({ data: [] });
    }

    // Count visits by device type from device jsonb
    const deviceCounts = new Map<string, number>();
    
    deviceData?.forEach(session => {
      let deviceType = 'Unknown';
      
      if (session.device) {
        // Extract device type from device jsonb
        const device = session.device as any;
        
        if (device.type) {
          deviceType = device.type;
        } else if (device.category) {
          deviceType = device.category;
        } else if (device.device_type) {
          deviceType = device.device_type;
        } else if (device.model && device.model.toLowerCase().includes('tv')) {
          deviceType = 'Smart TV';
        } else if (device.os) {
          // Try to determine from OS
          const os = device.os.toLowerCase();
          if (os.includes('android') || os.includes('ios')) {
            if (device.model && (device.model.toLowerCase().includes('tablet') || device.model.toLowerCase().includes('ipad'))) {
              deviceType = 'Tablet';
            } else {
              deviceType = 'Mobile';
            }
          } else {
            deviceType = 'Desktop';
          }
        }
      } else if (session.browser) {
        // Fallback to browser jsonb if device info is not available
        const browser = session.browser as any;
        if (browser.device_type) {
          deviceType = browser.device_type;
        } else if (browser.mobile === true) {
          deviceType = 'Mobile';
        } else {
          deviceType = 'Desktop';
        }
      }
      
      // Normalize device type names
      if (deviceType.toLowerCase().includes('mobile') || deviceType.toLowerCase().includes('phone') || deviceType.toLowerCase().includes('smartphone')) {
        deviceType = 'Mobile';
      } else if (deviceType.toLowerCase().includes('tablet') || deviceType.toLowerCase().includes('pad')) {
        deviceType = 'Tablet';
      } else if (deviceType.toLowerCase().includes('desktop') || deviceType.toLowerCase().includes('computer') || deviceType.toLowerCase().includes('pc')) {
        deviceType = 'Desktop';
      } else if (deviceType.toLowerCase().includes('tv') || deviceType.toLowerCase().includes('smart') || deviceType.toLowerCase().includes('television')) {
        deviceType = 'Smart TV';
      } else if (deviceType.toLowerCase() === 'unknown') {
        deviceType = 'Desktop'; // Default unknown to desktop
      }
      
      deviceCounts.set(deviceType, (deviceCounts.get(deviceType) || 0) + 1);
    });

    // Convert to array and sort by count
    const sortedDevices = Array.from(deviceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Top 10 devices
      .map(([name, value]) => ({ name, value }));

    const response = { data: sortedDevices };
    
    console.log(`[Devices API] Returning real data:`, response);
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching devices data:", error);
    
    // Return empty data instead of demo data
    return NextResponse.json({ data: [] });
  }
} 