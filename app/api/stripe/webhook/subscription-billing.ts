import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { configuredSubscriptionPrice, validateSubscriptionPrice } from "@/lib/subscription-pricing.server"

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
  const legacyPeriodEnd = (subscription as Stripe.Subscription & {
    current_period_end?: number | null
  }).current_period_end
  // Cancellation is not an entitlement claim. Retired/unconfigured prices must
  // not prevent an authoritative terminal state from clearing existing coverage.
  if (isTerminalSubscriptionStatus(subscription.status)) {
    return { plan: null, addonsCount: 0, billingInterval: null,
      currentPeriodEnd: stripeTimestampIso(legacyPeriodEnd ?? items[0]?.current_period_end) }
  }
  if (subscription.items?.has_more) {
    throw new Error("Subscription items are incomplete")
  }
  const mapped = items.map((item) => {
    const config = configuredSubscriptionPrice(item.price.id)
    if (!config) throw new Error("Missing or unknown subscription plan price")
    validateSubscriptionPrice(item.price, config)
    return { item, config }
  })
  const baseItems = mapped.filter(({ config }) => config.plan !== 'addon')
  if (baseItems.length > 1) throw new Error("Ambiguous subscription price configuration")
  const base = baseItems[0]
  if (!base) throw new Error("Missing or unknown subscription plan")
  if (base && nonnegativeInteger(base.item.quantity) !== 1) throw new Error("Invalid base subscription quantity")
  const addonItems = mapped.filter(({ config }) => config.plan === 'addon')
  if (addonItems.some(({ config }) => config.interval !== base?.config.interval)) {
    throw new Error("Subscription add-on interval does not match base price")
  }
  const addonsCount = nonnegativeInteger(addonItems.reduce(
    (total, { item }) => total + nonnegativeInteger(item.quantity), 0,
  ))
  const baseItem = base?.item
  const plan = base && base.config.plan !== 'addon' ? base.config.plan : null
  const billingInterval = base?.config.interval ?? null
  const currentPeriodEnd = stripeTimestampIso(legacyPeriodEnd ?? baseItem?.current_period_end)
  return { plan, addonsCount, billingInterval, currentPeriodEnd }
}

/** Read-only Stripe/billing snapshots; callers supply trusted server clients. */
export async function retrieveStripeSubscription(params: {
  subscriptionId: string
  stripe: SubscriptionStripeClient
  supabase: SubscriptionBillingClient
  expectedCustomerId?: string
}) {
  if (!stripeObjectId(params.subscriptionId)) throw new Error("Missing subscription ID")
  // Without a routing hint, the first read establishes customer identity only.
  // Status is always retrieved AFTER the billing identity used by the SQL CAS.
  const routing = params.expectedCustomerId ? null : await params.stripe.subscriptions.retrieve(params.subscriptionId)
  if (routing && routing.id !== params.subscriptionId) throw new Error("Subscription ID mismatch")
  const customerId = params.expectedCustomerId ?? stripeObjectId(routing?.customer)
  if (!customerId) throw new Error("Subscription customer is missing")
  const customer = await params.stripe.customers.retrieve(customerId)
  if (customer.id !== customerId || customer.deleted) {
    throw new Error("Subscription customer is unavailable")
  }
  const siteId = customer.metadata?.site_id?.trim()
  if (!siteId) throw new Error("Subscription customer has no site_id")
  const { data: billing, error } = await params.supabase.from("billing")
    .select("stripe_customer_id,stripe_subscription_id").eq("site_id", siteId).single()
  if (error) throw new Error(`Failed to read subscription billing: ${error.message}`)
  if (!billing) throw new Error("Subscription billing row is missing")
  if (billing.stripe_customer_id !== customerId) throw new Error("Subscription billing customer does not match")
  if (billing.stripe_subscription_id !== null && !stripeObjectId(billing.stripe_subscription_id)) {
    throw new Error("Invalid subscription billing identity")
  }
  const expectedSubscriptionId = billing.stripe_subscription_id as string | null
  const subscription = await params.stripe.subscriptions.retrieve(params.subscriptionId)
  if (subscription.id !== params.subscriptionId) throw new Error("Subscription ID mismatch")
  if (stripeObjectId(subscription.customer) !== customerId) throw new Error("Subscription customer does not match")
  return { subscription, customerId, siteId, expectedSubscriptionId, ...resolveStripeSubscriptionDetails(subscription) }
}

/** Persist only snapshots retrieved with the billing CAS fence above. Service role only. */
export async function syncRetrievedStripeSubscription(
  current: Awaited<ReturnType<typeof retrieveStripeSubscription>>,
  supabase: SubscriptionBillingClient,
  invoiceId?: string,
) {
  const { subscription, customerId, siteId, currentPeriodEnd } = current
  const { data, error } = await supabase.rpc("sync_stripe_subscription_state", {
    p_site_id: siteId,
    p_customer_id: customerId,
    p_subscription_id: subscription.id,
    p_expected_subscription_id: current.expectedSubscriptionId,
    p_status: subscription.status,
    p_current_period_end: currentPeriodEnd,
    p_start_date: stripeTimestampIso(subscription.start_date),
    p_end_date: stripeTimestampIso(subscription.ended_at),
    p_auto_renew: !subscription.cancel_at_period_end && !subscription.cancel_at &&
      !subscription.ended_at && !isTerminalSubscriptionStatus(subscription.status),
    ...(invoiceId ? { p_invoice_id: invoiceId } : {}),
  })
  if (error) throw new Error(`Failed to update subscription: ${error.message}`)
  if (!data || !["synced", "obsolete_subscription"].includes(data.outcome) ||
      (data.subscription_id !== null && !stripeObjectId(data.subscription_id)) ||
      (data.outcome === "synced" && data.subscription_id !== subscription.id)) {
    throw new Error("Invalid sync_stripe_subscription_state response")
  }
  // SQL owns terminal fallback/coverage clearing atomically. No unfenced writes.
  return { ...current, outcome: data.outcome as "synced" | "obsolete_subscription" }
}

/** Service client only, after webhook verification or explicit operator authorization. */
export async function syncStripeSubscription(params: {
  subscriptionId: string
  stripe: SubscriptionStripeClient
  supabase: SubscriptionBillingClient
  expectedCustomerId?: string
}) {
  return syncRetrievedStripeSubscription(await retrieveStripeSubscription(params), params.supabase)
}