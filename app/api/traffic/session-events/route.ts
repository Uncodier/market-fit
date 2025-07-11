import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();
    console.log('Fetching page visits for site:', siteId, 'from:', startDate, 'to:', endDate);

    // Calculate number of days for data grouping
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const daysBack = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (24 * 60 * 60 * 1000));
    
    console.log('Date range processing:', {
      startDate,
      endDate,
      startDateObj: startDateObj.toISOString(),
      endDateObj: endDateObj.toISOString(),
      daysBack
    });

    // Query session_events table with date filtering
    const { data, error, count } = await supabase
      .from('session_events')
      .select('created_at', { count: 'exact' })
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      console.error('Error fetching page visits:', error);
      return NextResponse.json(
        { error: 'Failed to fetch data' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      console.log('No page visits found for site:', siteId);
      return NextResponse.json({
        data: []
      });
    }

    // Group data by date
    const groupedData = data.reduce((acc: Record<string, number>, event) => {
      const date = new Date(event.created_at).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    // Convert to array format with labels
    const chartData = Object.entries(groupedData)
      .map(([date, events]) => ({
        date,
        events: events as number,
        label: new Date(date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log('Page visits data processed:', {
      totalEvents: data.length,
      uniqueDates: chartData.length,
      dateRange: chartData.length > 0 ? `${chartData[0].date} to ${chartData[chartData.length - 1].date}` : 'none'
    });

    return NextResponse.json({ data: chartData });

  } catch (error) {
    console.error('Error in page visits API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 