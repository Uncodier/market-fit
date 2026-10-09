import type Stripe from 'stripe'
import { validateSubscriptionPrice, parseAddonsCount } from '@/lib/subscription-pricing.server'
import { configuredHistoricalSubscriptionPrice } from '@/lib/subscription-history-pricing.server'
import { stripeObjectId, stripeTimestampIso } from './subscription-billing'

type ServiceLine = Stripe.InvoiceLineItem & {
  type?: string; proration?: boolean; price?: { id: string } | null
  subtotal?: number; quantity_decimal?: string | null
  unit_amount_excluding_tax?: string | null
  proration_details?: { credited_items?: unknown } | null
}

function isProration(line: ServiceLine) {
  return line.parent?.subscription_item_details?.proration ?? line.proration ?? false
}

function verifyServiceAmount(line: ServiceLine, gross: number) {
  if (!Number.isSafeInteger(line.amount) || line.amount < 0 || line.amount > gross || line.currency !== 'usd') {
    throw new Error('Invoice full service amount is not verified')
  }
  // Newer Stripe versions expose the pre-discount subtotal explicitly. Older
  // regular lines use amount before separately listed discount_amounts.
  if (line.subtotal !== undefined) {
    if (line.subtotal !== gross) throw new Error('Invoice full service subtotal is not verified')
  } else if (!isProration(line) && line.amount !== gross) {
    throw new Error('Invoice full service amount is not verified')
  } else if (isProration(line) && line.amount !== gross && line.discountable !== false) {
    throw new Error('Invoice proration discount semantics are not verified')
  }
  // Proration amount ALREADY includes subscription discounts, with
  // discountable=false and no discount_amounts to add back. Its configured
  // recurring Price and full service duration prove gross service, NOT amount.
  // Do not recompute from current coupons (they may differ from this invoice).
}

/** Immutable service lines, never current subscription metadata, establish coverage. */
export async function verifiedInvoiceEntitlements(invoice: Stripe.Invoice, subscriptionId: string,
  stripe: { prices: Pick<Stripe['prices'], 'retrieve'> }) {
  if (invoice.lines?.has_more) throw new Error('Invoice lines are incomplete')
  const lines = (invoice.lines?.data || []) as ServiceLine[]
  const service = lines.filter((line) => {
    const details = line.parent?.subscription_item_details
    const id = stripeObjectId(details?.subscription ?? line.subscription)
    const isSubscription = details || line.type === 'subscription' || id
    if (!isSubscription) return false
    if (id && id !== subscriptionId) throw new Error('Invoice line subscription does not match')
    // Credits for the old service do not prove new service coverage.
    // Fully discounted NEW service can be zero; credited_items identifies old
    // zero-dollar credits without discarding the new zero-dollar debit.
    if (isProration(line) && (line.amount < 0 ||
        (details?.proration_details ?? line.proration_details)?.credited_items)) return false
    // A classification flag alone is not coverage: a full-price, full-period new
    // service charge is verified below; partial debit prorations fail closed.
    return true
  })
  const mapped = await Promise.all(service.map(async (line) => {
    const priceId = stripeObjectId(line.pricing?.price_details?.price ?? line.price)
    const config = priceId ? configuredHistoricalSubscriptionPrice(priceId) : undefined
    if (!config) throw new Error('Invoice subscription price is not configured')
    const price = await stripe.prices.retrieve(config.priceId)
    validateSubscriptionPrice(price, config)
    const quantity = parseAddonsCount(line.quantity)
    if (quantity < 1 || (line.quantity_decimal != null &&
        (!/^\d+(?:\.0{1,12})?$/.test(line.quantity_decimal) || Number(line.quantity_decimal) !== quantity))) {
      throw new Error('Invoice full service quantity is not verified')
    }
    const grossUnit = line.pricing?.unit_amount_decimal ?? line.unit_amount_excluding_tax
    if (grossUnit != null && (!/^\d+(?:\.0{1,12})?$/.test(grossUnit) || Number(grossUnit) !== config.amount)) {
      throw new Error('Invoice gross unit price is not verified')
    }
    verifyServiceAmount(line, config.amount * quantity)
    return { line, config, quantity }
  }))
  const bases = mapped.filter(({ config }) => config.plan !== 'addon')
  const addons = mapped.filter(({ config }) => config.plan === 'addon')
  if (bases.length > 1 || (bases.length === 1 && bases[0].quantity !== 1) ||
      (!bases.length && addons.length !== 1) || addons.length > 1) {
    throw new Error('Invoice paid service is missing or ambiguous')
  }
  const base = bases[0] ?? addons[0]
  const { start, end } = base.line.period
  const period_start = stripeTimestampIso(start)
  const period_end = stripeTimestampIso(end)
  if (!period_start || !period_end || end <= start) throw new Error('Invalid invoice subscription period')
  const anniversary = new Date(start * 1000)
  const day = anniversary.getUTCDate()
  const startLastDay = new Date(Date.UTC(anniversary.getUTCFullYear(), anniversary.getUTCMonth() + 1, 0)).getUTCDate()
  anniversary.setUTCDate(1)
  anniversary.setUTCMonth(anniversary.getUTCMonth() + (base.config.interval === 'year' ? 12 : 1))
  const lastDay = new Date(Date.UTC(anniversary.getUTCFullYear(), anniversary.getUTCMonth() + 1, 0)).getUTCDate()
  // A renewal after February may restore the original 29th/30th/31st anchor.
  const possibleDays = day === startLastDay ? Array.from({ length: 32 - day }, (_, index) => day + index) : [day]
  if (!possibleDays.some((anchor) => {
    anniversary.setUTCDate(Math.min(anchor, lastDay))
    return anniversary.getTime() === end * 1000
  })) throw new Error('Invoice service does not cover the full billing interval')
  if (addons.some(({ line, config }) => config.interval !== base.config.interval ||
      line.period.start !== start || line.period.end !== end)) {
    throw new Error('Invoice add-on service coverage does not match base service')
  }
  return { plan: base.config.plan === 'addon' ? 'commission' as const : base.config.plan,
    addonsCount: parseAddonsCount(addons.reduce((sum, item) => sum + item.quantity, 0)),
    billing_interval: base.config.interval, coverage_verified: true, period_start, period_end }
}