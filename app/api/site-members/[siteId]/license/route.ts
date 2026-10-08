import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceSupabase, getSiteMemberAccess } from '@/lib/auth/site-member-request'
import { licenseUnavailableResponse, readMemberLicense } from '@/lib/licenses/member-license.server'

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await params
    if (!z.string().uuid().safeParse(siteId).success) {
      return NextResponse.json({ success: false, error: 'Invalid site' }, { status: 400 })
    }
    const access = await getSiteMemberAccess(siteId)
    if (access.error) return access.error
    if (!access.isOwner && !access.isAdmin && !access.isMember) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions to view member licensing' }, { status: 403 })
    }
    const result = await readMemberLicense(createServiceSupabase(), siteId, access.isOwner || access.isAdmin)
    if (result.response) return result.response
    return NextResponse.json({ success: true, license: result.license }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return licenseUnavailableResponse()
  }
}