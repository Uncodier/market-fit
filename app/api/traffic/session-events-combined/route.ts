import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isMakinariInternalReferrerHostname } from '@/lib/traffic/makinari-internal-referrer';
import { isExternalReferralPageview } from '@/lib/traffic/external-referral-pageview';
import { requireAnalyticsAccess } from '@/lib/auth/api-analytics-access';
import { readThroughAnalyticsResponseCache } from '@/lib/redis/analytics-response-cache';
import { normalizeBatchDates } from '@/lib/dashboard/batch-dates';

export async function GET(input: NextRequest) {
  const request = normalizeBatchDates(input);
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const segmentId = searchParams.get('segmentId');
  const limitValue = searchParams.get('referrersLimit') ?? '10';
  const referrersLimit = Number(limitValue);

  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }


  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
  }

  const access = await requireAnalyticsAccess(request);
  if (access.error) return access.error;
  if (!/^\d+$/.test(limitValue) || !Number.isSafeInteger(referrersLimit) || referrersLimit < 1 || referrersLimit > 100) {
    return NextResponse.json({ error: 'Referrer limit must be between 1 and 100' }, { status: 400 });
  }
  if (segmentId && segmentId !== 'all' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segmentId)) {
    return NextResponse.json({ error: 'Invalid segment ID' }, { status: 400 });
  }

  return readThroughAnalyticsResponseCache({
    request,
    namespace: 'traffic:session-events-combined:v2',
    siteId: access.siteId,
    lockTtlMs: 30_000,
    load: async () => {
  try {
    const supabase = await createServiceClient(true);

    // Fetch site information to get main domain
    const { data: siteData, error: siteError } = await supabase
      .from('sites')
      .select('url')
      .eq('id', siteId)
      .single();

    if (siteError) {
      return NextResponse.json({ error: 'Unable to load session report site' }, { status: 500 });
    }

    // Fetch allowed domains for this site
    const { data: allowedDomains, error: domainsError } = await supabase
      .from('allowed_domains')
      .select('domain')
      .eq('site_id', siteId);

    if (domainsError) {
      return NextResponse.json({ error: 'Unable to load referrer exclusions' }, { status: 500 });
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
      } catch { /* Invalid stored URLs cannot establish a referrer exclusion. */ }
    }
    
    // Add allowed domains
    if (allowedDomains) {
      allowedDomains.forEach((domain: { domain: string | null }) => {
        if (typeof domain.domain !== 'string') return;
        let normalizedDomain = domain.domain.toLowerCase();
        if (normalizedDomain.startsWith('www.')) {
          normalizedDomain = normalizedDomain.substring(4);
        }
        domainsToFilter.add(normalizedDomain);
        domainsToFilter.add('www.' + normalizedDomain); // Also filter www variant
      });
    }

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
        .select('id, created_at, referrer, visitor_id')
        .eq('site_id', access.siteId)
        .eq('event_type', 'pageview')  // Only count actual page views
        .gte('created_at', access.startDate.toISOString())
        .lte('created_at', access.endDate.toISOString())
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
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
        if (allEvents.length + data.length > 50_000) {
          return NextResponse.json({ error: 'Too many session events. Select a shorter date range.' }, { status: 422 });
        }
        allEvents.push(...data);
        // PostgREST can cap a page below our requested size. Probe until empty.
        from += data.length;
      } else {
        hasMore = false;
      }
    }

    if (eventsError) {
      return NextResponse.json(
        { error: 'Failed to fetch events data' },
        { status: 500 }
      );
    }

    const startDateObj = new Date(access.startDate.toISOString().slice(0, 10));
    const endDateObj = new Date(access.endDate.toISOString().slice(0, 10));
    const daysBack = Math.round((endDateObj.getTime() - startDateObj.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
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
          timeZone: 'UTC',
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
    },
  });
} 