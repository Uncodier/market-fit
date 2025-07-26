import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();
    console.log('Fetching page visits referrers for site:', siteId, 'from:', startDate, 'to:', endDate);

    // Fetch site information to get main domain
    const { data: siteData, error: siteError } = await supabase
      .from('sites')
      .select('url')
      .eq('id', siteId)
      .single();

    if (siteError) {
      console.error('Error fetching site data:', siteError);
      return NextResponse.json(
        { error: 'Failed to fetch site data' },
        { status: 500 }
      );
    }

    // Fetch allowed domains for this site
    const { data: allowedDomains, error: domainsError } = await supabase
      .from('allowed_domains')
      .select('domain')
      .eq('site_id', siteId);

    if (domainsError) {
      console.error('Error fetching allowed domains:', domainsError);
      return NextResponse.json(
        { error: 'Failed to fetch allowed domains' },
        { status: 500 }
      );
    }

    // Build list of domains to filter out
    const domainsToFilter = new Set<string>();
    
    // Add localhost variants
    domainsToFilter.add('localhost');
    domainsToFilter.add('127.0.0.1');
    domainsToFilter.add('0.0.0.0');
    
    // Add main site domain if it exists
    if (siteData.url) {
      try {
        const siteUrl = new URL(siteData.url);
        let siteDomain = siteUrl.hostname.toLowerCase();
        if (siteDomain.startsWith('www.')) {
          siteDomain = siteDomain.substring(4);
        }
        domainsToFilter.add(siteDomain);
        domainsToFilter.add('www.' + siteDomain); // Also filter www variant
      } catch (e) {
        console.warn('Could not parse site URL:', siteData.url);
      }
    }
    
    // Add allowed domains
    if (allowedDomains) {
      allowedDomains.forEach(domain => {
        let normalizedDomain = domain.domain.toLowerCase();
        if (normalizedDomain.startsWith('www.')) {
          normalizedDomain = normalizedDomain.substring(4);
        }
        domainsToFilter.add(normalizedDomain);
        domainsToFilter.add('www.' + normalizedDomain); // Also filter www variant
      });
    }

    console.log('Domains to filter out:', Array.from(domainsToFilter));

    // First, let's check if there are any page visits at all
    // CRITICAL: Filter by event_type to count only actual page views, not all events
    const { data: allEvents, error: allEventsError } = await supabase
      .from('session_events')
      .select('referrer')
      .eq('site_id', siteId)
      .eq('event_type', 'pageview')  // Only count actual page views
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    console.log('All page visits for referrers check:', {
      count: allEvents?.length || 0,
      error: allEventsError?.message || 'none',
      sampleReferrers: allEvents?.slice(0, 5).map(e => e.referrer) || []
    });

    if (allEventsError) {
      console.error('Error fetching page visits referrers:', allEventsError);
      return NextResponse.json(
        { error: 'Failed to fetch data' },
        { status: 500 }
      );
    }

    if (!allEvents || allEvents.length === 0) {
      console.log('No page visits referrers found for site:', siteId);
      return NextResponse.json({
        data: []
      });
    }

    // Group by referrer and count occurrences - NORMALIZE referrers by domain and FILTER
    const referrerCounts = allEvents.reduce((acc: Record<string, { count: number; fullUrl: string }>, event) => {
      let referrer = event.referrer || 'Direct';
      let normalizedReferrer = referrer;
      
      // If it's a URL, extract the domain
      if (referrer !== 'Direct' && referrer) {
        try {
          const url = new URL(referrer);
          normalizedReferrer = url.hostname.toLowerCase();
          // Remove www. prefix for consistency
          if (normalizedReferrer.startsWith('www.')) {
            normalizedReferrer = normalizedReferrer.substring(4);
          }
          
          // Filter out localhost and same-site referrers
          if (domainsToFilter.has(normalizedReferrer) || domainsToFilter.has('www.' + normalizedReferrer)) {
            return acc; // Skip this referrer
          }
        } catch (e) {
          // If URL parsing fails, use the original referrer
          normalizedReferrer = referrer;
        }
      }
      
      // Group by normalized referrer, but keep track of a sample full URL
      if (!acc[normalizedReferrer]) {
        acc[normalizedReferrer] = { count: 0, fullUrl: referrer };
      }
      acc[normalizedReferrer].count += 1;
      
      return acc;
    }, {});

    // Calculate total for percentage calculation (excluding filtered referrers)
    const totalValidEvents = Object.values(referrerCounts).reduce((sum: number, data: { count: number; fullUrl: string }) => sum + data.count, 0);

    // Convert to array format and sort by count
    const referrerData = Object.entries(referrerCounts)
      .map(([referrer, data]: [string, { count: number; fullUrl: string }]) => ({
        referrer,
        count: data.count,
        percentage: totalValidEvents > 0 ? Number(((data.count / (totalValidEvents as number)) * 100).toFixed(1)) : 0,
        fullUrl: data.fullUrl
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    console.log('Page visits referrers data processed:', {
      totalEvents: allEvents.length,
      totalValidEvents,
      filteredOutEvents: allEvents.length - (totalValidEvents as number),
      uniqueReferrers: Object.keys(referrerCounts).length,
      topReferrers: referrerData.slice(0, 5)
    });

    return NextResponse.json({ data: referrerData });

  } catch (error) {
    console.error('Error in page visits referrers API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 