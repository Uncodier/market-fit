import type Stripe from 'stripe'
import { SubscriptionRequestError, type BillingInterval } from '@/lib/subscription-pricing.server'
import { stripeObjectId, resolveStripeSubscriptionDetails } from '@/app/api/stripe/webhook/subscription-billing'

/** No subscription mutation: Stripe hosts customer confirmation and payment. */
export async function existingSubscriptionFlow(params: {
  stripe: Stripe; customerId: string; subscriptionId?: string | null; siteId: string
  price: Stripe.Price; interval: BillingInterval; addonsCount: number
  returnUrl: string; successUrl: string; idempotencyKey: string
  beforeProviderWrite: () => void
}) {
  const { stripe, customerId } = params
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted || customer.metadata.site_id !== params.siteId) {
    throw new SubscriptionRequestError('Billing customer does not match this site', 409)
  }
  const listed = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  if (listed.has_more) throw new SubscriptionRequestError('Subscription review is required', 409)
  const current = listed.data.filter((sub) => !['canceled', 'incomplete_expired'].includes(sub.status))
  if (params.subscriptionId && !listed.data.some((sub) => sub.id === params.subscriptionId)) {
    throw new SubscriptionRequestError('Existing subscription cannot be verified', 409)
  }
  if (!current.length) return null
  const sub = current[0]
  if (current.length !== 1 || sub.status !== 'active' || stripeObjectId(sub.customer) !== customerId ||
      sub.items.has_more || sub.items.data.length !== 1 || params.addonsCount !== 0 ||
      sub.pending_update || sub.schedule || sub.cancel_at_period_end || sub.cancel_at) {
    throw new SubscriptionRequestError('This subscription requires a billing support update; no new subscription was created', 409)
  }
  // This portal flow cannot pass an existing discount ID. Reapplying its coupon/code can
  // reset duration or remove other discounts; require an explicit support review instead.
  if (sub.discounts?.length || sub.items.data.some(item => item.discounts?.length) || customer.discount) {
    throw new SubscriptionRequestError('Existing subscription discounts require billing support to preserve their terms; no change was made', 409)
  }
  const details = resolveStripeSubscriptionDetails(sub)
  if (details.addonsCount !== 0) throw new SubscriptionRequestError('Subscription add-ons require billing support', 409)
  if (details.billingInterval === params.interval) {
    throw new SubscriptionRequestError('Same-interval plan changes require billing support to verify paid coverage', 409)
  }
  if (sub.items.data[0].price.id === params.price.id) {
    throw new SubscriptionRequestError('This subscription already uses the selected plan and interval', 409)
  }
  const configurations = await stripe.billingPortal.configurations.list({ active: true, is_default: true, limit: 2 })
  const config = configurations.data[0]
  const update = config?.features.subscription_update
  const targetProduct = stripeObjectId(params.price.product)
  if (configurations.has_more || configurations.data.length !== 1 || !update?.enabled ||
      !update.default_allowed_updates.includes('price') || update.proration_behavior !== 'always_invoice' ||
      update.schedule_at_period_end?.conditions.length ||
      !update.products?.some((product) => product.product === targetProduct && product.prices.includes(params.price.id))) {
    throw new SubscriptionRequestError('Hosted subscription confirmation is not safely configured; contact billing support', 409)
  }
  params.beforeProviderWrite()
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId, configuration: config.id, return_url: params.returnUrl,
    flow_data: { type: 'subscription_update_confirm',
      subscription_update_confirm: { subscription: sub.id,
        items: [{ id: sub.items.data[0].id, price: params.price.id, quantity: 1 }] },
      after_completion: { type: 'redirect', redirect: { return_url: params.successUrl } } },
  }, { idempotencyKey: `subscription-update-${params.interval}-${params.idempotencyKey}` })
  return { url: session.url, sessionId: session.id, flow: 'subscription_update_confirm' }
}