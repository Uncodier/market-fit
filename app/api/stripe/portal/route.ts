import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { requireStripeSiteAccess } from '@/lib/auth/api-stripe-access'
import { resolveCheckoutUrls } from '@/app/api/stripe/checkout/checkout-url-security'

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      const value = await request.json()
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
      body = value
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 })
    }
    const { siteId, returnUrl } = body
    if (typeof siteId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteId) ||
        typeof returnUrl !== 'string' || !returnUrl.trim()) {
      return NextResponse.json({ error: 'Invalid portal request' }, { status: 400 })
    }

    const access = await requireStripeSiteAccess(request, siteId)
    if (access.error) return access.error

    const checkoutUrls = resolveCheckoutUrls(request, returnUrl, undefined, {})
    if (checkoutUrls.error !== undefined) {
      return NextResponse.json({ error: checkoutUrls.error }, { status: 400 })
    }
    const redirect = new URL(checkoutUrls.successUrl)
    if (redirect.username || redirect.password) {
      return NextResponse.json({ error: 'Invalid portal return URL' }, { status: 400 })
    }

    // Explicitly select a general-purpose configuration, never Stripe's default
    // or the dedicated subscription-update configuration.
    const configurationId = process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID?.trim()
    const updateConfigurationId = process.env.STRIPE_SUBSCRIPTION_UPDATE_PORTAL_CONFIGURATION_ID?.trim()
    const unsafeConfiguration = () => NextResponse.json(
      { error: 'Billing portal is not safely configured; contact billing support' }, { status: 409 })
    if (!configurationId || !/^bpc_[A-Za-z0-9]+$/.test(configurationId) || configurationId === updateConfigurationId) {
      return unsafeConfiguration()
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Billing portal is unavailable' }, { status: 503 })
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-05-28.basil', timeout: 20_000, maxNetworkRetries: 0,
    })

    // Get Stripe customer ID from billing record
    const supabase = access.supabase
    
    const { data: billing, error: billingError } = await supabase
      .from('billing')
      .select('stripe_customer_id')
      .eq('site_id', siteId)
      .maybeSingle()

    if (billingError) throw new Error('Billing lookup failed')

    const customerId = billing?.stripe_customer_id

    if (typeof customerId !== 'string' || !customerId) {
      return NextResponse.json(
        { error: 'No billing account found for this site' },
        { status: 404 }
      )
    }

    const customer = await stripe.customers.retrieve(customerId)
    if (customer.deleted || customer.id !== customerId || customer.metadata?.site_id !== siteId) {
      return NextResponse.json({ error: 'Billing customer does not match this site' }, { status: 409 })
    }
    let configuration: Stripe.BillingPortal.Configuration
    try { configuration = await stripe.billingPortal.configurations.retrieve(configurationId) }
    catch { return unsafeConfiguration() }
    const cancel = configuration?.features?.subscription_cancel
    if (configuration?.id !== configurationId || configuration.active !== true ||
        configuration.features?.subscription_update?.enabled !== false ||
        !cancel || (cancel.enabled && (cancel.mode !== 'at_period_end' || cancel.proration_behavior !== 'none'))) {
      return unsafeConfiguration()
    }

    // General billing access may manage invoices/payment methods and schedule
    // cancellation, but cannot bypass checkout's plan/add-on/proration guards.
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration: configurationId,
      return_url: checkoutUrls.successUrl,
    })

    return NextResponse.json({ 
      url: session.url 
    })

  } catch {
    return NextResponse.json(
      { error: 'Failed to create portal session; contact billing support' },
      { status: 503 }
    )
  }
}
