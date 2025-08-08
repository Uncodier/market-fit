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

    // Check if billing is setup (has active status and credits_available > 0, or active plan)
    const { data: billingData, error } = await supabase
      .from('billing')
      .select('status, credits_available, plan')
      .eq('site_id', siteId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error checking billing:', error)
      return NextResponse.json({ error: 'Failed to check billing' }, { status: 500 })
    }

    // Billing is setup if:
    // 1. Record exists with active status, OR
    // 2. Has available credits > 0, OR  
    // 3. Has a paid plan (not 'free')
    const hasBillingSetup = billingData && (
      billingData.status === 'active' ||
      (billingData.credits_available && billingData.credits_available > 0) ||
      (billingData.plan && billingData.plan !== 'free')
    )

    console.log('Billing check result:', {
      siteId,
      billingData,
      hasBillingSetup
    })

    return NextResponse.json({ hasBillingSetup: !!hasBillingSetup })
  } catch (error) {
    console.error('Error in billing check API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
