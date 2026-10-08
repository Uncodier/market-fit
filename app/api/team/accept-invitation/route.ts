import { NextResponse } from 'next/server'
import {
  createServiceSupabase,
  createUserSupabase,
} from '@/lib/auth/site-member-request'
import { decideInvitationAcceptance } from '@/lib/auth/team-invitation-acceptance'
import { z } from 'zod'
import { isAdminScreenRole } from '@/lib/auth/screen-access'
import {
  licenseUnavailableResponse, readMemberLicense, memberAdmissionResponse,
  memberLicenseUpgradeResponse, memberLimitRaceResponse,
} from '@/lib/licenses/member-license.server'

export async function POST(request: Request) {
  try {
  const supabase = await createUserSupabase()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.email || !user.email_confirmed_at) {
    return NextResponse.json(
      { success: false, error: 'Please authenticate before accepting the invitation' },
      { status: 401 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = z.object({ siteId: z.string().uuid() }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid invitation link' },
      { status: 400 }
    )
  }
  const { siteId } = parsed.data

  const email = user.email.trim().toLowerCase()
  const admin = createServiceSupabase()
  const { data: invitation, error: invitationError } = await admin
    .from('site_members')
    .select('id, user_id, status, role, license_suspended')
    .eq('site_id', siteId)
    .eq('email', email)
    .maybeSingle()

  if (invitationError) {
    return NextResponse.json(
      { success: false, error: 'Failed to verify the invitation' },
      { status: 503 }
    )
  }

  const decision = decideInvitationAcceptance(invitation, user.id)

  if (!invitation || decision === 'missing' || decision === 'wrong-user') {
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

  const { data: site, error: siteError } = await admin
    .from('sites').select('user_id').eq('id', siteId).is('archived_at', null).maybeSingle()
  if (siteError || !site) {
    return NextResponse.json({ success: false, error: 'Site not found or access denied' }, { status: 404 })
  }

  const canUpgrade = site.user_id === user.id ||
    (invitation.user_id === user.id && invitation.status === 'active' && invitation.license_suspended === false && isAdminScreenRole(invitation.role))

  if (invitation.license_suspended !== false) {
    const licenseResult = await readMemberLicense(admin, siteId, canUpgrade)
    if (licenseResult.response) return licenseResult.response
    return memberLicenseUpgradeResponse(licenseResult.license)
  }

  if (decision === 'already-active') {
    return NextResponse.json({
      success: true,
      redirectTo: `/dashboard/sites/${siteId}`,
      alreadyMember: true,
    })
  }

  // Pending, unsuspended invitations already reserve a seat; don't count it twice.
  const licenseResult = await readMemberLicense(admin, siteId, canUpgrade, invitation.id)
  if (licenseResult.response) return licenseResult.response
  const upgradeResponse = memberAdmissionResponse(licenseResult.license)
  if (upgradeResponse) return upgradeResponse

  let updateQuery = admin
    .from('site_members')
    .update({
      user_id: user.id,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', invitation.id)
    .eq('site_id', siteId)
    .eq('email', email)
    .eq('status', 'pending')
    .eq('license_suspended', false)

  updateQuery = invitation.user_id
    ? updateQuery.eq('user_id', user.id)
    : updateQuery.is('user_id', null)

  const { data: updated, error: updateError } = await updateQuery
    .select('id')
    .maybeSingle()

  if (updateError || !updated) {
    const raceResponse = memberLimitRaceResponse(updateError, siteId, canUpgrade)
    if (raceResponse) return raceResponse
    if (!updateError) {
      const { data: latest, error: latestError } = await admin.from('site_members')
        .select('id, user_id, status, role, license_suspended')
        .eq('id', invitation.id).eq('site_id', siteId).eq('email', email).maybeSingle()
      if (latestError) return licenseUnavailableResponse()
      const latestDecision = decideInvitationAcceptance(latest, user.id)
      if (latest && latestDecision !== 'wrong-user' && latestDecision !== 'rejected') {
        const latestCanUpgrade = site.user_id === user.id ||
          (latest.user_id === user.id && latest.status === 'active' && latest.license_suspended === false && isAdminScreenRole(latest.role))
        const latestLicense = await readMemberLicense(admin, siteId, latestCanUpgrade, latest.license_suspended === false ? latest.id : undefined)
        if (latestLicense.response) return latestLicense.response
        if (latest.license_suspended !== false) return memberLicenseUpgradeResponse(latestLicense.license)
        if (latestDecision === 'already-active') {
          return NextResponse.json({ success: true, redirectTo: `/dashboard/sites/${siteId}`, alreadyMember: true })
        }
        const latestUpgrade = memberAdmissionResponse(latestLicense.license)
        if (latestUpgrade) return latestUpgrade
      }
    }
    return NextResponse.json(
      { success: false, error: 'The invitation could not be activated' },
      { status: updateError ? 500 : 409 }
    )
  }

  return NextResponse.json({
    success: true,
    redirectTo: `/dashboard/sites/${siteId}`,
  })
  } catch {
    return licenseUnavailableResponse()
  }
}
