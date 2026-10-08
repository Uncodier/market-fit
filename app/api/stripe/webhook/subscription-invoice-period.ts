import type Stripe from "stripe"
import { stripeObjectId, stripeTimestampIso } from "./subscription-billing"
import { configuredSubscriptionPrice } from '@/lib/subscription-pricing.server'

type LegacyLine = Stripe.InvoiceLineItem & {
  type?: string
  proration?: boolean
  price?: { id: string } | null
}

/** Invoice line periods describe the entitlement month, not the invoice's creation range. */
export function stripeInvoiceCreditPeriod(invoice: Stripe.Invoice, subscriptionId: string) {
  if (!["subscription_create", "subscription_cycle"].includes(invoice.billing_reason || "")) {
    return { period_start: null, period_end: null }
  }
  if (invoice.lines?.has_more) throw new Error("Invoice lines are incomplete")
  const lines = (invoice.lines?.data || []) as LegacyLine[]
  const candidates = lines.filter((line) => {
    const details = line.parent?.subscription_item_details
    const lineSubscription = stripeObjectId(details?.subscription ?? line.subscription)
    const isSubscription = details || line.type === "subscription" || lineSubscription
    const price = stripeObjectId(line.pricing?.price_details?.price ?? line.price)
    return isSubscription && (!lineSubscription || lineSubscription === subscriptionId) &&
      !(details?.proration ?? line.proration) &&
       (!price || configuredSubscriptionPrice(price)?.plan !== 'addon')
  })
  if (candidates.length > 1) throw new Error("Ambiguous invoice subscription period")
  // Invoice.period_start/end is the interval for collected invoice items. It is
  // not a safe fallback for a present but unidentifiable subscription line list.
  if (lines.length && !candidates.length) throw new Error("Invoice subscription period is missing")
  const period = candidates[0]?.period || { start: invoice.period_start, end: invoice.period_end }
  const period_start = stripeTimestampIso(period.start)
  const period_end = stripeTimestampIso(period.end)
  if (!period_start || !period_end || period.end <= period.start) {
    throw new Error("Invalid invoice subscription period")
  }
  return { period_start, period_end }
}