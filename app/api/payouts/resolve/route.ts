import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // In a real app, verify user is a super admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { payoutId, status } = await request.json()

    if (!payoutId || !['completed', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const serviceClient = await createServiceClient(true)

    // Verify payout exists
    const { data: payout, error: getError } = await serviceClient
      .from('payout_requests')
      .select('*')
      .eq('id', payoutId)
      .single()

    if (getError || !payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
    }

    if (payout.status !== 'pending') {
      return NextResponse.json({ error: 'Payout is not pending' }, { status: 400 })
    }

    // Update status
    const { error: updateError } = await serviceClient
      .from('payout_requests')
      .update({ status })
      .eq('id', payoutId)

    if (updateError) {
      console.error('Error updating payout:', updateError)
      return NextResponse.json({ error: 'Failed to update payout' }, { status: 500 })
    }

    // If rejected, refund the balance
    if (status === 'rejected') {
      const { error: refundError } = await serviceClient.rpc('add_balance', {
        p_site_id: payout.site_id,
        p_amount: payout.requested_credits
      })
      if (refundError) {
        console.error('Error refunding balance for rejected payout:', refundError)
        // Note: Should probably flag this for manual review if refund fails
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error in resolve payout:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
