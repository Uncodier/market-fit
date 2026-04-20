import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isMakinariInternalReferrerHostname } from '@/lib/traffic/makinari-internal-referrer';
import { isExternalReferralPageview } from '@/lib/traffic/external-referral-pageview';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const segmentId = searchParams.get('segmentId');
  const referrersLimit = parseInt(searchParams.get('referrersLimit') || '10');

  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();
    console.log('Fetching page visits combined data for site:', siteId, 'segment:', segmentId || 'all', 'from:', startDate, 'to:', endDate);

    // Fetch site information to get main domain
    const { data: siteData, error: siteError } = await supabase
      .from('sites')
      .select('url')
      .eq('id', siteId)
      .single();

    if (siteError) {
      console.error('Error fetching site data:', siteError);
    }

    // Fetch allowed domains for this site
    const { data: allowedDomains, error: domainsError } = await supabase
      .from('allowed_domains')
      .select('domain')
      .eq('site_id', siteId);

    if (domainsError) {
      console.error('Error fetching allowed domains:', domainsError);
    }

    // Build list of domains to filter out
    const domainsToFilter = new Set<string>();
    
    // Add localhost variants
    domainsToFilter.add('localhost');
    domainsToFilter.add('127.0.0.1');
    domainsToFilter.add('0.0.0.0');
    
    // Add main site domain if it exists
    if (siteData?.url) {
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

    console.log('Domains to filter out from referrers:', Array.from(domainsToFilter));

    // Use ONLY session_events table to derive both metrics for consistency
    // CRITICAL: Filter by event_type to count only actual page views, not all events
    
    let allEvents: any[] = [];
    let eventsError = null;
    let hasMore = true;
    let from = 0;
    const step = 1000;

    // Fetch in batches to avoid the 1000 row limit from Supabase PostgREST
    while (hasMore) {
      let query = supabase
        .from('session_events')
        .select('created_at, referrer, visitor_id')
        .eq('site_id', siteId)
        .eq('event_type', 'pageview')  // Only count actual page views
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .range(from, from + step - 1);

      // Add segment filter if specified and not "all"
      if (segmentId && segmentId !== 'all') {
        query = query.eq('segment_id', segmentId);
      }

      const { data, error } = await query;

      if (error) {
        eventsError = error;
        break;
      }

      if (data && data.length > 0) {
        allEvents = [...allEvents, ...data];
        from += step;
        
        // If we got fewer records than the step, we've reached the end
        if (data.length < step) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    console.log('Combined page visits query result:', {
      eventsCount: allEvents?.length || 0,
      eventsError: eventsError?.message || 'none'
    });

    if (eventsError) {
      console.error('Error fetching page visits:', eventsError);
      return NextResponse.json(
        { error: 'Failed to fetch events data' },
        { status: 500 }
      );
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const daysBack = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (24 * 60 * 60 * 1000));
    
    // Initialize date buckets
    const eventsByDay = new Map<string, number>();
    const visitorsByDay = new Map<string, Set<string>>();
    const referralsByDay = new Map<string, number>();

    for (let i = 0; i < daysBack; i++) {
      const date = new Date(startDateObj.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      eventsByDay.set(dateStr, 0);
      visitorsByDay.set(dateStr, new Set());
      referralsByDay.set(dateStr, 0);
    }

    // Process metrics from the same dataset (session_events)
    allEvents?.forEach((event: any) => {
      const eventDate = new Date(event.created_at);
      const dateStr = eventDate.toISOString().split('T')[0];

      if (eventsByDay.has(dateStr)) {
        eventsByDay.set(dateStr, eventsByDay.get(dateStr)! + 1);

        if (event.visitor_id) {
          visitorsByDay.get(dateStr)!.add(event.visitor_id);
        }

        if (isExternalReferralPageview(event.referrer, domainsToFilter)) {
          referralsByDay.set(dateStr, (referralsByDay.get(dateStr) || 0) + 1);
        }
      }
    });

    const chartData = Array.from(eventsByDay.entries()).map(([date, pageVisits]) => {
      const uniqueVisitors = visitorsByDay.get(date)?.size || 0;
      const referralVisits = referralsByDay.get(date) || 0;

      return {
        date,
        pageVisits,
        uniqueVisitors,
        referralVisits,
        label: new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      };
    });

    // Process referrers data with proper normalization and filtering
    const referrerCounts = new Map<string, { count: number; fullUrl: string }>();
    
    allEvents?.forEach((event: any) => {
      const rawRef = event.referrer;
      if (!rawRef || String(rawRef).trim() === '') {
        const key = 'Direct';
        if (!referrerCounts.has(key)) {
          referrerCounts.set(key, { count: 0, fullUrl: '' });
        }
        referrerCounts.get(key)!.count += 1;
        return;
      }

      let referrer = rawRef;
      let normalizedReferrer = referrer;

      try {
        const url = new URL(referrer);
        normalizedReferrer = url.hostname.toLowerCase();
        if (normalizedReferrer.startsWith('www.')) {
          normalizedReferrer = normalizedReferrer.substring(4);
        }

        if (
          domainsToFilter.has(normalizedReferrer) ||
          domainsToFilter.has('www.' + normalizedReferrer) ||
          isMakinariInternalReferrerHostname(normalizedReferrer)
        ) {
          return;
        }
      } catch {
        normalizedReferrer = referrer;
      }

      if (!referrerCounts.has(normalizedReferrer)) {
        referrerCounts.set(normalizedReferrer, { count: 0, fullUrl: referrer });
      }
      referrerCounts.get(normalizedReferrer)!.count += 1;
    });

    // Calculate total valid referrer events for percentage calculation
    const totalValidReferrerEvents = Array.from(referrerCounts.values()).reduce((sum, data) => sum + data.count, 0);
    
    // Convert to array and sort by count
    const referrersArray = Array.from(referrerCounts.entries())
      .map(([referrer, data]) => ({
        referrer,
        count: data.count,
        percentage: totalValidReferrerEvents > 0 ? ((data.count / totalValidReferrerEvents) * 100).toFixed(1) : '0.0',
        fullUrl: data.fullUrl
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, referrersLimit);

    // Calculate totals from the same dataset for consistency
    const totalUniqueVisitors = new Set(allEvents?.map(e => e.visitor_id).filter(id => id) || []).size;
    const totalPageVisits = allEvents?.length || 0;
    const totalReferralVisits =
      allEvents?.filter((e) => isExternalReferralPageview(e.referrer, domainsToFilter)).length ?? 0;
    
    console.log('Combined data processed from single source:', {
      totalPageVisits,
      totalUniqueVisitors,
      chartDays: chartData.length,
      uniqueReferrers: referrerCounts.size,
      totalValidReferrerEvents,
      filteredReferrers: (allEvents?.filter(e => e.referrer).length || 0) - totalValidReferrerEvents,
      topReferrers: referrersArray.slice(0, 3)
    });

    return NextResponse.json({
      chartData,
      referrersData: referrersArray,
      totals: {
        pageVisits: totalPageVisits,
        uniqueVisitors: totalUniqueVisitors,
        referralVisits: totalReferralVisits,
      },
    });

  } catch (error) {
    console.error('Error in page visits combined API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 