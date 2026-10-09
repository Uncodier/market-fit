import type Stripe from 'stripe'
import { SubscriptionRequestError } from '@/lib/subscription-pricing.server'
import { stripeObjectId } from '@/app/api/stripe/webhook/subscription-billing'
import { retainedDiscounts, verifyPhaseDiscounts, phaseDiscountFields } from './discount-preservation'
import { cancelFreeAddonsAtRenewal } from './addon-cancellation'
import { verifiedInvoiceEntitlements } from '@/app/api/stripe/webhook/subscription-invoice-entitlements'

const review = () => new SubscriptionRequestError('Add-on change requires billing support to verify; no further change was made', 409)

function invoiceBelongs(invoice: Stripe.Invoice, id: string, customer: string, subscription: string) {
  const current = stripeObjectId(invoice.parent?.subscription_details?.subscription)
  const legacy = stripeObjectId((invoice as Stripe.Invoice & { subscription?: string }).subscription)
  return invoice.id === id && stripeObjectId(invoice.customer) === customer &&
    !(current && legacy && current !== legacy) && (current || legacy) === subscription
}

function pendingPayment(invoice: Stripe.Invoice, sub: Stripe.Subscription, customerId: string,
  base: Stripe.SubscriptionItem | undefined, addonPrice: string, count: number) {
  const items = sub.pending_update?.subscription_items
  if (!items || items.length !== (base ? 1 : 0) + (count ? 1 : 0) ||
      (base && !items.some(item => item.price.id === base.price.id && item.quantity === 1)) ||
      (count > 0 && !items.some(item => item.price.id === addonPrice && item.quantity === count)) ||
      !Number.isSafeInteger(sub.pending_update?.expires_at) ||
      sub.pending_update!.expires_at <= Math.floor(Date.now() / 1000) ||
      invoice.status !== 'open' || invoice.billing_reason !== 'subscription_update' ||
      !invoiceBelongs(invoice, stripeObjectId(sub.latest_invoice) || '', customerId, sub.id)) throw review()
  let url: URL
  try { url = new URL(invoice.hosted_invoice_url || '') } catch { throw review() }
  if (url.protocol !== 'https:' || url.hostname !== 'invoice.stripe.com' || url.username || url.password) throw review()
  return { flow: 'prorated_addon' as const, status: 'pending_payment' as const, url: url.href }
}

async function paidRecovery(stripe: Stripe, sub: Stripe.Subscription, customerId: string,
  base: Stripe.SubscriptionItem | undefined, anchor: Stripe.SubscriptionItem, addonPrice: string, count: number) {
  const id = stripeObjectId(sub.latest_invoice)
  if (!id) throw review()
  const invoice = await stripe.invoices.retrieve(id)
  const lines = invoice.lines
  if (!invoiceBelongs(invoice, id, customerId, sub.id) || invoice.status !== 'paid' ||
      invoice.billing_reason !== 'subscription_update' || !lines || lines.has_more ||
      !Number.isSafeInteger(anchor.current_period_start) || !Number.isSafeInteger(anchor.current_period_end) ||
      anchor.current_period_start >= anchor.current_period_end) throw review()
  if (!base) {
    // Reuse settlement's gross-price/full-duration proof, including fully
    // discounted new-service prorations. Old credits never establish coverage.
    const proof = await verifiedInvoiceEntitlements(invoice, sub.id, stripe)
    if (proof.plan !== 'commission' || proof.addonsCount !== count ||
        proof.billing_interval !== anchor.price.recurring?.interval ||
        proof.period_start !== new Date(anchor.current_period_start * 1000).toISOString() ||
        proof.period_end !== new Date(anchor.current_period_end * 1000).toISOString()) throw review()
    return { flow: 'prorated_addon' as const, status: 'paid' as const }
  }
  const service = (price: string, quantity: number) => lines.data.some(line =>
    stripeObjectId(line.pricing?.price_details?.price) === price && line.quantity === quantity &&
    line.period?.start === anchor.current_period_start && line.period?.end === anchor.current_period_end &&
    stripeObjectId(line.parent?.subscription_item_details?.subscription ?? line.subscription) === sub.id &&
    line.parent?.subscription_item_details?.proration !== true)
  if ((base && !service(base.price.id, 1)) || (count > 0 && !service(addonPrice, count))) throw review()
  return { flow: 'prorated_addon' as const, status: 'paid' as const }
}

