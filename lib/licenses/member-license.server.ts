import 'server-only'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { memberUpgradePayload, requiredMemberPlan, type SiteMemberLicense } from '@/lib/license-entitlements'
import type { BillingLimitPayload } from '@/lib/billing-limit-errors'
import { memberLicenseSchema } from './member-license-schema'

export function licenseUnavailableResponse() {
  return NextResponse.json(
    { success: false, code: 'MEMBER_LICENSE_UNAVAILABLE', error: 'Member licensing is temporarily unavailable. Please try again later.' },
    { status: 503 }
  )
}

/** Only call after authorizing the site or verifying the invitation's email. */
export async function readMemberLicense(
  admin: SupabaseClient,
  siteId: string,
  canUpgrade: boolean,
  reservedMemberId?: string
): Promise<{ license: SiteMemberLicense; response?: never } | { response: NextResponse; license?: never }> {
  try {
    const { data, error } = await admin.rpc('get_site_member_license', {
      p_site_id: siteId,
      ...(reservedMemberId ? { p_member_id: reservedMemberId } : {}),
    })
    if (error) return { response: licenseUnavailableResponse() }
    if (data === null) return { response: NextResponse.json({ success: false, error: 'Site not found or access denied' }, { status: 404 }) }
    const parsed = memberLicenseSchema.safeParse(data)
    if (!parsed.success || parsed.data.siteId !== siteId) return { response: licenseUnavailableResponse() }
    return { license: { ...parsed.data, canUpgrade } }
  } catch {
    return { response: licenseUnavailableResponse() }
  }
}

export function memberLicenseUpgradeResponse(license: SiteMemberLicense): NextResponse {
  const payload: BillingLimitPayload = {
    ...memberUpgradePayload(license.siteId, license.plan, license.current),
    requiredPlan: requiredMemberPlan(Math.max(license.current + 1, license.total ?? 0)),
    canUpgrade: license.canUpgrade,
    ...(!license.canUpgrade ? { message: 'Your site administrator must upgrade the license to activate this membership.' } : {}),
  }
  return NextResponse.json({ success: false, code: 'MEMBER_LIMIT', ...payload, upgradeRequired: payload }, { status: 402 })
}

export function memberAdmissionResponse(license: SiteMemberLicense): NextResponse | null {
  return license.limit !== null && license.current >= license.limit ? memberLicenseUpgradeResponse(license) : null
}

/** Recognize only the database guard's exact code/message and validated scoped details. */
export function memberLimitRaceResponse(error: unknown, siteId: string, canUpgrade: boolean): NextResponse | null {
  if (!error || typeof error !== 'object') return null
  const record = error as Record<string, unknown>
  if (record.code !== 'P0001' || record.message !== 'MEMBER_LIMIT') return null
  try {
    const parsed = memberLicenseSchema.safeParse(typeof record.details === 'string' ? JSON.parse(record.details) : record.details)
    if (!parsed.success || parsed.data.siteId !== siteId) return licenseUnavailableResponse()
    return memberAdmissionResponse({ ...parsed.data, canUpgrade }) || licenseUnavailableResponse()
  } catch {
    return licenseUnavailableResponse()
  }
}