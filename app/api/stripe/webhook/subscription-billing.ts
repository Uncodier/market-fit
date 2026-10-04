import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { normalizeBillingPlan, type BillingPlan } from "@/lib/billing-plans"

export type SubscriptionBillingClient = Pick<SupabaseClient, "from" | "rpc">
export type SubscriptionStripeClient = {
  subscriptions: Pick<Stripe["subscriptions"], "retrieve">
  customers: Pick<Stripe["customers"], "retrieve">
}

export function isTerminalSubscriptionStatus(status: string): boolean {
  return ["canceled", "cancelled", "incomplete_expired"].includes(status)
}

export function stripeObjectId(value: unknown): string | null {
  if (typeof value === "string") return value.trim() ? value : null
  if (value && typeof value === "object" && "id" in value) {
    return stripeObjectId(value.id)
  }
  return null
}

export function stripeTimestampIso(value: number | null | undefined): string | null {
  if (value == null) return null
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid Stripe timestamp")
  }
  const date = new Date(value * 1000)
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid Stripe timestamp")
  return date.toISOString()
}

function nonnegativeInteger(value: unknown): number {
  if (typeof value !== "number" &&
      (typeof value !== "string" || !/^\d+$/.test(value))) {
    throw new Error("Invalid subscription add-on count")
  }
  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 0 || count > 100) {
    throw new Error("Invalid subscription add-on count")
  }
  return count
}

export function resolveStripeSubscriptionDetails(subscription: Stripe.Subscription) {
  const items = subscription.items?.data || []
  if (subscription.items?.has_more) {
    throw new Error("Subscription items are incomplete")
  }
  const prices: [BillingPlan, string | undefined][] = [
    ["engine", process.env.STRIPE_STARTER_PRICE_ID],
    ["foundry", process.env.STRIPE_STARTUP_PRICE_ID],
    ["enterprise", process.env.STRIPE_ENTERPRISE_PRICE_ID],
  ]
  const addonPrice = process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID
  const matches = items.flatMap((item) => prices
    .filter(([, price]) => price && price === item.price.id)
    .map(([plan]) => ({ plan, item })))
  if (matches.length > 1 || matches.some(({ item }) => item.price.id === addonPrice)) {
    throw new Error("Ambiguous subscription price configuration")
  }
  const metadataPlan = normalizeBillingPlan(subscription.metadata?.plan)
  const pricePlan = matches[0]?.plan
  if (metadataPlan && pricePlan && metadataPlan !== pricePlan) {
    throw new Error("Subscription plan does not match configured price")
  }
  const plan = metadataPlan || pricePlan
  const terminal = isTerminalSubscriptionStatus(subscription.status)
  if (!plan && !terminal) throw new Error("Missing or unknown subscription plan")

  const addonItems = items.filter((item) => addonPrice && item.price.id === addonPrice)
  // A configured price and a complete item list supersede possibly stale metadata.
  const addonsCount = terminal ? 0 : addonPrice
    ? nonnegativeInteger(addonItems.reduce(
      (total, item) => total + nonnegativeInteger(item.quantity), 0,
    ))
    : nonnegativeInteger(subscription.metadata?.addons_count ?? "0")
  const baseItems = items.filter((item) => !addonPrice || item.price.id !== addonPrice)
  const baseItem = matches[0]?.item || (baseItems.length === 1 ? baseItems[0] : undefined)
  const legacyPeriodEnd = (subscription as Stripe.Subscription & {
    current_period_end?: number | null
  }).current_period_end
  const currentPeriodEnd = stripeTimestampIso(legacyPeriodEnd ?? baseItem?.current_period_end)
  return { plan: plan || null, addonsCount, currentPeriodEnd }
}

/** Stripe reads only; callers must supply an authenticated, trusted Stripe client. */
export async function retrieveStripeSubscription(params: {
  subscriptionId: string
  stripe: SubscriptionStripeClient
  expectedCustomerId?: string
}) {
  if (!stripeObjectId(params.subscriptionId)) throw new Error("Missing subscription ID")
  const subscription = await params.stripe.subscriptions.retrieve(params.subscriptionId)
  if (subscription.id !== params.subscriptionId) throw new Error("Subscription ID mismatch")
  const customerId = stripeObjectId(subscription.customer)
  if (!customerId) throw new Error("Subscription customer is missing")
  if (params.expectedCustomerId && params.expectedCustomerId !== customerId) {
    throw new Error("Subscription customer does not match")
  }
  const customer = await params.stripe.customers.retrieve(customerId)
  if (customer.id !== customerId || customer.deleted) {
    throw new Error("Subscription customer is unavailable")
  }
  const siteId = customer.metadata?.site_id?.trim()
  if (!siteId) throw new Error("Subscription customer has no site_id")
  return { subscription, customerId, siteId, ...resolveStripeSubscriptionDetails(subscription) }
}

/** Service client only, after webhook verification or explicit operator authorization. */
export async function syncStripeSubscription(params: {
  subscriptionId: string
  stripe: SubscriptionStripeClient
  supabase: SubscriptionBillingClient
  expectedCustomerId?: string
}) {
  const current = await retrieveStripeSubscription(params)
  const { subscription, customerId, siteId, plan, addonsCount, currentPeriodEnd } = current
  const { data, error } = await params.supabase.rpc("upsert_billing", {
    p_site_id: siteId,
    p_plan: isTerminalSubscriptionStatus(subscription.status) ? "commission" : plan,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscription.id,
    p_subscription_status: subscription.status,
    p_subscription_current_period_end: currentPeriodEnd,
    p_auto_renew: !subscription.cancel_at_period_end && !subscription.cancel_at &&
      !subscription.ended_at && !isTerminalSubscriptionStatus(subscription.status),
  })
  if (error) throw new Error(`Failed to update subscription: ${error.message}`)
  if (data?.success !== true) {
    throw new Error("Failed to update subscription: upsert_billing rejected the update")
  }
  const { data: billing, error: addonsError } = await params.supabase.from("billing")
    .update({ addons_count: addonsCount }).eq("site_id", siteId).select("id").single()
  if (addonsError) {
    throw new Error(`Failed to update subscription add-ons: ${addonsError.message}`)
  }
  if (!billing?.id) throw new Error("Subscription billing row is missing")
  return current
}