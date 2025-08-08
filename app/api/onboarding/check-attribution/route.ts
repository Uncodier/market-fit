import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get('siteId')

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    // Check for UTM parameters in visitor_sessions
    // Note: Removing segment_id and campaign_id as they don't exist in this table yet
    const { data: attributedSessions, error: sessionError } = await supabase
      .from('visitor_sessions')
      .select('id, utm_campaign, utm_source')
      .eq('site_id', siteId)
      .or('utm_campaign.not.is.null,utm_source.not.is.null')
      .limit(1)

    if (sessionError) {
      console.error('Error checking attributed sessions:', sessionError)
    }

    // Check for segment attribution in session_events (fallback that actually exists)
    const { data: segmentVisitors, error: segmentError } = await supabase
      .from('session_events')
      .select('id, segment_id')
      .eq('site_id', siteId)
      .not('segment_id', 'is', null)
      .limit(1)

    if (segmentError) {
      console.error('Error checking segment visitors:', segmentError)
    }

    // Check for campaign attribution in leads (where campaign_id actually exists)
    const { data: campaignLeads, error: campaignError } = await supabase
      .from('leads')
      .select('id, campaign_id')
      .eq('site_id', siteId)
      .not('campaign_id', 'is', null)
      .limit(1)

    if (campaignError) {
      console.error('Error checking campaign leads:', campaignError)
    }

    const hasAttribution = (attributedSessions && attributedSessions.length > 0) || 
                          (segmentVisitors && segmentVisitors.length > 0) ||
                          (campaignLeads && campaignLeads.length > 0)

    console.log('Attribution check result:', {
      siteId,
      attributedSessionsCount: attributedSessions?.length || 0,
      segmentVisitorsCount: segmentVisitors?.length || 0,
      campaignLeadsCount: campaignLeads?.length || 0,
      hasAttribution
    })

    return NextResponse.json({ hasAttribution })
  } catch (error) {
    console.error('Error in attribution check API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
