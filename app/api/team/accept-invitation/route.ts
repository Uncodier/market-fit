import { NextResponse } from 'next/server'
import {
  createServiceSupabase,
  createUserSupabase,
} from '@/lib/auth/site-member-request'

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

  if (!invitation || (invitation.user_id && invitation.user_id !== user.id)) {
    return NextResponse.json(
      { success: false, error: 'This invitation was not issued to your account' },
      { status: 403 }
    )
  }

  if (invitation.user_id === user.id && invitation.status === 'active') {
    return NextResponse.json({
      success: true,
      redirectTo: `/dashboard/sites/${siteId}`,
      alreadyMember: true,
    })
  }

  const { error: updateError } = await admin
    .from('site_members')
    .update({
      user_id: user.id,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', invitation.id)
    .is('user_id', null)

  if (updateError) {
    return NextResponse.json(
      { success: false, error: 'Failed to accept the invitation' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    redirectTo: `/dashboard/sites/${siteId}`,
  })
}