type Change = {
  stripe: Stripe; sub: Stripe.Subscription; baseItem?: Stripe.SubscriptionItem
  addonItem?: Stripe.SubscriptionItem; addonPrice?: Stripe.Price; customerId: string
  addonsCount: number; requiredAddons?: number; beforeProviderWrite: () => void; idempotencyKey: string
}

async function scheduleReduction({ stripe, sub, baseItem, addonItem, customerId, addonsCount,
  requiredAddons, beforeProviderWrite }: Change) {
  const anchor = baseItem ?? addonItem
  if (!anchor) throw review()
  const paymentMethod = stripeObjectId(sub.default_payment_method)
  if (sub.default_payment_method && (!paymentMethod || !/^pm_[A-Za-z0-9]+$/.test(paymentMethod))) throw review()
  const end = anchor.current_period_end
  if (!addonItem || !Number.isSafeInteger(end) || end <= Math.floor(Date.now() / 1000) ||
      (requiredAddons !== undefined && addonsCount < requiredAddons) ||
      !Number.isSafeInteger(anchor.current_period_start) || anchor.current_period_start >= end ||
      addonItem.current_period_end !== end || addonItem.current_period_start !== anchor.current_period_start ||
      sub.automatic_tax?.enabled || sub.default_tax_rates?.length || baseItem?.tax_rates?.length ||
      addonItem.tax_rates?.length || sub.billing_thresholds || baseItem?.billing_thresholds ||
      addonItem.billing_thresholds || sub.pending_invoice_item_interval || sub.trial_end ||
      sub.application_fee_percent || sub.transfer_data ||
      sub.default_source || sub.on_behalf_of || sub.invoice_settings?.account_tax_ids?.length ||
      sub.invoice_settings?.issuer?.type === 'account' ||
      sub.payment_settings?.payment_method_types?.some(method => method !== 'card') ||
      sub.metadata && Object.keys(sub.metadata).some(key => key !== 'site_id' && key !== 'plan' &&
        key !== 'billing_interval' && key !== 'addons_count' && key !== 'type' &&
        key !== 'price_id' && key !== 'addon_price_id')) throw review()
  const key = `${customerId}-${sub.id}-${baseItem?.price.id ?? 'commission'}-${addonItem.price.id}-${addonsCount}-${end}`
  const attached = stripeObjectId(sub.schedule)
  let schedule = attached ? await stripe.subscriptionSchedules.retrieve(attached) : null
  if (schedule && (schedule.id !== attached || stripeObjectId(schedule.customer) !== customerId ||
      stripeObjectId(schedule.subscription) !== sub.id)) throw review()
  if (!schedule?.metadata?.addon_target || !schedule?.metadata?.addon_period_end) {
    beforeProviderWrite()
    const created = await stripe.subscriptionSchedules.create({ from_subscription: sub.id },
      { idempotencyKey: `addon-schedule-${key}` })
    if (!created.id || (attached && created.id !== attached)) throw review()
    schedule = attached ? schedule : created
  }
  if (!schedule || stripeObjectId(schedule.subscription) !== sub.id ||
      (schedule.customer && stripeObjectId(schedule.customer) !== customerId) ||
      schedule.status !== 'active' || !schedule.current_phase || schedule.current_phase.end_date !== end ||
      !Number.isSafeInteger(schedule.current_phase.start_date) ||
      schedule.current_phase.start_date > anchor.current_period_start) throw review()
  const phases = schedule.phases
  const discounts = retainedDiscounts(sub.discounts)
  const baseDiscounts = retainedDiscounts(baseItem?.discounts)
  const addonDiscounts = retainedDiscounts(addonItem.discounts)
  const verifyDiscounts = (phase: Stripe.SubscriptionSchedule.Phase) => {
    if (phase.default_payment_method && stripeObjectId(phase.default_payment_method) !== paymentMethod) throw review()
    verifyPhaseDiscounts(phase.discounts, discounts)
    phase.items.forEach(item => verifyPhaseDiscounts(item.discounts,
      stripeObjectId(item.price) === baseItem?.price.id ? baseDiscounts : addonDiscounts))
  }
  const sameItems = (items: Stripe.SubscriptionSchedule.Phase.Item[], count: number) =>
    items?.length === (baseItem ? 1 : 0) + (count ? 1 : 0) &&
    (!baseItem || items.some(item => stripeObjectId(item.price) === baseItem.price.id && item.quantity === 1)) &&
    (!count || items.some(item => stripeObjectId(item.price) === addonItem.price.id && item.quantity === count)) &&
    items.every(item => [baseItem?.price.id, addonItem.price.id].includes(stripeObjectId(item.price) || ''))
  if (!phases || ![1, 2].includes(phases.length) ||
      phases[0].start_date !== schedule.current_phase.start_date || phases[0].end_date !== end ||
      !sameItems(phases[0].items, addonItem.quantity || 0) ||
      (phases.length === 2 && (schedule.end_behavior !== 'release' || phases[1].start_date !== end ||
        !sameItems(phases[1].items, addonsCount))) ||
      (schedule.metadata?.addon_target && (schedule.metadata.addon_target !== String(addonsCount) ||
        schedule.metadata.addon_period_end !== String(end)))) throw review()
  phases.forEach(verifyDiscounts)
  // Replacing phases must not discard provider-specific billing or item settings.
  if (phases.some(phase => phase.automatic_tax?.enabled || phase.default_tax_rates?.length ||
      phase.add_invoice_items?.length || phase.billing_thresholds ||
      phase.application_fee_percent || phase.transfer_data ||
      phase.on_behalf_of || phase.trial_end || phase.collection_method === 'send_invoice' ||
      phase.invoice_settings?.account_tax_ids?.length ||
      phase.invoice_settings?.issuer?.type === 'account' || phase.metadata && Object.keys(phase.metadata).length ||
      phase.items.some(item => item.tax_rates?.length || item.billing_thresholds ||
        item.metadata && Object.keys(item.metadata).length)) ||
      schedule.default_settings?.automatic_tax?.enabled || schedule.default_settings?.billing_thresholds ||
      schedule.default_settings?.transfer_data ||
      (schedule.default_settings?.default_payment_method && stripeObjectId(schedule.default_settings.default_payment_method) !== paymentMethod) ||
      schedule.default_settings?.on_behalf_of || schedule.default_settings?.collection_method === 'send_invoice' ||
      schedule.default_settings?.invoice_settings?.account_tax_ids?.length ||
      schedule.default_settings?.invoice_settings?.issuer?.type === 'account' ||
      (schedule.end_behavior !== 'renew' && schedule.end_behavior !== 'release')) throw review()
  if (phases.length === 2) {
    if (schedule.metadata?.addon_target !== String(addonsCount) ||
        schedule.metadata?.addon_period_end !== String(end)) throw review()
    return { flow: 'scheduled_addon_reduction' as const, effectiveAt: new Date(end * 1000).toISOString() }
  }
  const items = (quantity: number) => [...(baseItem ? [{ price: baseItem.price.id, quantity: 1, ...phaseDiscountFields(baseDiscounts) }] : []),
    ...(quantity ? [{ price: addonItem.price.id, quantity, ...phaseDiscountFields(addonDiscounts) }] : [])]
  beforeProviderWrite()
  const updated = await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release', proration_behavior: 'none',
    metadata: { addon_target: String(addonsCount), addon_period_end: String(end) },
    phases: [
      { start_date: schedule.current_phase.start_date, end_date: end,
        items: items(addonItem.quantity || 0), proration_behavior: 'none', ...phaseDiscountFields(discounts),
        ...(paymentMethod ? { default_payment_method: paymentMethod } : {}) },
      { start_date: end, items: items(addonsCount), iterations: 1, proration_behavior: 'none', ...phaseDiscountFields(discounts),
        ...(paymentMethod ? { default_payment_method: paymentMethod } : {}) },
    ],
  }, { idempotencyKey: `addon-phases-${key}` })
  if (updated.id !== schedule.id || stripeObjectId(updated.subscription) !== sub.id ||
      updated.status !== 'active' || updated.metadata?.addon_target !== String(addonsCount) ||
      updated.metadata?.addon_period_end !== String(end) || updated.phases?.length !== 2 ||
      updated.phases[0].end_date !== end || updated.phases[1].start_date !== end ||
      (paymentMethod && updated.phases.some(phase => stripeObjectId(phase.default_payment_method) !== paymentMethod)) ||
      !sameItems(updated.phases[0].items, addonItem.quantity || 0) ||
      !sameItems(updated.phases[1].items, addonsCount)) throw review()
  updated.phases.forEach(verifyDiscounts)
  return { flow: 'scheduled_addon_reduction' as const, effectiveAt: new Date(end * 1000).toISOString() }
}

