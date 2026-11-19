import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { SPENDABLE_CREDIT_FIELDS, spendableCredits } from '@/lib/billing/spendable-credits'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get('siteId')

    if (!z.string().uuid().safeParse(siteId).success || searchParams.getAll('siteId').length !== 1) {
      return NextResponse.json({ error: 'A valid Site ID is required' }, { status: 400 })
    }

    const access = await requireSiteAccess(request, siteId!)
    if (access.error) return access.error

    const { data: billingData, error } = await access.supabase
      .from('billing')
      .select(`status,plan,${SPENDABLE_CREDIT_FIELDS}`)
      .eq('site_id', siteId)
      .single()

    const available = error ? null : spendableCredits(billingData)
    if (available === null) {
      return NextResponse.json({ error: 'Billing unavailable' }, { status: 503 })
    }

    // Billing is setup if:
    // 1. Record exists with active status, OR
    // 2. Has available credits > 0, OR  
    // 3. Has a paid plan (not 'free')
    const hasBillingSetup = billingData && (
      billingData.status === 'active' ||
      available > 0 ||
      (billingData.plan && billingData.plan !== 'free')
    )

    return NextResponse.json({ hasBillingSetup: !!hasBillingSetup }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Billing unavailable' }, { status: 503 })
  }
}
