import type Stripe from 'stripe'
import { SubscriptionRequestError } from '@/lib/subscription-pricing.server'
import { stripeObjectId } from '@/app/api/stripe/webhook/subscription-billing'

const review = () => new SubscriptionRequestError('Subscription change requires billing support to verify', 409)

function invoiceBelongsTo(invoice: Stripe.Invoice, id: string, customer: string, subscription: string) {
  const parent = stripeObjectId(invoice.parent?.subscription_details?.subscription)
  const legacy = stripeObjectId((invoice as Stripe.Invoice & { subscription?: string }).subscription)
  return invoice.id === id && stripeObjectId(invoice.customer) === customer &&
    !(parent && legacy && parent !== legacy) && (parent || legacy) === subscription
}

export function pendingUpgrade(invoice: Stripe.Invoice | string | null, sub: Stripe.Subscription,
  customer: string, target: string) {
  if (sub.pending_update?.subscription_items?.length !== 1 ||
      sub.pending_update.subscription_items[0].price.id !== target ||
      sub.pending_update.subscription_items[0].quantity !== 1 ||
      !Number.isSafeInteger(sub.pending_update.expires_at) ||
      sub.pending_update.expires_at <= Math.floor(Date.now() / 1000) ||
      typeof invoice === 'string' || !invoice || invoice.status !== 'open' ||
      invoice.billing_reason !== 'subscription_update' ||
      !invoice.id || !invoiceBelongsTo(invoice, stripeObjectId(sub.latest_invoice) || '', customer, sub.id)) throw review()
  let url: URL
  try { url = new URL(invoice.hosted_invoice_url || '') } catch { throw review() }
  if (url.protocol !== 'https:' || url.hostname !== 'invoice.stripe.com' || url.username || url.password) throw review()
  return { flow: 'prorated_upgrade' as const, status: 'pending_payment' as const, url: url.href }
}

/** Only an immutable paid upgrade invoice can establish that a lost response succeeded. */
export async function recoveredPaidUpgrade(stripe: Stripe, sub: Stripe.Subscription, customer: string, target: string) {
  const id = stripeObjectId(sub.latest_invoice)
  if (!id || sub.pending_update || sub.items.data[0].price.id !== target) throw review()
  const invoice = await stripe.invoices.retrieve(id)
  const item = sub.items.data[0]
  const lines = invoice.lines
  if (!invoiceBelongsTo(invoice, id, customer, sub.id) || invoice.status !== 'paid' ||
      invoice.billing_reason !== 'subscription_update' || !lines || lines.has_more ||
      !Number.isSafeInteger(item.current_period_start) || !Number.isSafeInteger(item.current_period_end) ||
      item.current_period_start >= item.current_period_end ||
      !lines.data.some(line => line.pricing?.price_details?.price === target && line.quantity === 1 &&
        line.period?.start === item.current_period_start && line.period?.end === item.current_period_end &&
        stripeObjectId(line.parent?.subscription_item_details?.subscription ?? line.subscription) === sub.id &&
        line.parent?.subscription_item_details?.proration !== true)) throw review()
  return { flow: 'prorated_upgrade' as const, status: 'paid' as const }
}

