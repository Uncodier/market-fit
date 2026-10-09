import "server-only"
import type Stripe from "stripe"

export type BillingCardSummary = { brand: string; last4: string; expMonth: number; expYear: number }
const idOf = (value: unknown): string | null => typeof value === "string" ? value
  : value && typeof value === "object" && "id" in value ? String(value.id) : null

/** Billing and top-up share one server-side selection, not a browser-chosen PM. */
export async function resolveBillingPaymentMethod(
  stripe: Stripe, customerId: string, siteId: string, subscriptionId?: string | null,
): Promise<Stripe.PaymentMethod | null> {
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted || customer.id !== customerId || customer.metadata?.site_id !== siteId) {
    throw new Error("Billing customer mismatch")
  }
  let methodId = idOf(customer.invoice_settings?.default_payment_method)
  if (!methodId && subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (idOf(subscription.customer) !== customerId) throw new Error("Subscription customer mismatch")
    if (["active", "trialing", "past_due"].includes(subscription.status)) methodId = idOf(subscription.default_payment_method)
  }
  if (!methodId) {
    // A single attached card is unambiguous; multiple cards require an explicit default.
    const methods = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 2 })
    if (methods.has_more || methods.data.length !== 1) return null
    methodId = methods.data[0].id
  }
  const method = await stripe.paymentMethods.retrieve(methodId)
  return billingCardSummary(method, customerId) ? method : null
}

export function billingCardSummary(method: Stripe.PaymentMethod, customerId: string): BillingCardSummary | null {
  if (idOf(method.customer) !== customerId || method.type !== "card" || !method.card) return null
  const now = new Date()
  if (method.card.exp_year < now.getUTCFullYear() ||
      (method.card.exp_year === now.getUTCFullYear() && method.card.exp_month < now.getUTCMonth()+1)) return null
  return { brand: method.card.brand, last4: method.card.last4,
    expMonth: method.card.exp_month, expYear: method.card.exp_year }
}