export async function changeAddonQuantity(params: Change) {
  const { stripe, sub, baseItem, addonItem, addonPrice, customerId, addonsCount } = params
  if (!addonPrice || sub.collection_method !== 'charge_automatically') throw review()
  const current = addonItem?.quantity || 0
  const anchor = baseItem ?? addonItem
  if (!anchor || addonsCount < (params.requiredAddons ?? 0)) throw review()
  if (!baseItem && addonsCount === 0) return cancelFreeAddonsAtRenewal(params)
  if (addonsCount < current) {
    if (sub.pending_update) throw review()
    return scheduleReduction(params)
  }
  if (sub.schedule) throw review()
  if (sub.pending_update) {
    const id = stripeObjectId(sub.latest_invoice)
    if (!id) throw review()
    return pendingPayment(await stripe.invoices.retrieve(id), sub, customerId, baseItem, addonPrice.id, addonsCount)
  }
  if (addonsCount === current) {
    return paidRecovery(stripe, sub, customerId, baseItem, anchor, addonPrice.id, addonsCount)
  }
  const previousId = stripeObjectId(sub.latest_invoice)
  if (!previousId || !Number.isSafeInteger(anchor.current_period_end) ||
      anchor.current_period_end <= Math.floor(Date.now() / 1000)) throw review()
  const previous = await stripe.invoices.retrieve(previousId)
  if (!invoiceBelongs(previous, previousId, customerId, sub.id) || previous.status !== 'paid') throw review()
  const items = [...(baseItem ? [{ id: baseItem.id, price: baseItem.price.id, quantity: 1 }] : []),
    ...(addonItem ? [{ id: addonItem.id, price: addonPrice.id, quantity: addonsCount }]
      : [{ price: addonPrice.id, quantity: addonsCount }])]
  params.beforeProviderWrite()
  const updated = await stripe.subscriptions.update(sub.id, {
    items, billing_cycle_anchor: 'now', proration_behavior: 'always_invoice',
    payment_behavior: 'pending_if_incomplete', expand: ['latest_invoice'],
  }, { idempotencyKey: `addon-increase-${params.idempotencyKey}` })
  if (updated.id !== sub.id || stripeObjectId(updated.customer) !== customerId) throw review()
  if (updated.pending_update) {
    const id = stripeObjectId(updated.latest_invoice)
    if (!id) throw review()
    return pendingPayment(await stripe.invoices.retrieve(id), updated, customerId, baseItem, addonPrice.id, addonsCount)
  }
  if (typeof updated.latest_invoice === 'string' || !updated.latest_invoice ||
      updated.latest_invoice.status !== 'paid') throw review()
  return { flow: 'prorated_addon' as const, status: 'paid' as const }
}
