import type Stripe from "stripe"
import { fromStripeMinorAmount } from "@/app/api/stripe/checkout/checkout-payment-guard"
import type { BillingInterval, SubscriptionPlan } from "@/lib/subscription-pricing.server"
import {
  retrieveStripeSubscription, syncRetrievedStripeSubscription, stripeObjectId, stripeTimestampIso,
  type SubscriptionBillingClient, type SubscriptionStripeClient,
} from "./subscription-billing"
import { verifiedInvoiceEntitlements } from "./subscription-invoice-entitlements"

type CompatibleInvoice = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null
  payment_intent?: string | Stripe.PaymentIntent | null
  subscription_details?: { metadata?: Stripe.Metadata | null } | null
}

export type StripeSubscriptionInvoiceInput = {
  site_id: string
  invoice_id: string
  customer_id: string
  subscription_id: string
  current_subscription_status: string
  current_service: {
    plan: SubscriptionPlan | null
    addons_count: number
    billing_interval: BillingInterval | null
  }
  payment_intent_id: string | null
  status: "paid" | "failed"
  amount: number
  currency: string
  billing_reason: string | null
  plan: SubscriptionPlan
  addons_count: number
  billing_interval: BillingInterval
  coverage_verified: boolean
  paid_at: string | null
  invoice_url: string | null
  event_id: string | null
  period_start: string | null
  period_end: string | null
}

export type StripeSubscriptionInvoiceResult = {
  outcome: "settled" | "duplicate" | "failed_recorded" | "ignored_failure"
  payment_id: string
  credits_granted: number
  coverage_recovered?: boolean
}

export type ObsoleteSubscriptionInvoiceResult = { outcome: "obsolete_subscription"; credits_granted: 0 }

export function stripeInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = stripeObjectId((invoice as CompatibleInvoice).subscription)
  const basil = stripeObjectId(invoice.parent?.subscription_details?.subscription)
  if (legacy && basil && legacy !== basil) {
    throw new Error("Conflicting invoice subscription identities")
  }
  return basil || legacy
}

function invoicePaymentIntentId(invoice: CompatibleInvoice): string | null {
  const legacy = stripeObjectId(invoice.payment_intent)
  if (legacy) return legacy
  const payments = invoice.payments?.data || []
  const payment = payments.find((item) => item.is_default) ||
    (payments.length === 1 ? payments[0] : undefined)
  return stripeObjectId(payment?.payment.payment_intent)
}

function settlementResult(value: unknown): StripeSubscriptionInvoiceResult {
  const data = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null
  if (!data || data.success === false ||
      typeof data.outcome !== "string" ||
      !["settled", "duplicate", "failed_recorded", "ignored_failure"].includes(data.outcome) ||
      typeof data.payment_id !== "string" || !data.payment_id.trim() ||
      typeof data.credits_granted !== "number" ||
      !Number.isSafeInteger(data.credits_granted) || data.credits_granted < 0) {
    throw new Error("Invalid settle_stripe_subscription_invoice response")
  }
  return data as StripeSubscriptionInvoiceResult
}

/**
 * Service client only, after webhook verification or explicit operator authorization.
 * SQL owns invoice identity, payment transitions, and the atomic credit ledger.
 * null means a non-subscription invoice, not a successful subscription settlement.
 */
export async function settleStripeSubscriptionInvoice(params: {
  invoiceId: string
  stripe: SubscriptionStripeClient & {
    invoices: Pick<Stripe["invoices"], "retrieve">
    prices: Pick<Stripe["prices"], "retrieve">
  }
  supabase: SubscriptionBillingClient
  eventId?: string | null
  requirePaid?: boolean
  expectedCustomerId?: string
  expectedSubscriptionId?: string
}): Promise<StripeSubscriptionInvoiceResult | ObsoleteSubscriptionInvoiceResult | null> {
  if (!stripeObjectId(params.invoiceId)) throw new Error("Missing invoice ID")
  // Never merge event fields into this snapshot, even when a live field is absent.
  const invoice = await params.stripe.invoices.retrieve(params.invoiceId, { expand: ["payments"] })
  if (invoice.id !== params.invoiceId) throw new Error("Invoice ID mismatch")
  const subscriptionId = stripeInvoiceSubscriptionId(invoice)
  if (!subscriptionId) {
    if (params.expectedSubscriptionId || invoice.billing_reason?.startsWith("subscription")) {
      throw new Error("Invoice subscription is missing")
    }
    return null
  }
  if (params.expectedSubscriptionId && params.expectedSubscriptionId !== subscriptionId) {
    throw new Error("Invoice subscription does not match")
  }
  const customerId = stripeObjectId(invoice.customer)
  if (!customerId) throw new Error("Invoice customer is missing")
  if (params.expectedCustomerId && params.expectedCustomerId !== customerId) {
    throw new Error("Invoice customer does not match")
  }
  if (params.requirePaid && invoice.status !== "paid") {
    throw new Error("Stripe invoice is not paid")
  }
  if (invoice.status !== "paid" && invoice.status !== "open" && invoice.status !== "uncollectible") {
    throw new Error("Stripe invoice has no settleable payment status")
  }
  const current = await retrieveStripeSubscription({
    subscriptionId, stripe: params.stripe, supabase: params.supabase, expectedCustomerId: customerId,
  })
  const { siteId } = current
  const { plan, addonsCount, ...coverage } = await verifiedInvoiceEntitlements(invoice, subscriptionId, params.stripe)
  // Immutable invoice proof and current-service eligibility are distinct.
  // SQL compares this fresh tuple to STORED update coverage on duplicate recovery;
  // replacing coverage_verified with false is insufficient (stored proof wins).
  const status = invoice.status === "paid" ? "paid" : "failed"
  if (!invoice.currency || !/^[a-z]{3}$/i.test(invoice.currency)) {
    throw new Error("Invalid invoice currency")
  }
  const paidAt = status === "paid" ? stripeTimestampIso(invoice.status_transitions?.paid_at) : null
  if (status === "paid" && !paidAt) throw new Error("Paid invoice has no paid_at timestamp")
  const input: StripeSubscriptionInvoiceInput = {
    site_id: siteId,
    invoice_id: invoice.id,
    customer_id: customerId,
    subscription_id: subscriptionId,
    current_subscription_status: current.subscription.status,
    current_service: { plan: current.plan, addons_count: current.addonsCount, billing_interval: current.billingInterval },
    payment_intent_id: invoicePaymentIntentId(invoice),
    status,
    amount: fromStripeMinorAmount(
      status === "paid" ? invoice.amount_paid : invoice.amount_due, invoice.currency,
    ),
    currency: invoice.currency.toUpperCase(),
    billing_reason: invoice.billing_reason ?? null,
    plan,
    addons_count: addonsCount,
    paid_at: paidAt,
    invoice_url: invoice.hosted_invoice_url || invoice.invoice_pdf || null,
    event_id: params.eventId ?? null,
    ...coverage,
  }
  // SQL checks this invoice's immutable marker under the billing lock: already
  // applied duplicates must not synchronize even a delayed same-ID snapshot.
  const synced = await syncRetrievedStripeSubscription(current, params.supabase, invoice.id)
  if (synced.outcome === "obsolete_subscription") {
    return { outcome: "obsolete_subscription", credits_granted: 0 }
  }
  const { data, error } = await params.supabase.rpc("settle_stripe_subscription_invoice", {
    p_invoice: input,
  })
  if (error) throw new Error(`Failed to settle subscription invoice: ${error.message}`)
  return settlementResult(data)
}