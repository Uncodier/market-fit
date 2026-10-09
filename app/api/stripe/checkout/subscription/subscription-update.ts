import type Stripe from 'stripe'
import { SubscriptionRequestError, configuredSubscriptionPrice, validateSubscriptionPrice, type BillingInterval, type SubscriptionPlan } from '@/lib/subscription-pricing.server'
import { stripeObjectId, resolveStripeSubscriptionDetails } from '@/app/api/stripe/webhook/subscription-billing'
import { pendingUpgrade, recoveredPaidUpgrade, scheduleDowngrade } from './tier-change-recovery'
import { changeAddonQuantity } from './addon-change'
import { retainedDiscounts } from './discount-preservation'

const PLAN_RANK = { engine: 1, foundry: 2, enterprise: 3 } as const

/** Changes are fenced by the site's checkout lease and a verified Stripe subscription. */
export async function existingSubscriptionFlow(params: {
  stripe: Stripe; customerId: string; subscriptionId?: string | null; siteId: string
  price?: Stripe.Price; plan?: SubscriptionPlan; addonPrice?: Stripe.Price; interval: BillingInterval; addonsCount: number; requiredAddons?: number
  returnUrl: string; successUrl: string; idempotencyKey: string
  beforeProviderWrite: () => void
}) {
  const { stripe, customerId } = params
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted || customer.id !== customerId || customer.metadata?.site_id !== params.siteId) {
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
  if (current.length !== 1 || sub.status !== 'active' || !params.subscriptionId || sub.id !== params.subscriptionId ||
      stripeObjectId(sub.customer) !== customerId ||
      sub.items.has_more || sub.items.data.length < 1 || sub.items.data.length > 2 ||
      ((sub.cancel_at_period_end || sub.cancel_at) && !(params.plan === 'commission' && params.addonsCount === 0))) {
    throw new SubscriptionRequestError('This subscription requires a billing support update; no new subscription was created', 409)
  }
  // Direct item updates omit discounts, preserving their redeemed IDs and duration.
  // Schedule writers below reuse redeemed Discount IDs rather than coupons.
  const hasDiscounts = Boolean(sub.discounts?.length || sub.items.data.some(item => item.discounts?.length) || customer.discount)
  retainedDiscounts(sub.discounts)
  sub.items.data.forEach(item => retainedDiscounts(item.discounts))
  if (customer.discount) retainedDiscounts([customer.discount])
  if (sub.items.data.some(item => !Number.isSafeInteger(item.quantity) || item.quantity! < 1 ||
      (configuredSubscriptionPrice(item.price.id)?.plan !== 'addon' && item.quantity !== 1)) ||
      sub.items.data.filter(item => configuredSubscriptionPrice(item.price.id)?.plan !== 'addon').length > 1) {
    throw new SubscriptionRequestError('Subscription items require billing support', 409)
  }
  const details = resolveStripeSubscriptionDetails(sub)
  const baseItem = sub.items.data.find(item => configuredSubscriptionPrice(item.price.id)?.plan !== 'addon')
  const addonItem = sub.items.data.find(item => configuredSubscriptionPrice(item.price.id)?.plan === 'addon')
  if (details.plan === 'commission' || params.plan === 'commission') {
    if (details.plan !== 'commission' || params.plan !== 'commission' || baseItem || !addonItem ||
        sub.items.data.length !== 1 || addonItem.quantity !== details.addonsCount ||
        details.billingInterval !== params.interval || params.price) {
      throw new SubscriptionRequestError('Free add-on subscription plan or interval changes require billing support', 409)
    }
    const addonPrice = await stripe.prices.retrieve(addonItem.price.id)
    const config = configuredSubscriptionPrice(addonPrice.id)
    if (!config || config.plan !== 'addon' || config.interval !== params.interval ||
        addonPrice.id !== params.addonPrice?.id) {
      throw new SubscriptionRequestError('Add-on price requires billing support', 409)
    }
    validateSubscriptionPrice(addonPrice, config, true)
    return changeAddonQuantity({ ...params, addonPrice, sub, addonItem, customerId })
  }
  if (!params.price) throw new SubscriptionRequestError('Subscription price requires billing support', 409)
  const targetPrice = params.price
  const target = targetPrice.id
  const targetPlan = configuredSubscriptionPrice(target)?.plan
  if (!details.plan || !(details.plan in PLAN_RANK) || !targetPlan || targetPlan === 'addon' ||
      params.price.recurring?.interval !== params.interval) {
    throw new SubscriptionRequestError('Subscription plan requires billing support', 409)
  }
  if (!baseItem || baseItem.quantity !== 1 || (addonItem && addonItem.quantity !== details.addonsCount) ||
      (details.addonsCount > 0 && !addonItem)) {
    throw new SubscriptionRequestError('Subscription items require billing support', 409)
  }
  if (baseItem.price.id === target && (params.addonsCount !== details.addonsCount ||
      (sub.pending_update && (details.addonsCount > 0 || params.addonsCount > 0)) ||
      details.addonsCount > 0)) {
    if (details.billingInterval !== params.interval) throw new SubscriptionRequestError('Add-on interval requires billing support', 409)
    const addonPrice = addonItem ? await stripe.prices.retrieve(addonItem.price.id) : params.addonPrice
    const addonConfig = addonPrice && configuredSubscriptionPrice(addonPrice.id)
    if (!addonConfig || addonConfig.plan !== 'addon' || addonConfig.interval !== params.interval ||
        (addonItem && addonItem.price.id !== addonPrice?.id) ||
        (params.addonPrice && params.addonPrice.id !== addonPrice?.id)) {
      throw new SubscriptionRequestError('Add-on price requires billing support', 409)
    }
    validateSubscriptionPrice(addonPrice!, addonConfig, true)
    return changeAddonQuantity({ ...params, addonPrice, sub, baseItem, addonItem, customerId })
  }
  if (details.addonsCount !== 0 || params.addonsCount !== 0 || sub.items.data.length !== 1) {
    throw new SubscriptionRequestError('Subscription add-ons require billing support', 409)
  }
  if (baseItem.price.id === target) {
    if (sub.schedule) throw new SubscriptionRequestError('Scheduled subscription requires billing support', 409)
    return recoveredPaidUpgrade(stripe, sub, customerId, target)
  }
  if (sub.pending_update) {
    const invoiceId = stripeObjectId(sub.latest_invoice)
    if (!invoiceId) throw new SubscriptionRequestError('Pending payment requires billing support', 409)
    return pendingUpgrade(await stripe.invoices.retrieve(invoiceId), sub, customerId, target)
  }
  // A scheduled transition must be no more expensive than the current service
  // in its own currency/interval; the ordinal alone cannot compare annual to
  // monthly charges. Restrict scheduling to the current billing interval.
  if (PLAN_RANK[targetPlan] < PLAN_RANK[details.plan as keyof typeof PLAN_RANK] &&
      details.billingInterval !== params.interval) {
    throw new SubscriptionRequestError('Choose the current billing interval to schedule a downgrade', 409)
  }
  if (PLAN_RANK[targetPlan] < PLAN_RANK[details.plan as keyof typeof PLAN_RANK]) {
    const item = sub.items.data[0]
    const periodEnd = item.current_period_end
    if (sub.collection_method !== 'charge_automatically' || !Number.isSafeInteger(periodEnd) ||
        periodEnd <= Math.floor(Date.now() / 1000) || !Number.isSafeInteger(item.current_period_start) ||
        item.current_period_start >= periodEnd) {
      throw new SubscriptionRequestError('Subscription period requires billing support', 409)
    }
    if (sub.automatic_tax?.enabled || sub.default_tax_rates?.length || item.tax_rates?.length ||
        sub.billing_thresholds || item.billing_thresholds || sub.pending_invoice_item_interval ||
        sub.trial_end || sub.application_fee_percent || sub.transfer_data ||
        sub.default_payment_method || sub.default_source || sub.on_behalf_of ||
        sub.payment_settings?.payment_method_types?.some(method => method !== 'card') ||
        sub.invoice_settings?.account_tax_ids?.length) {
      throw new SubscriptionRequestError('Subscription billing settings require support to preserve; no change was made', 409)
    }
    return scheduleDowngrade({ stripe, sub, customer: customerId, target, periodEnd,
      beforeProviderWrite: params.beforeProviderWrite, idempotencyKey: params.idempotencyKey })
  }
  if (sub.schedule) throw new SubscriptionRequestError('Scheduled subscription requires billing support', 409)
  if ((PLAN_RANK[targetPlan] > PLAN_RANK[details.plan as keyof typeof PLAN_RANK] &&
      details.billingInterval === params.interval) ||
      (hasDiscounts && details.billingInterval !== params.interval)) {
    if (sub.collection_method !== 'charge_automatically' ||
        !Number.isSafeInteger(sub.items.data[0].current_period_end) ||
        sub.items.data[0].current_period_end <= Math.floor(Date.now() / 1000)) {
      throw new SubscriptionRequestError('Subscription payment requires billing support', 409)
    }
    // Stripe calculates unused-time credit even if a prior invoice was unpaid.
    // Never credit service for which we cannot prove payment.
    const previousInvoiceId = stripeObjectId(sub.latest_invoice)
    if (!previousInvoiceId) throw new SubscriptionRequestError('Previous subscription payment requires billing support', 409)
    const previousInvoice = await stripe.invoices.retrieve(previousInvoiceId)
    const previousInvoiceSubscription = stripeObjectId(previousInvoice.parent?.subscription_details?.subscription)
    const legacyPreviousInvoiceSubscription = stripeObjectId(
      (previousInvoice as Stripe.Invoice & { subscription?: string }).subscription)
    if (previousInvoice.id !== previousInvoiceId || previousInvoice.status !== 'paid' ||
        stripeObjectId(previousInvoice.customer) !== customerId ||
        (previousInvoiceSubscription && legacyPreviousInvoiceSubscription &&
          previousInvoiceSubscription !== legacyPreviousInvoiceSubscription) ||
        (previousInvoiceSubscription || legacyPreviousInvoiceSubscription) !== sub.id) {
      throw new SubscriptionRequestError('Previous subscription payment requires billing support', 409)
    }
    // Discounted interval changes use this API, not the portal which cannot
    // retain a Discount ID. Omit discounts to preserve redemption duration.
    // Resetting the anchor makes a FULL new service period on the paid invoice.
    // The invoice settlement verifier rejects partial-period debits; Stripe
    // applies the unused old service as a negative proration on this invoice.
    params.beforeProviderWrite()
    const updated = await stripe.subscriptions.update(sub.id, {
      items: [{ id: sub.items.data[0].id, price: target, quantity: 1 }],
      billing_cycle_anchor: 'now', proration_behavior: 'always_invoice',
      payment_behavior: 'pending_if_incomplete', expand: ['latest_invoice'],
    }, { idempotencyKey: `upgrade-${params.idempotencyKey}` })
    const invoice = updated.latest_invoice
    if (updated.id !== sub.id || stripeObjectId(updated.customer) !== customerId) {
      throw new SubscriptionRequestError('Upgrade payment requires billing support to verify', 409)
    }
    if (updated.pending_update) {
      const invoiceId = stripeObjectId(invoice)
      if (!invoiceId) throw new SubscriptionRequestError('Pending payment requires billing support', 409)
      return pendingUpgrade(await stripe.invoices.retrieve(invoiceId), updated, customerId, target)
    }
    if (typeof invoice === 'string' || !invoice || invoice.status !== 'paid') {
      throw new SubscriptionRequestError('Upgrade payment requires billing support to verify', 409)
    }
    return { flow: 'prorated_upgrade', status: 'paid' }
  }
  if (details.billingInterval === params.interval) {
    throw new SubscriptionRequestError('Same-interval plan change requires billing support', 409)
  }
  // Never discover or reuse the shared/default portal: its general entry point
  // must not expose subscription updates that bypass these eligibility checks.
  const configurationId = process.env.STRIPE_SUBSCRIPTION_UPDATE_PORTAL_CONFIGURATION_ID?.trim()
  const genericConfigurationId = process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID?.trim()
  const configurationError = () => new SubscriptionRequestError(
    'Hosted subscription confirmation is not safely configured; contact billing support', 409)
  if (!configurationId || !/^bpc_[A-Za-z0-9]+$/.test(configurationId) || configurationId === genericConfigurationId) {
    throw configurationError()
  }
  let config: Stripe.BillingPortal.Configuration
  try { config = await stripe.billingPortal.configurations.retrieve(configurationId) }
  catch { throw configurationError() }
  const update = config?.features?.subscription_update
  const targetProduct = stripeObjectId(params.price.product)
  if (config?.id !== configurationId || config.active !== true || config.is_default !== false || !update?.enabled ||
      update.default_allowed_updates?.length !== 1 || update.default_allowed_updates[0] !== 'price' ||
      update.proration_behavior !== 'always_invoice' ||
      update.schedule_at_period_end?.conditions?.length !== 0 ||
      !targetProduct || !update.products?.some((product) => product.product === targetProduct && product.prices.includes(targetPrice.id))) {
    throw configurationError()
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