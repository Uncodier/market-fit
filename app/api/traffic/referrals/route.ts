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
    console.log(`[Referrals API] Querying visitor_sessions for site_id: ${siteId}, dates: ${startDate} to ${endDate}`);
    
    // Get referral data from visitor_sessions (using referrer column)
    const { data: referralData, error: referralError } = await supabase
      .from('visitor_sessions')
      .select('referrer, utm_source, utm_medium, utm_campaign')
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    console.log(`[Referrals API] Query result:`, { 
      count: referralData?.length || 0, 
      error: referralError?.message || 'none' 
    });

    if (referralError) {
      console.log(`[Referrals API] Database error:`, referralError);
      return NextResponse.json({ data: [] });
    }

    // Count visits by referrer source
    const referrerCounts = new Map<string, number>();
    
    referralData?.forEach(session => {
      let referrerName = 'Direct';
      
      // Check UTM source first (most reliable)
      if (session.utm_source) {
        referrerName = session.utm_source;
        
        // Add UTM medium if available
        if (session.utm_medium) {
          referrerName += ` (${session.utm_medium})`;
        }
        
        // Add campaign if available
        if (session.utm_campaign) {
          referrerName += ` - ${session.utm_campaign}`;
        }
      } else if (session.referrer) {
        try {
          // Extract domain from referrer URL
          const referrerUrl = new URL(session.referrer);
          const domain = referrerUrl.hostname;
          
          // Normalize common referrer names
          if (domain.includes('google.com') || domain.includes('google.')) {
            referrerName = 'Google';
          } else if (domain.includes('facebook.com') || domain.includes('fb.com')) {
            referrerName = 'Facebook';
          } else if (domain.includes('twitter.com') || domain.includes('t.co')) {
            referrerName = 'Twitter';
          } else if (domain.includes('linkedin.com')) {
            referrerName = 'LinkedIn';
          } else if (domain.includes('instagram.com')) {
            referrerName = 'Instagram';
          } else if (domain.includes('youtube.com')) {
            referrerName = 'YouTube';
          } else if (domain.includes('pinterest.com')) {
            referrerName = 'Pinterest';
          } else if (domain.includes('reddit.com')) {
            referrerName = 'Reddit';
          } else if (domain.includes('tiktok.com')) {
            referrerName = 'TikTok';
          } else if (domain.includes('snapchat.com')) {
            referrerName = 'Snapchat';
          } else if (domain.includes('whatsapp.com')) {
            referrerName = 'WhatsApp';
          } else if (domain.includes('telegram.')) {
            referrerName = 'Telegram';
          } else if (domain.includes('discord.')) {
            referrerName = 'Discord';
          } else if (domain.includes('bing.com')) {
            referrerName = 'Bing';
          } else if (domain.includes('yahoo.com')) {
            referrerName = 'Yahoo';
          } else if (domain.includes('duckduckgo.com')) {
            referrerName = 'DuckDuckGo';
          } else if (domain.includes('baidu.com')) {
            referrerName = 'Baidu';
          } else if (domain.includes('yandex.')) {
            referrerName = 'Yandex';
          } else {
            // Use the domain name, removing www. prefix
            referrerName = domain.replace('www.', '');
          }
        } catch (e) {
          // If URL parsing fails, use the raw referrer
          referrerName = session.referrer;
        }
      }
      
      referrerCounts.set(referrerName, (referrerCounts.get(referrerName) || 0) + 1);
    });

    // Convert to array and sort by count
    const sortedReferrers = Array.from(referrerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Top 10 referrers
      .map(([name, value]) => ({ name, value }));

    const response = { data: sortedReferrers };
    
    console.log(`[Referrals API] Returning real data:`, response);
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching referrals data:", error);
    
    // Return empty data instead of demo data
    return NextResponse.json({ data: [] });
  }
} 