import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { requireStripeSiteAccess } from '@/lib/auth/api-stripe-access'
import { createServiceApiClient } from '@/lib/supabase/server-client'
import { configuredSubscriptionPrice, validateSubscriptionPrice, SubscriptionRequestError } from '@/lib/subscription-pricing.server'
import { stripeObjectId, resolveStripeSubscriptionDetails } from '@/app/api/stripe/webhook/subscription-billing'
import { isSameOriginApiRequest } from '@/lib/http/api-proxy-security'
import { readLimitedRequestBody, decodeRequestBody } from '@/lib/http/read-limited-request-body'
import { applySubscriptionPromotion } from './discounts'

export async function POST(request: NextRequest) {
  let lease: { siteId: string; token: string; client: ReturnType<typeof createServiceApiClient> } | undefined
  let safeRelease = true
  if (!isSameOriginApiRequest(request)) return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 })
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    return NextResponse.json({ error: 'JSON required' }, { status: 415 })
  }
  try {
    let body: Record<string, unknown>
    try {
      const value = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 4096)))
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
      body = value
    } catch { throw new SubscriptionRequestError('Invalid JSON request') }
    const { siteId } = body
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (typeof siteId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteId) ||
        !/^[a-z0-9]{1,100}$/i.test(code) || Object.keys(body).some(key => key !== 'siteId' && key !== 'code')) {
      throw new SubscriptionRequestError('Invalid site or promotion code')
    }
    const access = await requireStripeSiteAccess(request, siteId)
    if (access.error) return access.error
    if (!process.env.STRIPE_SECRET_KEY) throw new SubscriptionRequestError('Subscription billing is unavailable', 503)
    const { data: billing, error } = await access.supabase.from('billing')
      .select('stripe_customer_id,stripe_subscription_id').eq('site_id', siteId).maybeSingle()
    if (error || !billing?.stripe_customer_id || !billing.stripe_subscription_id) {
      throw new SubscriptionRequestError('An existing subscription is required', 409)
    }
    // Service access only fences concurrent billing changes after manager authorization.
    const service = createServiceApiClient()
    const deadline = Date.now() + 4 * 60 * 1000
    const claimed = await service.rpc('claim_site_subscription_checkout', { p_site_id: siteId })
    if (claimed.error || claimed.data?.state !== 'claimed' || typeof claimed.data.token !== 'string') {
      return NextResponse.json({ error: 'Subscription billing is busy; retry shortly' },
        { status: 503, headers: { 'Retry-After': '300' } })
    }
    lease = { siteId, token: claimed.data.token, client: service }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-05-28.basil', timeout: 20_000, maxNetworkRetries: 0,
    })
    const customer = await stripe.customers.retrieve(billing.stripe_customer_id)
    const sub = await stripe.subscriptions.retrieve(billing.stripe_subscription_id, { expand: ['discounts'] })
    const listed = await stripe.subscriptions.list({ customer: billing.stripe_customer_id, status: 'all', limit: 100 })
    const active = listed.data.filter(value => !['canceled', 'incomplete_expired'].includes(value.status))
    if (customer.deleted || customer.id !== billing.stripe_customer_id || customer.metadata?.site_id !== siteId ||
        sub.id !== billing.stripe_subscription_id || stripeObjectId(sub.customer) !== customer.id ||
        listed.has_more || active.length !== 1 || active[0].id !== sub.id || sub.status !== 'active' ||
        sub.pending_update || sub.schedule || sub.cancel_at || sub.cancel_at_period_end || sub.items.has_more ||
        sub.items.data.length < 1 || sub.items.data.length > 2 ||
        sub.items.data.some(item => !configuredSubscriptionPrice(item.price.id))) {
      throw new SubscriptionRequestError('Subscription is not eligible for a discount update; contact billing support', 409)
    }
    const configs = sub.items.data.map(item => configuredSubscriptionPrice(item.price.id)!)
    if (configs.filter(config => config.plan !== 'addon').length > 1 ||
        (configs.every(config => config.plan === 'addon') && configs.length !== 1) ||
        sub.items.data.some((item, index) => !Number.isSafeInteger(item.quantity) || item.quantity! < 1 || item.quantity! > 100 ||
          (configs[index].plan !== 'addon' && item.quantity !== 1))) {
      throw new SubscriptionRequestError('Subscription items require billing support', 409)
    }
    sub.items.data.forEach((item, index) => validateSubscriptionPrice(item.price, configs[index]))
    resolveStripeSubscriptionDetails(sub)
    if (configs.some(config => config.interval !== configs[0].interval) ||
        (sub.metadata?.site_id && sub.metadata.site_id !== siteId)) {
      throw new SubscriptionRequestError('Subscription items require billing support', 409)
    }
    const latestInvoiceId = stripeObjectId(sub.latest_invoice)
    if (latestInvoiceId) {
      const invoice = await stripe.invoices.retrieve(latestInvoiceId)
      const invoiceSubscription = stripeObjectId(invoice.parent?.subscription_details?.subscription)
      const legacySubscription = stripeObjectId((invoice as Stripe.Invoice & { subscription?: string }).subscription)
      if (invoice.id !== latestInvoiceId || stripeObjectId(invoice.customer) !== customer.id ||
          invoice.status !== 'paid' || (invoiceSubscription && legacySubscription && invoiceSubscription !== legacySubscription) ||
          (invoiceSubscription || legacySubscription) !== sub.id) {
        throw new SubscriptionRequestError('Complete the outstanding invoice before applying a promotion code', 409)
      }
    }
    const result = await applySubscriptionPromotion({ stripe, sub, customer, code,
      beforeProviderWrite: () => {
        if (Date.now() >= deadline) throw new SubscriptionRequestError('Discount update expired; retry shortly', 503)
        safeRelease = false
      } })
    safeRelease = true
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SubscriptionRequestError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Unable to verify the discount update; refresh billing before retrying' },
      { status: 503, headers: { 'Retry-After': '300' } })
  } finally {
    if (lease && safeRelease) {
      try { await lease.client.rpc('finish_site_subscription_checkout', { p_site_id: lease.siteId, p_token: lease.token }) }
      catch { /* Failed release remains fenced until lease expiry. */ }
    }
  }
}