import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createHash } from 'node:crypto'
import { requireStripeSiteAccess } from '@/lib/auth/api-stripe-access'
import { resolveCheckoutUrls } from '@/app/api/stripe/checkout/checkout-url-security'
import { SubscriptionRequestError, parseBillingInterval, parseAddonsCount, resolveSubscriptionCheckoutPrices } from '@/lib/subscription-pricing.server'
import { existingSubscriptionFlow } from './subscription-update'
import { prepareSubscriptionCheckout } from './checkout-session'
import { createServiceApiClient } from '@/lib/supabase/server-client'

export async function POST(request: NextRequest) {
  let lease: { siteId: string; token: string; client: ReturnType<typeof createServiceApiClient> } | undefined
  let safeRelease = true
  let writeDeadline = 0
  const beforeProviderWrite = () => {
    // Leave a full SDK timeout inside the lease even after a delayed DB response.
    if (Date.now() >= writeDeadline) throw new SubscriptionRequestError('Subscription checkout expired; retry shortly', 503)
    safeRelease = false
  }
  try {
    let body: Record<string, unknown>
    try {
      const value = await request.json()
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
      body = value
    } catch { throw new SubscriptionRequestError('Invalid JSON request') }
    const { plan, siteId, successUrl, cancelUrl } = body
    if (typeof siteId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteId)) {
      throw new SubscriptionRequestError('Invalid site ID')
    }
    const access = await requireStripeSiteAccess(request, siteId)
    if (access.error) return access.error
    if (plan !== 'engine' && plan !== 'foundry' && plan !== 'enterprise') {
      throw new SubscriptionRequestError('Invalid subscription plan')
    }
    const interval = parseBillingInterval(body.billingInterval)
    const addonsCount = parseAddonsCount(body.addonsCount)
    const urls = resolveCheckoutUrls(request, cancelUrl, successUrl, {})
    if (urls.error !== undefined) throw new SubscriptionRequestError(urls.error)
    if (!process.env.STRIPE_SECRET_KEY) throw new SubscriptionRequestError('Subscription billing is unavailable', 503)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-05-28.basil', timeout: 20_000, maxNetworkRetries: 0,
    })
    const pricing = await resolveSubscriptionCheckoutPrices(stripe, plan, interval, addonsCount)
    // Elevated access is only for the site-wide checkout lease, after manager authorization.
    const service = createServiceApiClient()
    writeDeadline = Date.now() + 4 * 60 * 1000
    const { data: claimed, error: claimError } = await service.rpc('claim_site_subscription_checkout', { p_site_id: siteId })
    if (claimError || claimed?.state !== 'claimed' || typeof claimed.token !== 'string') {
      return NextResponse.json({ error: 'Subscription checkout is busy; retry shortly' },
        { status: 503, headers: { 'Retry-After': '300' } })
    }
    lease = { siteId, token: claimed.token, client: service }
    const supabase = access.supabase
    const { data: billing, error: billingReadError } = await supabase.from('billing')
      .select('stripe_customer_id,stripe_subscription_id').eq('site_id', siteId).maybeSingle()
    if (billingReadError) throw new Error('Billing lookup failed')
    let customerId = billing?.stripe_customer_id
    if (!customerId && billing?.stripe_subscription_id) {
      throw new SubscriptionRequestError('Existing subscription customer is unavailable', 409)
    }
    if (!customerId) {
      beforeProviderWrite()
      const customer = await stripe.customers.create({ email: access.userEmail || undefined,
        metadata: { site_id: siteId } }, { idempotencyKey: `subscription-customer-${siteId}` })
      safeRelease = true
      customerId = customer.id
      const { data, error } = await service.rpc('upsert_billing', {
        p_site_id: siteId, p_stripe_customer_id: customerId,
      })
      if (error || data?.success !== true) throw new Error('Billing customer persistence failed')
    }
    const requestWindow = Math.floor(Date.now() / (10 * 60 * 1000))
    const idempotencyKey = createHash('sha256').update(JSON.stringify({ user: access.userId, siteId,
      plan, interval, addonsCount, requestWindow, price: pricing.base.priceId, addon: pricing.addon?.priceId,
      success: urls.successUrl, cancel: urls.cancelUrl })).digest('hex')
    const existing = await existingSubscriptionFlow({ stripe, customerId, siteId,
      subscriptionId: billing?.stripe_subscription_id, price: pricing.basePrice, interval, addonsCount,
      returnUrl: urls.cancelUrl, successUrl: urls.successUrl, idempotencyKey,
      beforeProviderWrite })
    safeRelease = true
    if (existing) return NextResponse.json(existing)
    const metadata = { site_id: siteId, plan, billing_interval: interval,
      addons_count: String(addonsCount), type: 'subscription', price_id: pricing.base.priceId,
      addon_price_id: addonsCount > 0 ? pricing.addon!.priceId : '' }
    const pending = await prepareSubscriptionCheckout({ stripe, customerId, siteId, metadata,
      successUrl: urls.successUrl, cancelUrl: urls.cancelUrl, beforeProviderWrite,
      afterProviderWrite: () => { safeRelease = true } })
    if (pending.existing) return NextResponse.json(pending.existing)
    const checkoutKey = createHash('sha256').update(`${idempotencyKey}:${pending.generation}`).digest('hex')
    beforeProviderWrite()
    const session = await stripe.checkout.sessions.create({
      customer: customerId, payment_method_types: ['card'], mode: 'subscription', allow_promotion_codes: true,
      line_items: [{ price: pricing.base.priceId, quantity: 1 },
        ...(addonsCount > 0 ? [{ price: pricing.addon!.priceId, quantity: addonsCount }] : [])],
      success_url: urls.successUrl, cancel_url: urls.cancelUrl, metadata, subscription_data: { metadata },
    }, { idempotencyKey: checkoutKey })
    safeRelease = true
    if (session.status !== 'open' || !session.url) {
      throw new SubscriptionRequestError('Subscription checkout is no longer open; refresh billing before retrying', 409)
    }
    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    if (error instanceof SubscriptionRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to prepare subscription payment; contact billing support' },
      { status: 503, ...(!safeRelease ? { headers: { 'Retry-After': '300' } } : {}) })
  } finally {
    if (lease && safeRelease) {
      try {
        await lease.client.rpc('finish_site_subscription_checkout', { p_site_id: lease.siteId, p_token: lease.token })
      } catch { /* A failed release remains fenced until the short lease expires. */ }
    }
  }
}