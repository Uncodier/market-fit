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

    // Check if site has credits available
    const { data: billingData, error } = await supabase
      .from('billing')
      .select('credits_available')
      .eq('site_id', siteId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error checking credits:', error)
      return NextResponse.json({ error: 'Failed to check credits' }, { status: 500 })
    }

    // Has credits if credits_available > 0
    const hasCredits = billingData && billingData.credits_available && billingData.credits_available > 0

    console.log('Credits check result:', {
      siteId,
      credits_available: billingData?.credits_available || 0,
      hasCredits
    })

    return NextResponse.json({ 
      hasCredits: !!hasCredits,
      credits_available: billingData?.credits_available || 0
    })
  } catch (error) {
    console.error('Error in credits check API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

