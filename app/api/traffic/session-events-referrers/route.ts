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

    // First, let's check if there are any page visits at all
    const { data: allEvents, error: allEventsError } = await supabase
      .from('session_events')
      .select('referrer')
      .eq('site_id', siteId)
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

    // Group by referrer and count occurrences
    const referrerCounts = allEvents.reduce((acc: Record<string, number>, event) => {
      const referrer = event.referrer || 'Direct';
      acc[referrer] = (acc[referrer] || 0) + 1;
      return acc;
    }, {});

    // Convert to array format and sort by count
    const referrerData = Object.entries(referrerCounts)
      .map(([referrer, count]) => ({
        referrer,
        count: count as number,
        percentage: Number(((count as number / allEvents.length) * 100).toFixed(1))
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    console.log('Page visits referrers data processed:', {
      totalEvents: allEvents.length,
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