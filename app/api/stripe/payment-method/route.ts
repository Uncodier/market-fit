import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { requireStripeSiteAccess } from '@/lib/auth/api-stripe-access'
import { billingCardSummary, resolveBillingPaymentMethod } from '@/lib/billing/payment-method.server'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const siteId = request.nextUrl.searchParams.get('siteId')
    if (!z.string().uuid().safeParse(siteId).success) return NextResponse.json({ error: 'Invalid siteId' }, { status: 400 })
    const access = await requireStripeSiteAccess(request, siteId!)
    if (access.error) return access.error
    if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Payment service is not configured' }, { status: 503 })
    const { data: billing, error } = await access.supabase.from('billing')
      .select('stripe_customer_id,stripe_subscription_id').eq('site_id', siteId!).maybeSingle()
    if (error) throw new Error('Billing lookup unavailable')
    if (!billing?.stripe_customer_id) return NextResponse.json({ paymentMethod: null }, { headers: { 'Cache-Control': 'private, no-store' } })
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-05-28.basil', timeout: 10000, maxNetworkRetries: 0 })
    const method = await resolveBillingPaymentMethod(stripe, billing.stripe_customer_id, siteId!, billing.stripe_subscription_id)
    return NextResponse.json({ paymentMethod: method ? billingCardSummary(method, billing.stripe_customer_id) : null }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to load billing payment method' }, { status: 503 })
  }
}
