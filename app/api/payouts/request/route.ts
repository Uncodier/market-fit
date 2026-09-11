import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient() // user authenticated client
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { siteId, requestedCredits, bankDetails } = await request.json()

    if (!siteId || !requestedCredits || requestedCredits <= 0 || !bankDetails) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    // Verify user has access to this site
    const { data: siteMember, error: memberError } = await supabase
      .from('site_members')
      .select('role')
      .eq('site_id', siteId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !siteMember) {
      return NextResponse.json({ error: 'Unauthorized for this site' }, { status: 403 })
    }

    // Must be admin or owner to request payout (assuming 'admin' or 'owner')
    if (siteMember.role !== 'owner' && siteMember.role !== 'admin') {
      return NextResponse.json({ error: 'Must be site admin or owner to request payout' }, { status: 403 })
    }

    const serviceClient = await createServiceClient(true)

    // Check site balance
    const { data: billing, error: billingError } = await serviceClient
      .from('billing')
      .select('account_balance')
      .eq('site_id', siteId)
      .single()

    if (billingError || !billing) {
      return NextResponse.json({ error: 'Billing record not found' }, { status: 404 })
    }

    if ((billing.account_balance || 0) < requestedCredits) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }

    // Deduct balance via RPC
    const { error: deductError } = await serviceClient.rpc('deduct_balance', {
      p_site_id: siteId,
      p_amount: requestedCredits
    })

    if (deductError) {
      console.error('Error deducting credits:', deductError)
      return NextResponse.json({ error: 'Failed to process payout: ' + deductError.message }, { status: 500 })
    }

    // Create payout request
    const { data: payoutRequest, error: payoutError } = await serviceClient
      .from('payout_requests')
      .insert({
        site_id: siteId,
        requested_credits: requestedCredits,
        status: 'pending',
        bank_details: bankDetails
      })
      .select()
      .single()

    if (payoutError) {
      // Revert credits if request creation fails
      await serviceClient.rpc('add_credits', { p_site_id: siteId, p_credits: requestedCredits })
      console.error('Error creating payout request:', payoutError)
      return NextResponse.json({ error: 'Failed to create payout request' }, { status: 500 })
    }

    return NextResponse.json({ success: true, payoutRequest })
  } catch (err: any) {
    console.error('Error in request payout:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
