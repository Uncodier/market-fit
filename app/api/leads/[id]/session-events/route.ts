import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId');
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const eventType = searchParams.get('eventType');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const { id: leadId } = await params;

  if (!leadId || !siteId) {
    return NextResponse.json({ 
      error: 'Lead ID and Site ID are required' 
    }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();
    
    console.log('Fetching session events for lead:', leadId, 'site:', siteId);

    // First, get all visitor sessions for this lead
    const { data: visitorSessions, error: sessionsError } = await supabase
      .from('visitor_sessions')
      .select('visitor_id')
      .eq('lead_id', leadId)
      .eq('site_id', siteId);

    if (sessionsError) {
      console.error('Error fetching visitor sessions:', sessionsError);
      return NextResponse.json(
        { error: 'Failed to fetch visitor sessions' },
        { status: 500 }
      );
    }

    if (!visitorSessions || visitorSessions.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0
        },
        summary: {}
      });
    }

    // Extract visitor IDs
    const visitorIds = visitorSessions.map(session => session.visitor_id);

    // Build query for session events
    let query = supabase
      .from('session_events')
      .select('*', { count: 'exact' })
      .eq('site_id', siteId)
      .in('visitor_id', visitorIds)
      .order('created_at', { ascending: false });

    // Apply filters
    if (eventType && eventType !== 'all') {
      query = query.eq('event_type', eventType);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Apply pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data: sessionEvents, error: eventsError, count } = await query;

    if (eventsError) {
      console.error('Error fetching session events:', eventsError);
      return NextResponse.json(
        { error: 'Failed to fetch session events' },
        { status: 500 }
      );
    }

    // Get summary of event types (without pagination)
    let summaryQuery = supabase
      .from('session_events')
      .select('event_type')
      .eq('site_id', siteId)
      .in('visitor_id', visitorIds);

    if (startDate) {
      summaryQuery = summaryQuery.gte('created_at', startDate);
    }

    if (endDate) {
      summaryQuery = summaryQuery.lte('created_at', endDate);
    }

    const { data: allEvents, error: summaryError } = await summaryQuery;

    if (summaryError) {
      console.error('Error fetching events summary:', summaryError);
    }

    // Group events by type for summary
    const summary = (allEvents || []).reduce((acc: Record<string, number>, event) => {
      acc[event.event_type] = (acc[event.event_type] || 0) + 1;
      return acc;
    }, {});

    // Get device, browser and location data for this lead
    let sessionsDataQuery = supabase
      .from('visitor_sessions')
      .select('device, browser, location')
      .eq('lead_id', leadId)
      .eq('site_id', siteId);

    if (startDate) {
      sessionsDataQuery = sessionsDataQuery.gte('created_at', startDate);
    }

    if (endDate) {
      sessionsDataQuery = sessionsDataQuery.lte('created_at', endDate);
    }

    const { data: sessionData, error: sessionError } = await sessionsDataQuery;

    if (sessionError) {
      console.error('Error fetching session data:', sessionError);
    }

    // Analyze devices, languages and regions
    const analyzeSessionData = (sessions: any[]) => {
      if (!sessions || sessions.length === 0) {
        return {
          topDevice: 'Unknown',
          topLanguage: 'Unknown', 
          topRegion: 'Unknown'
        };
      }

      const devices: Record<string, number> = {};
      const languages: Record<string, number> = {};
      const regions: Record<string, number> = {};

      sessions.forEach(session => {
        // Device analysis
        if (session.device?.type) {
          const deviceType = session.device.type;
          devices[deviceType] = (devices[deviceType] || 0) + 1;
        }

        // Language analysis  
        if (session.browser?.language) {
          const language = session.browser.language.split('-')[0]; // Get base language (es from es-ES)
          languages[language] = (languages[language] || 0) + 1;
        }

        // Region analysis
        if (session.location?.country) {
          const region = session.location.country;
          regions[region] = (regions[region] || 0) + 1;
        }
      });

      // Get most common values
      const topDevice = Object.keys(devices).reduce((a, b) => devices[a] > devices[b] ? a : b, 'Unknown');
      const topLanguage = Object.keys(languages).reduce((a, b) => languages[a] > languages[b] ? a : b, 'Unknown');
      const topRegion = Object.keys(regions).reduce((a, b) => regions[a] > regions[b] ? a : b, 'Unknown');

      return { topDevice, topLanguage, topRegion };
    };

    const sessionAnalysis = analyzeSessionData(sessionData || []);

    const totalPages = Math.ceil((count || 0) / pageSize);

    return NextResponse.json({
      data: sessionEvents || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages
      },
      summary,
      totalSessions: sessionData?.length || 0,
      topDevice: sessionAnalysis.topDevice,
      topLanguage: sessionAnalysis.topLanguage,
      topRegion: sessionAnalysis.topRegion
    });

  } catch (error) {
    console.error('Error in lead session events API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 