/** A schedule from a partial attempt is safe to finish only while its current phase is unchanged. */
export async function scheduleDowngrade(params: { stripe: Stripe; sub: Stripe.Subscription; customer: string;
  target: string; periodEnd: number; beforeProviderWrite: () => void; idempotencyKey: string }) {
  const { stripe, sub, customer, target, periodEnd } = params
  const item = sub.items.data[0]
  const attached = stripeObjectId(sub.schedule)
  // Stable across browser sessions: the idempotency key identifies a single
  // target and renewal period, never an arbitrary attached schedule.
  const key = `${params.customer}-${sub.id}-${target}-${periodEnd}`
  let schedule = attached ? await stripe.subscriptionSchedules.retrieve(attached) : null
  if (schedule && (schedule.id !== attached || stripeObjectId(schedule.subscription) !== sub.id ||
      stripeObjectId(schedule.customer) !== customer)) throw review()
  // An attached but unmarked schedule can only be reclaimed by replaying the
  // original create key. A marked schedule survives Stripe's replay window.
  if (!schedule?.metadata?.downgrade_target || !schedule?.metadata?.downgrade_period_end) {
    params.beforeProviderWrite()
    const created = await stripe.subscriptionSchedules.create({ from_subscription: sub.id },
      { idempotencyKey: `downgrade-schedule-${key}` })
    if (!created.id || (attached && created.id !== attached)) throw review()
    schedule = attached ? schedule : created
  }
  if (!schedule) throw review()
  if (!schedule.id || (attached && schedule.id !== attached) || stripeObjectId(schedule.subscription) !== sub.id ||
       (schedule.customer && stripeObjectId(schedule.customer) !== customer) || schedule.status !== 'active' ||
      !schedule.current_phase || schedule.current_phase.end_date !== periodEnd ||
      !Number.isSafeInteger(schedule.current_phase.start_date) ||
      schedule.current_phase.start_date > item.current_period_start) throw review()
  const phases = schedule.phases
  if (!phases || ![1, 2].includes(phases.length) ||
      phases[0].start_date !== schedule.current_phase.start_date || phases[0].end_date !== periodEnd ||
      phases[0].items?.length !== 1 || stripeObjectId(phases[0].items[0].price) !== item.price.id ||
      phases[0].items[0].quantity !== 1) throw review()
  if (phases.length === 2 && (schedule.end_behavior !== 'release' || phases[1].start_date !== periodEnd ||
      phases[1].items?.length !== 1 || stripeObjectId(phases[1].items[0].price) !== target ||
      phases[1].items[0].quantity !== 1)) throw review()
  if (schedule.metadata?.downgrade_target &&
      (schedule.metadata.downgrade_target !== target || schedule.metadata.downgrade_period_end !== String(periodEnd))) throw review()
  // The phase writer below only copies price/quantity. Reject tax, invoice,
  // payment and metadata settings that would be reset on phase replacement.
  if (sub.automatic_tax?.enabled || sub.default_tax_rates?.length || item.tax_rates?.length ||
      phases[0].automatic_tax?.enabled || phases[0].default_tax_rates?.length ||
      phases[0].items[0].tax_rates?.length || phases[0].discounts?.length ||
      phases[0].add_invoice_items?.length || phases[0].billing_thresholds ||
      phases[0].application_fee_percent || phases[0].transfer_data ||
      schedule.default_settings?.automatic_tax?.enabled ||
      schedule.default_settings?.billing_thresholds || schedule.default_settings?.transfer_data ||
      schedule.default_settings?.invoice_settings?.account_tax_ids?.length ||
      schedule.default_settings?.invoice_settings?.issuer?.type === 'account' ||
      phases[0].invoice_settings?.account_tax_ids?.length ||
      phases[0].invoice_settings?.issuer?.type === 'account' ||
      sub.invoice_settings?.issuer?.type === 'account' ||
      phases[0].items[0].discounts?.length || phases[0].items[0].billing_thresholds ||
      phases[0].items[0].metadata && Object.keys(phases[0].items[0].metadata).length ||
      phases[0].metadata && Object.keys(phases[0].metadata).length ||
      schedule.default_settings?.default_payment_method || phases[0].default_payment_method ||
      schedule.default_settings?.on_behalf_of || phases[0].on_behalf_of ||
      schedule.default_settings?.collection_method === 'send_invoice' ||
      phases[0].collection_method === 'send_invoice' ||
      phases[0].trial_end ||
      (schedule.end_behavior !== 'release' && schedule.end_behavior !== 'renew')) throw review()
  if (phases.length === 2) {
    if (schedule.metadata?.downgrade_target !== target ||
        schedule.metadata?.downgrade_period_end !== String(periodEnd) ||
        phases[1].automatic_tax?.enabled || phases[1].default_tax_rates?.length ||
        phases[1].items[0].tax_rates?.length || phases[1].discounts?.length ||
        phases[1].add_invoice_items?.length || phases[1].billing_thresholds ||
        phases[1].application_fee_percent || phases[1].transfer_data || phases[1].trial_end ||
        phases[1].items[0].discounts?.length || phases[1].items[0].billing_thresholds ||
        phases[1].default_payment_method || phases[1].on_behalf_of ||
        phases[1].invoice_settings?.account_tax_ids?.length) throw review()
    return { flow: 'scheduled_downgrade' as const, effectiveAt: new Date(periodEnd * 1000).toISOString() }
  }
  params.beforeProviderWrite()
  const updated = await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release', proration_behavior: 'none',
    metadata: { downgrade_target: target, downgrade_period_end: String(periodEnd) }, phases: [
      { start_date: schedule.current_phase.start_date, end_date: periodEnd,
        items: [{ price: item.price.id, quantity: 1 }], proration_behavior: 'none' },
      { start_date: periodEnd, items: [{ price: target, quantity: 1 }],
        iterations: 1, proration_behavior: 'none' },
    ],
  }, { idempotencyKey: `downgrade-phases-${key}` })
  if (updated.id !== schedule.id || stripeObjectId(updated.subscription) !== sub.id ||
      updated.metadata?.downgrade_target !== target ||
      updated.metadata?.downgrade_period_end !== String(periodEnd) ||
      updated.status !== 'active' || updated.phases?.length !== 2 ||
      updated.phases[0].end_date !== periodEnd || updated.phases[1].start_date !== periodEnd ||
      stripeObjectId(updated.phases[0].items?.[0]?.price) !== item.price.id ||
      stripeObjectId(updated.phases[1].items?.[0]?.price) !== target) throw review()
  return { flow: 'scheduled_downgrade' as const, effectiveAt: new Date(periodEnd * 1000).toISOString() }
}