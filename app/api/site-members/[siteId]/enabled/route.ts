import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createServiceSupabase,
  denyUnlessTeamManager,
  getSiteMemberAccess,
} from '@/lib/auth/site-member-request'
import { memberLimitRaceResponse } from '@/lib/licenses/member-license.server'

const enabledSchema = z.object({
  memberId: z.string().uuid(),
  enabled: z.boolean(),
}).strict()

function failure(error = 'Failed to update member access', status = 500) {
  return NextResponse.json({ success: false, error }, { status })
}

function rpcFailure(error: { code?: string; message?: string }) {
  // Match only the RPC's explicit validation errors, never expose database details.
  if (error.code === '22023') {
    switch (error.message) {
      case 'Member enabled inputs are required':
        return failure('Invalid member enabled request', 400)
      case 'Site is unavailable':
        return failure('Site not found or access denied', 404)
      case 'Member does not belong to site':
        return failure('Member not found', 404)
      case 'Only active or pending members can be enabled or disabled':
        return failure('Only active or pending members can be enabled or disabled', 409)
    }
  }
  if (error.code === '42501' && error.message === 'Site owners cannot be disabled') {
    return failure('Cannot change the site owner from team settings', 403)
  }
  if (error.code === 'PGRST202' || error.code === '42883') {
    return failure('Member access management is temporarily unavailable', 503)
  }
  return failure()
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params
    if (!z.string().uuid().safeParse(siteId).success) return failure('Invalid site', 400)

    const access = await getSiteMemberAccess(siteId)
    const denied = denyUnlessTeamManager(access)
    if (denied) return denied
    if (access.error) return access.error

    const parsed = enabledSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return failure('Invalid member enabled request', 400)

    const { memberId, enabled } = parsed.data
    const admin = createServiceSupabase()
    // The RPC checks target ownership and capacity atomically, including retries at the cap.
    const { data: member, error } = await admin.rpc('set_site_member_enabled', {
      p_site_id: siteId,
      p_member_id: memberId,
      p_enabled: enabled,
    })
    if (error) {
      return memberLimitRaceResponse(error, siteId, access.isOwner || access.isAdmin) || rpcFailure(error)
    }
    if (!member || Array.isArray(member) || member.id !== memberId || member.site_id !== siteId) {
      return failure()
    }
    return NextResponse.json({ success: true, member }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return failure()
  }
}