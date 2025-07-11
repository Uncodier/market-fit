import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const referrersLimit = parseInt(searchParams.get('referrersLimit') || '10');

  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();
    console.log('Fetching page visits combined data for site:', siteId, 'from:', startDate, 'to:', endDate);

    // Query 1: Get all page visits data from session_events
    const { data: allEvents, error: eventsError } = await supabase
      .from('session_events')
      .select('created_at, referrer')
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    // Query 2: Get unique visitors data from visitor_sessions
    const { data: visitorSessions, error: visitorsError } = await supabase
      .from('visitor_sessions')
      .select('visitor_id, created_at')
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    console.log('Combined page visits query result:', {
      eventsCount: allEvents?.length || 0,
      visitorsCount: visitorSessions?.length || 0,
      eventsError: eventsError?.message || 'none',
      visitorsError: visitorsError?.message || 'none'
    });

    if (eventsError) {
      console.error('Error fetching page visits:', eventsError);
      return NextResponse.json(
        { error: 'Failed to fetch events data' },
        { status: 500 }
      );
    }

    if (visitorsError) {
      console.error('Error fetching unique visitors:', visitorsError);
      return NextResponse.json(
        { error: 'Failed to fetch visitors data' },
        { status: 500 }
      );
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const daysBack = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (24 * 60 * 60 * 1000));
    
    // Initialize date buckets
    const eventsByDay = new Map<string, number>();
    const visitorsByDay = new Map<string, Set<string>>();
    
    for (let i = 0; i < daysBack; i++) {
      const date = new Date(startDateObj.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      eventsByDay.set(dateStr, 0);
      visitorsByDay.set(dateStr, new Set());
    }

    // Process page visits (events)
    allEvents?.forEach((event: any) => {
      const eventDate = new Date(event.created_at);
      const dateStr = eventDate.toISOString().split('T')[0];
      
      if (eventsByDay.has(dateStr)) {
        eventsByDay.set(dateStr, eventsByDay.get(dateStr)! + 1);
      }
    });

    // Process unique visitors
    visitorSessions?.forEach((session: any) => {
      const sessionDate = new Date(session.created_at);
      const dateStr = sessionDate.toISOString().split('T')[0];
      
      if (visitorsByDay.has(dateStr)) {
        visitorsByDay.get(dateStr)!.add(session.visitor_id);
      }
    });

    // Convert to array format for chart with both metrics
    const chartData = Array.from(eventsByDay.entries()).map(([date, pageVisits]) => {
      const uniqueVisitors = visitorsByDay.get(date)?.size || 0;
      
      // Data correction: if we have unique visitors but no page visits,
      // page visits should be at least equal to unique visitors
      const correctedPageVisits = Math.max(pageVisits, uniqueVisitors);
      
      return {
        date,
        pageVisits: correctedPageVisits,
        uniqueVisitors,
        label: new Date(date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })
      };
    });

    // Process referrers data (same as before)
    const referrerCounts = new Map<string, number>();
    
    allEvents?.forEach((event: any) => {
      if (event.referrer) {
        const referrer = event.referrer;
        referrerCounts.set(referrer, (referrerCounts.get(referrer) || 0) + 1);
      }
    });

    // Convert to array and sort by count
    const referrersArray = Array.from(referrerCounts.entries())
      .map(([referrer, count]) => {
        // Extract domain from referrer URL
        let domain = referrer;
        try {
          const url = new URL(referrer);
          domain = url.hostname;
        } catch {
          // If not a valid URL, keep as is
        }

        return {
          referrer: domain,
          count,
          percentage: (allEvents?.length || 0) > 0 ? ((count / (allEvents?.length || 0)) * 100).toFixed(1) : '0.0',
          fullUrl: referrer
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, referrersLimit);

    // Calculate totals with data correction
    const totalUniqueVisitors = new Set(visitorSessions?.map(s => s.visitor_id) || []).size;
    const rawTotalPageVisits = allEvents?.length || 0;
    
    // Apply the same correction to totals: page visits should be at least equal to unique visitors
    const totalPageVisits = Math.max(rawTotalPageVisits, totalUniqueVisitors);
    
    // Log data correction if applied
    if (totalPageVisits > rawTotalPageVisits) {
      console.log(`[Data Correction] Adjusted page visits from ${rawTotalPageVisits} to ${totalPageVisits} to match unique visitors count`);
    }

    console.log('Combined data processed:', {
      totalPageVisits,
      totalUniqueVisitors,
      chartDays: chartData.length,
      uniqueReferrers: referrerCounts.size,
      topReferrers: referrersArray.slice(0, 3),
      dataCorrectionApplied: totalPageVisits > rawTotalPageVisits
    });

    return NextResponse.json({
      chartData,
      referrersData: referrersArray,
      totals: {
        pageVisits: totalPageVisits,
        uniqueVisitors: totalUniqueVisitors
      }
    });

  } catch (error) {
    console.error('Error in page visits combined API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 