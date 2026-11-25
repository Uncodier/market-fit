import type Stripe from 'stripe'
import { SubscriptionRequestError } from '@/lib/subscription-pricing.server'
import { stripeObjectId } from '@/app/api/stripe/webhook/subscription-billing'
import { stripeInvoiceSubscriptionId } from '@/app/api/stripe/webhook/subscription-invoice-settlement'

const review = () => new SubscriptionRequestError('Previous subscription or invoice requires billing support before restarting', 409)

export class SubscriptionPaidThroughError extends SubscriptionRequestError {
  constructor(public readonly paidThrough: string) {
    super(`Your previous subscription is paid through ${paidThrough}. Restart billing after that time.`, 409)
  }
}

type BoundaryInput = {
  stripe: Stripe
  customerId: string
  subscriptionId?: string | null
  subscriptions: Stripe.Subscription[]
  isOwner: boolean
  readAttestedPaidThrough: () => Promise<unknown>
}

/** Read-only gate for a new, immediately billed Checkout. Never bind a replacement early. */
export async function requireReplacementBoundary(input: BoundaryInput) {
  const { stripe, customerId, subscriptionId, subscriptions } = input
  const previous = new Map(subscriptions.map(sub => [sub.id, sub]))
  if (previous.size !== subscriptions.length || (subscriptionId && !previous.has(subscriptionId)) ||
      subscriptions.some(sub => !sub.id || stripeObjectId(sub.customer) !== customerId ||
        !['canceled', 'incomplete_expired'].includes(sub.status) || sub.schedule || sub.pending_update)) {
    throw review()
  }
  if (subscriptions.length && !input.isOwner) {
    throw new SubscriptionRequestError('Only the workspace owner can restart a canceled subscription', 403)
  }
  if (!subscriptions.length) return

  // A future-start schedule may still have no corresponding Subscription object.
  const schedules = await stripe.subscriptionSchedules.list({ customer: customerId, limit: 100 })
  if (schedules.has_more || schedules.data.some(schedule => stripeObjectId(schedule.customer) !== customerId ||
      !['canceled', 'completed', 'released'].includes(schedule.status))) throw review()

  let boundary = 0
  if (subscriptionId) {
    const attested = await input.readAttestedPaidThrough()
    if (attested !== null) {
      const timestamp = typeof attested === 'string' ? Date.parse(attested) : NaN
      if (!Number.isFinite(timestamp)) throw new Error('Invalid verified paid-through boundary')
      boundary = timestamp
    }
  }

  // Query Stripe as well as the DB. A webhook can lag, be disabled, or have
  // rejected an invoice for access without making a second charge appropriate.
  const invoices = await stripe.invoices.list({ customer: customerId, limit: 100 })
  if (invoices.has_more) throw review()
  const expectedInvoices = new Map<string, string>()
  for (const sub of subscriptions) {
    const latest = stripeObjectId(sub.latest_invoice)
    if (!latest && sub.status === 'canceled') throw review()
    if (latest && expectedInvoices.has(latest)) throw review()
    if (latest) expectedInvoices.set(latest, sub.id)
  }

  for (const invoice of invoices.data) {
    if (!invoice.id) throw review()
    const source = stripeInvoiceSubscriptionId(invoice)
    const expectedSource = expectedInvoices.get(invoice.id)
    if (!source) {
      if (expectedSource || invoice.billing_reason?.startsWith('subscription')) throw review()
      continue
    }
    if (!previous.has(source) || (expectedSource && expectedSource !== source) ||
        stripeObjectId(invoice.customer) !== customerId) throw review()
    expectedInvoices.delete(invoice.id)
    // Uncollectible invoices can still be paid later. Don't create another
    // payable invoice while old subscription debt could independently settle.
    if (invoice.status === 'void') continue
    if (invoice.status !== 'paid' || invoice.amount_remaining !== 0 ||
        invoice.lines?.has_more !== false || !invoice.lines.data.length) throw review()

    let hasServiceLine = false
    for (const line of invoice.lines.data) {
      const details = line.parent?.subscription_item_details
      const lineSources = [details?.subscription, line.parent?.invoice_item_details?.subscription, line.subscription]
        .map(stripeObjectId).filter(Boolean)
      if (lineSources.some(id => id !== source)) throw review()
      if (!details && !lineSources.length) continue
      const { start, end } = line.period ?? {}
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start ||
          !Number.isFinite(new Date(end * 1000).getTime())) throw review()
      // Even zero-dollar or refunded paid invoices are conservatively treated
      // as possible paid service; this read does not grant any entitlement.
      boundary = Math.max(boundary, end * 1000)
      hasServiceLine = true
    }
    if (!hasServiceLine) throw review()
  }
  if (expectedInvoices.size) throw review()
  if (boundary > Date.now()) throw new SubscriptionPaidThroughError(new Date(boundary).toISOString())
}