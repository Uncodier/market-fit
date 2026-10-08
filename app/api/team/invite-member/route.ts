import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceSupabase, denyUnlessTeamManager, getSiteMemberAccess } from '@/lib/auth/site-member-request'
import { siteMemberRoleToInvitationRole } from '@/lib/auth/screen-access'
import { readMemberLicense, memberAdmissionResponse, memberLicenseUpgradeResponse } from '@/lib/licenses/member-license.server'

const invitationSchema = z.object({ email: z.string().trim().email().max(254), siteId: z.string().uuid() })

export async function POST(request: Request) {
  try {
    const parsed = invitationSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ success: false, error: 'A valid email and site are required' }, { status: 400 })
    const email = parsed.data.email.toLowerCase()
    const { siteId } = parsed.data
    const access = await getSiteMemberAccess(siteId)
    const denied = denyUnlessTeamManager(access)
    if (denied) return denied
    if (access.error) return access.error

    const admin = createServiceSupabase()
    const { data: membership, error: memberError } = await admin.from('site_members')
      .select('id, user_id, status, license_suspended, role, name, position')
      .eq('site_id', siteId).eq('email', email).maybeSingle()
    if (memberError) return NextResponse.json({ success: false, error: 'Failed to verify reserved membership' }, { status: 503 })
    const reserved = membership && ['pending', 'active'].includes(membership.status) && membership.license_suspended === false
    const licenseResult = await readMemberLicense(admin, siteId, access.isOwner || access.isAdmin, reserved ? membership.id : undefined)
    if (licenseResult.response) return licenseResult.response
    if (membership && membership.status !== 'rejected' && membership.license_suspended !== false) {
      return memberLicenseUpgradeResponse(licenseResult.license)
    }
    const upgrade = memberAdmissionResponse(licenseResult.license)
    if (upgrade) return upgrade
    if (!reserved) {
      return NextResponse.json({ success: false, error: 'Reserve a site membership before sending an invitation' }, { status: 400 })
    }

    const { data: site, error: siteError } = await admin.from('sites').select('name').eq('id', siteId).is('archived_at', null).maybeSingle()
    if (siteError || !site) return NextResponse.json({ success: false, error: 'Site not found or access denied' }, { status: 404 })
    const { data: inviterProfile } = await admin.from('profiles').select('name').eq('id', access.userId).maybeSingle()
    const inviterName = inviterProfile?.name || 'A team administrator'
    // Invitation metadata is display-only, but still derived from the trusted reservation.
    const siteName = site.name || 'Your Site'
    const role = siteMemberRoleToInvitationRole(membership.role)
    const name = membership.name || undefined
    const position = membership.position || undefined
    const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : (process.env.NEXT_PUBLIC_APP_URL || 'https://app.uncodie.com')
    const invitationParams = new URLSearchParams({
      invitationType: 'team_invitation', siteId, siteName, role, email, inviterName,
      ...(name && { name }), ...(position && { position }),
    })
    const redirectTo = `${baseUrl}/api/auth/callback?${invitationParams.toString()}`
    const metadata = {
      invitationType: 'team_invitation', invitation_type: 'team_invitation',
      siteId, site_id: siteId, siteName, site_name: siteName, role, email,
      inviterName, inviter_name: inviterName, ...(name && { name }), ...(position && { position }), redirectUrl: redirectTo,
    }
    let userId = membership.user_id
    if (!userId) {
      const { data: profile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
      userId = profile?.id
    }
    const existingUser = userId ? (await admin.auth.admin.getUserById(userId)).data?.user : null
    const confirmed = !!existingUser?.email_confirmed_at
    const invitationResult = confirmed
      ? await access.supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo, data: { ...metadata, password_set: existingUser?.user_metadata?.password_set ?? false } } })
      : await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { ...metadata, password_set: false } })
    if (invitationResult.error) {
      if (invitationResult.error.code === 'over_email_send_rate_limit') {
        return NextResponse.json({ success: false, error: 'Too many emails sent. Please try again later.', code: 'RATE_LIMIT_EXCEEDED', retryAfter: 60 }, { status: 429 })
      }
      if (invitationResult.error.code === 'signup_disabled' || /sign.?up.*(disabled|not allowed)/i.test(invitationResult.error.message || '')) {
        return NextResponse.json({ success: false, error: 'User registration is currently disabled. Please contact support.', code: 'SIGNUP_DISABLED' }, { status: 403 })
      }
      return NextResponse.json({ success: false, error: 'Failed to send invitation' }, { status: 500 })
    }
    return NextResponse.json({ success: true, message: 'Invitation sent successfully', userExists: !!existingUser })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}