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

    if (
      !siteId ||
      typeof requestedCredits !== 'number' ||
      !Number.isFinite(requestedCredits) ||
      requestedCredits <= 0 ||
      !bankDetails ||
      typeof bankDetails !== 'object' ||
      Array.isArray(bankDetails)
    ) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const { data: siteRole, error: roleError } = await supabase.rpc(
      'current_user_site_role',
      { p_site_id: siteId }
    )

    if (roleError || (siteRole !== 'owner' && siteRole !== 'admin')) {
      return NextResponse.json({ error: 'Must be site admin or owner to request payout' }, { status: 403 })
    }

    const serviceClient = await createServiceClient(true)

    const { data: payoutRequest, error: payoutError } = await serviceClient.rpc(
      'create_payout_request',
      {
        p_site_id: siteId,
        p_requested_credits: requestedCredits,
        p_bank_details: bankDetails,
        p_requested_by: user.id,
      }
    )

    if (payoutError) {
      console.error('Error creating payout request:', payoutError)
      return NextResponse.json({ error: 'Failed to create payout request' }, { status: 409 })
    }

    return NextResponse.json({ success: true, payoutRequest })
  } catch (err: any) {
    console.error('Error in request payout:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
