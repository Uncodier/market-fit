import { NextResponse } from 'next/server'
import {
  createServiceSupabase,
  createUserSupabase,
} from '@/lib/auth/site-member-request'
import { decideInvitationAcceptance } from '@/lib/auth/team-invitation-acceptance'

export async function POST(request: Request) {
  const supabase = await createUserSupabase()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.email) {
    return NextResponse.json(
      { success: false, error: 'Please authenticate before accepting the invitation' },
      { status: 401 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const siteId = typeof body.siteId === 'string' ? body.siteId.trim() : ''
  if (!siteId) {
    return NextResponse.json(
      { success: false, error: 'Invalid invitation link' },
      { status: 400 }
    )
  }

  const email = user.email.trim().toLowerCase()
  const admin = createServiceSupabase()
  const { data: invitation, error: invitationError } = await admin
    .from('site_members')
    .select('id, user_id, status')
    .eq('site_id', siteId)
    .eq('email', email)
    .maybeSingle()

  if (invitationError) {
    return NextResponse.json(
      { success: false, error: 'Failed to verify the invitation' },
      { status: 500 }
    )
  }

  const decision = decideInvitationAcceptance(invitation, user.id)

  if (decision === 'missing' || decision === 'wrong-user') {
    return NextResponse.json(
      { success: false, error: 'This invitation was not issued to your account' },
      { status: 403 }
    )
  }

  if (decision === 'rejected') {
    return NextResponse.json(
      { success: false, error: 'This invitation is no longer active' },
      { status: 410 }
    )
  }

  if (decision === 'already-active') {
    return NextResponse.json({
      success: true,
      redirectTo: `/dashboard/sites/${siteId}`,
      alreadyMember: true,
    })
  }

  let updateQuery = admin
    .from('site_members')
    .update({
      user_id: user.id,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', invitation.id)
    .eq('status', 'pending')

  updateQuery = invitation.user_id
    ? updateQuery.eq('user_id', user.id)
    : updateQuery.is('user_id', null)

  const { data: updated, error: updateError } = await updateQuery
    .select('id')
    .maybeSingle()

  if (updateError || !updated) {
    return NextResponse.json(
      { success: false, error: 'The invitation could not be activated' },
      { status: updateError ? 500 : 409 }
    )
  }

  return NextResponse.json({
    success: true,
    redirectTo: `/dashboard/sites/${siteId}`,
  })
}
