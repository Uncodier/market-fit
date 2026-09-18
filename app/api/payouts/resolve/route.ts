import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { isPayoutResolverRole } from '@/lib/auth/platform-access'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: platformRole, error: roleError } = await supabase.rpc(
      'current_user_platform_role'
    )
    if (roleError || !isPayoutResolverRole(platformRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { payoutId, status } = await request.json()

    if (!payoutId || !['completed', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const serviceClient = await createServiceClient(true)

    const { error: resolveError } = await serviceClient.rpc(
      'resolve_payout_request',
      {
        p_payout_id: payoutId,
        p_status: status,
        p_resolved_by: user.id,
      }
    )

    if (resolveError) {
      console.error('Error resolving payout:', resolveError)
      return NextResponse.json({ error: 'Failed to resolve payout' }, { status: 409 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error in resolve payout:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
