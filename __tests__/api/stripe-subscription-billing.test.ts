/** @jest-environment node */
import { randomBytes, randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import { handleBillingStripeEvent } from "@/app/api/stripe/webhook/billing-event-handlers"
import { handleCheckoutSessionCompleted } from "@/app/api/stripe/webhook/checkout-session-handler"
import { syncStripeSubscription } from "@/app/api/stripe/webhook/subscription-billing"
import {
  settleStripeSubscriptionInvoice,
  type StripeSubscriptionInvoiceInput,
} from "@/app/api/stripe/webhook/subscription-invoice-settlement"
import { normalizeBillingPlan } from "@/lib/billing-plans"
import { configuredSubscriptionPrice } from '@/lib/subscription-pricing.server'

jest.mock("@/app/commerce/stripe-accounting-refunds", () => ({
  handleStripeRefundStatusEvent: jest.fn(), recordStripeAccountingRefunds: jest.fn(),
}))
jest.mock("@/app/commerce/handle-stripe-sale-refund", () => ({
  handleStripeSaleRefund: jest.fn(), resolveStripeRefundPaymentIntent: jest.fn(),
}))
jest.mock("@/app/api/stripe/webhook/sale-checkout-settlement", () => ({
  handleStripeSaleCheckoutCompleted: jest.fn(),
}))

type Invoice = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null
  payment_intent?: string | Stripe.PaymentIntent | null
  subscription_details?: { metadata: Stripe.Metadata }
}
const siteId = randomUUID()
const paymentId = randomUUID()
const paidAt = 1_790_900_000
const periodEnd = (() => { const date = new Date(paidAt * 1000); date.setUTCMonth(date.getUTCMonth() + 1); return date.getTime() / 1000 })()
const customer: Stripe.Customer = {
  id: "cus_billing", object: "customer", metadata: { site_id: siteId }, balance: 0,
  created: paidAt, default_source: null, description: null, email: null,
  invoice_prefix: "OFFLINE", invoice_settings: { custom_fields: null, default_payment_method: null,
    footer: null, rendering_options: null }, livemode: false, shipping: null,
}
const priceKeys = ["STRIPE_STARTER_PRICE_ID", "STRIPE_STARTUP_PRICE_ID",
  "STRIPE_ENTERPRISE_PRICE_ID", "STRIPE_ACCOUNT_ADDON_PRICE_ID",
  "STRIPE_STARTER_ANNUAL_PRICE_ID", "STRIPE_STARTUP_ANNUAL_PRICE_ID",
  "STRIPE_ENTERPRISE_ANNUAL_PRICE_ID", "STRIPE_ACCOUNT_ADDON_ANNUAL_PRICE_ID"] as const
const initialPrices = Object.fromEntries(priceKeys.map((key) => [key, process.env[key]]))

// Only the fields read by these handlers are populated; method mocks retain SDK types.
function item(price: string, quantity = 1, end = periodEnd): Stripe.SubscriptionItem {
  return { id: `si_${price}`, price: livePrice(price), quantity, current_period_end: end } as Stripe.SubscriptionItem
}
function livePrice(id: string): Stripe.Price {
  const config = configuredSubscriptionPrice(id)
  return { id, active: true, currency: 'usd', type: 'recurring', billing_scheme: 'per_unit',
    unit_amount: config?.amount ?? 9900, recurring: { interval: config?.interval ?? 'month', interval_count: 1, usage_type: 'licensed' } } as Stripe.Price
}
function serviceLine(price = 'price_base', quantity = 1): Stripe.InvoiceLineItem {
  return { id: `il_${price}`, amount: livePrice(price).unit_amount! * quantity, quantity, currency: 'usd',
    period: { start: paidAt, end: periodEnd }, pricing: { price_details: { price } },
    parent: { subscription_item_details: { subscription: 'sub_billing', proration: false } } } as Stripe.InvoiceLineItem
}
function subscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return { id: "sub_billing", object: "subscription", customer: customer.id,
    metadata: { plan: "foundry", addons_count: "2" }, status: "active",
    cancel_at_period_end: false, cancel_at: null, ended_at: null,
    items: { object: "list", data: [item("price_base"), item('price_addon', 2)], has_more: false, url: "/items" },
    ...overrides } as Stripe.Subscription
}
function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return { id: "in_billing", object: "invoice", customer: customer.id, subscription: "sub_billing",
    payment_intent: "pi_billing", status: "paid", amount_paid: 12_345, amount_due: 12_345,
    currency: "usd", billing_reason: "subscription_cycle", parent: null,
    period_start: paidAt, period_end: periodEnd,
    lines: { object: 'list', has_more: false, url: '/lines', data: [serviceLine(), serviceLine('price_addon', 2)] },
    status_transitions: { paid_at: paidAt, finalized_at: paidAt, marked_uncollectible_at: null, voided_at: null },
    hosted_invoice_url: "https://invoices.example.test/billing", invoice_pdf: null, ...overrides } as Invoice
}
function session(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return { id: "cs_billing", object: "checkout.session", customer: customer.id,
    subscription: "sub_billing", invoice: "in_billing", payment_status: "paid",
    metadata: { type: "subscription", plan: "untrusted", site_id: "untrusted" },
    ...overrides } as Stripe.Checkout.Session
}
function event(type: Stripe.Event.Type, object: Stripe.Event.Data.Object = invoice()): Stripe.Event {
  return { id: `evt_${randomUUID()}`, type, data: { object } } as Stripe.Event
}
function response<T>(data: T): Stripe.Response<T> {
  return Object.assign(data as T & object, { lastResponse: { headers: {}, requestId: "offline", statusCode: 200 } })
}

function harness() {
  const stripeTransport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(() => {
    throw new Error("Unexpected Stripe transport access")
  })
  const stripe = new Stripe(randomBytes(24).toString("hex"), {
    httpClient: Stripe.createFetchHttpClient(stripeTransport), maxNetworkRetries: 0,
  })
  const invoices = jest.spyOn(stripe.invoices, "retrieve").mockResolvedValue(response(invoice()))
  jest.spyOn(stripe.prices, 'retrieve').mockImplementation(async (id) => response(livePrice(id)))
  const subscriptions = jest.spyOn(stripe.subscriptions, "retrieve").mockResolvedValue(response(subscription()))
  const customers = jest.spyOn(stripe.customers, "retrieve").mockResolvedValue(response(customer))
  const sessions = jest.spyOn(stripe.checkout.sessions, "retrieve").mockResolvedValue(response(session()))
  const settled = { outcome: "settled", payment_id: paymentId, credits_granted: 110 }
  const settlementReplies: Response[] = []
  const syncReplies: Response[] = []
  const billingReplies: Response[] = []
  const transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async (url) => {
    const target = new URL(String(url))
    if (target.hostname !== "billing.example.test") throw new Error("Unexpected Supabase host")
    let body: unknown
    if (target.pathname.endsWith("/rpc/settle_stripe_subscription_invoice")) {
      if (settlementReplies.length) return settlementReplies.shift()!
      body = settled
    } else if (target.pathname.endsWith("/rpc/sync_stripe_subscription_state")) {
      if (syncReplies.length) return syncReplies.shift()!
      body = { outcome: 'synced', subscription_id: 'sub_billing' }
    } else if (target.pathname === "/rest/v1/billing") {
      if (billingReplies.length) return billingReplies.shift()!
      body = { stripe_customer_id: customer.id, stripe_subscription_id: 'sub_billing' }
    }
    else throw new Error("Unexpected Supabase operation")
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
  })
  const supabase = createClient("https://billing.example.test", randomBytes(24).toString("hex"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: transport },
  })
  const rpc = jest.spyOn(supabase, "rpc")
  const from = jest.spyOn(supabase, "from")
  const dispatch = (type: Stripe.Event.Type, object?: Stripe.Event.Data.Object) =>
    handleBillingStripeEvent({ stripe, supabase, event: event(type, object) })
  const settle = () => settleStripeSubscriptionInvoice({ stripe, supabase, invoiceId: "in_billing" })
  const checkout = () => handleCheckoutSessionCompleted({ stripe, supabase, event: event("checkout.session.completed", session()) })
  const inputs = () => rpc.mock.calls.filter(([name]) => name === "settle_stripe_subscription_invoice")
    .map(([, args]) => args?.p_invoice as StripeSubscriptionInvoiceInput)
  const enqueue = (queue: Response[]) => (data: unknown, status = 200) => queue.push(
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }))
  const reply = enqueue(settlementReplies)
  const syncReply = enqueue(syncReplies)
  const billingReply = enqueue(billingReplies)
  return { stripe, stripeTransport, supabase, invoices, subscriptions, customers, sessions,
    transport, rpc, from, dispatch, settle, checkout, inputs, reply, syncReply, billingReply, settled }
}

beforeEach(() => {
  for (const key of priceKeys) delete process.env[key]
  process.env.STRIPE_STARTER_PRICE_ID = 'price_engine'
  process.env.STRIPE_STARTUP_PRICE_ID = 'price_base'
  process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_enterprise'
  process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID = 'price_addon'
})
afterEach(() => {
  for (const key of priceKeys) {
    if (initialPrices[key] === undefined) delete process.env[key]
    else process.env[key] = initialPrices[key]
  }
  jest.restoreAllMocks()
})

describe("subscription invoice atomic settlement delegation", () => {
  it.each(["invoice.paid", "invoice.payment_succeeded"] as const)("%s sends the complete canonical RPC contract", async (type) => {
    const h = harness()
    const notification = event(type)
    await expect(handleBillingStripeEvent({ ...h, event: notification })).resolves.toBe(true)
    expect(h.rpc).toHaveBeenCalledTimes(2)
    expect(h.inputs()).toEqual([{ site_id: siteId, invoice_id: "in_billing", customer_id: customer.id,
      subscription_id: "sub_billing", current_subscription_status: "active", payment_intent_id: "pi_billing", status: "paid", amount: 123.45,
      currency: "USD", billing_reason: "subscription_cycle", plan: "foundry", addons_count: 2,
      billing_interval: 'month', coverage_verified: true,
      current_service: { plan: 'foundry', addons_count: 2, billing_interval: 'month' },
      paid_at: new Date(paidAt * 1000).toISOString(), invoice_url: "https://invoices.example.test/billing", event_id: notification.id,
      period_start: new Date(paidAt * 1000).toISOString(), period_end: new Date(periodEnd * 1000).toISOString() }])
    expect(h.invoices).toHaveBeenCalledWith("in_billing", { expand: ["payments"] })
    expect(h.subscriptions).toHaveBeenCalledWith("sub_billing")
    expect(h.customers).toHaveBeenCalledWith(customer.id)
    expect(h.from).toHaveBeenCalledWith('billing')
    expect(h.stripeTransport).not.toHaveBeenCalled()
  })

  it("delegates failed -> paid -> duplicate transitions to SQL with one invoice identity", async () => {
    const h = harness()
    h.invoices.mockResolvedValueOnce(response(invoice({ status: "open", amount_paid: 0 })))
    h.reply({ ...h.settled, outcome: "failed_recorded", credits_granted: 0 })
    await h.dispatch("invoice.payment_failed")
    await h.dispatch("invoice.payment_succeeded")
    h.reply({ ...h.settled, outcome: "duplicate", credits_granted: 0 })
    await h.dispatch("invoice.paid")
    expect(h.inputs().map((input) => [input.invoice_id, input.status, input.paid_at])).toEqual([
      ["in_billing", "failed", null], ["in_billing", "paid", new Date(paidAt * 1000).toISOString()],
      ["in_billing", "paid", new Date(paidAt * 1000).toISOString()],
    ])
    expect(h.inputs()[0].amount).toBe(123.45)
    expect(h.from).toHaveBeenCalledWith('billing')
    expect(h.rpc.mock.calls.map(([name]) => name)).toEqual(Array(3).fill(['sync_stripe_subscription_state', 'settle_stripe_subscription_invoice']).flat())
  })

  it("uses live paid status for a stale failed notification", async () => {
    const h = harness()
    await h.dispatch("invoice.payment_failed", invoice({ status: "open", customer: "cus_stale", subscription: "sub_stale" }))
    expect(h.inputs()[0]).toMatchObject({ status: "paid", customer_id: customer.id, subscription_id: "sub_billing" })
  })

  it.each(["settled", "duplicate", "failed_recorded", "ignored_failure"])("returns %s for reconciliation", async (outcome) => {
    const h = harness()
    h.reply({ ...h.settled, outcome, credits_granted: 0 })
    await expect(h.settle()).resolves.toEqual({ ...h.settled, outcome, credits_granted: 0 })
    expect(h.inputs()[0].event_id).toBeNull()
  })

  it.each([null, false, { success: false }, { outcome: "settled" },
    { outcome: "unexpected", payment_id: paymentId, credits_granted: 0 },
    { outcome: ["settled"], payment_id: paymentId, credits_granted: 0 },
    { outcome: "settled", payment_id: null, credits_granted: 0 },
    { outcome: "settled", payment_id: paymentId, credits_granted: -1 },
    { outcome: "settled", payment_id: paymentId, credits_granted: 1.5 },
    { outcome: "settled", payment_id: paymentId, credits_granted: 20, success: false },
  ])("rejects invalid RPC data %#", async (data) => {
    const h = harness()
    h.reply(data)
    await expect(h.settle()).rejects.toThrow("Invalid settle_stripe_subscription_invoice response")
  })

  it("propagates RPC errors and retries without app-side payment/credit writes", async () => {
    const h = harness()
    h.reply({ message: "settlement unavailable", code: "P0001" }, 400)
    await expect(h.settle()).rejects.toThrow("settlement unavailable")
    await expect(h.settle()).resolves.toEqual(h.settled)
    expect(h.inputs()).toHaveLength(2)
    expect(h.from).toHaveBeenCalledWith('billing')
  })

  it.each([NaN, -1, undefined])("rejects invalid live amounts %# before any RPC", async (amount) => {
    const h = harness()
    h.invoices.mockResolvedValue(response(invoice({ amount_paid: amount })))
    await expect(h.settle()).rejects.toThrow("Stripe minor amount")
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it("delegates zero-value paid invoices without synthesizing a payment intent", async () => {
    const h = harness()
    h.invoices.mockResolvedValue(response(invoice({ amount_paid: 0, payment_intent: null })))
    await h.settle()
    expect(h.inputs()[0]).toMatchObject({ status: "paid", amount: 0, payment_intent_id: null })
  })

  it("passes the verified live terminal status so stale billing cannot grant a paid allowance", async () => {
    const h = harness()
    h.subscriptions.mockResolvedValue(response(subscription({ status: "canceled" })))
    await h.settle()
    expect(h.inputs()[0]).toMatchObject({ current_subscription_status: "canceled", status: "paid" })
  })

  it('records a historical paid update without replacing current paid service', async () => {
    const h = harness()
    h.invoices.mockResolvedValue(response(invoice({ billing_reason: 'subscription_update',
      lines: { object: 'list', has_more: false, url: '/lines', data: [serviceLine('price_engine')] } })))
    await h.settle()
    expect(h.inputs()[0]).toMatchObject({ plan: 'engine', addons_count: 0, billing_interval: 'month', coverage_verified: true,
      current_service: { plan: 'foundry', addons_count: 2, billing_interval: 'month' } })
  })

  it.each(["subscription_create", "subscription_cycle", "subscription_update"] as const)("leaves %s grant policy in SQL", async (billing_reason) => {
    const h = harness()
    h.invoices.mockResolvedValue(response(invoice({ billing_reason, currency: "usd", amount_paid: 1200, payment_intent: null })))
    await h.settle()
    expect(h.inputs()[0]).toMatchObject({ billing_reason, currency: "USD", amount: 12, payment_intent_id: null, coverage_verified: true })
    expect(h.rpc).toHaveBeenCalledTimes(2)
  })
})

describe("trusted invoice identity and entitlements", () => {
  it("supports Basil expanded subscription and payment intent without stale legacy fallback", async () => {
    const h = harness()
    const basil = invoice({ subscription: undefined, payment_intent: undefined, customer,
      parent: { type: "subscription_details", quote_details: null,
        subscription_details: { subscription: subscription(), metadata: null } },
      payments: { object: "list", has_more: false, url: "/payments", data: [
        { is_default: true, payment: { type: "payment_intent", payment_intent: { id: "pi_basil" } } } as Stripe.InvoicePayment,
      ] } })
    h.invoices.mockResolvedValue(response(basil))
    await h.dispatch("invoice.paid", invoice({ subscription: "sub_stale", payment_intent: "pi_stale" }))
    expect(h.inputs()[0]).toMatchObject({ subscription_id: "sub_billing", payment_intent_id: "pi_basil", customer_id: customer.id })
  })

  it.each([
    { customer: null }, { subscription: null },
    { parent: { type: "subscription_details", quote_details: null,
      subscription_details: { subscription: "sub_conflict", metadata: null } } },
    { status_transitions: { paid_at: null, finalized_at: paidAt, marked_uncollectible_at: null, voided_at: null } },
  ] satisfies Partial<Invoice>[])("rejects missing/conflicting live invoice identity or paid timestamp %#", async (overrides) => {
    const h = harness()
    h.invoices.mockResolvedValue(response(invoice(overrides)))
    await expect(h.settle()).rejects.toThrow()
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it("does not revive missing live identity from event fields", async () => {
    const h = harness()
    h.invoices.mockResolvedValue(response(invoice({ subscription: undefined, parent: null })))
    await expect(h.dispatch("invoice.paid")).rejects.toThrow("Invoice subscription is missing")
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it.each(["missing_site", "deleted_customer", "missing_sub_customer", "customer_mismatch"])("rejects %s", async (kind) => {
    const h = harness()
    if (kind === "missing_site") h.customers.mockResolvedValue(response({ ...customer, metadata: {} }))
    if (kind === "deleted_customer") h.customers.mockResolvedValue(response({ id: customer.id, object: "customer", deleted: true }))
    if (kind === "missing_sub_customer") h.subscriptions.mockResolvedValue(response(subscription({ customer: "" })))
    if (kind === "customer_mismatch") h.subscriptions.mockResolvedValue(response(subscription({ customer: "cus_other" })))
    await expect(h.settle()).rejects.toThrow()
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it("ignores a live non-subscription invoice without event fallback", async () => {
    const h = harness()
    h.invoices.mockResolvedValue(response(invoice({ subscription: null, billing_reason: "manual" })))
    await expect(h.settle()).resolves.toBeNull()
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it.each(["invoice.paid", "invoice.payment_succeeded"] as const)("%s cannot settle an unpaid invoice", async (type) => {
    const h = harness()
    h.invoices.mockResolvedValue(response(invoice({ status: "open" })))
    await expect(h.dispatch(type)).rejects.toThrow("not paid")
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it.each([["startup", "foundry"], ["starter", "engine"], ["enterprise", "enterprise"]])("normalizes %s", async (raw, canonical) => {
    const h = harness()
    h.subscriptions.mockResolvedValue(response(subscription({ metadata: { plan: raw } })))
    await h.settle()
    expect(h.inputs()[0].plan).toBe('foundry')
    expect(normalizeBillingPlan(raw)).toBe(canonical)
  })

  it.each<Stripe.Metadata>([{}, { plan: "free" }, { plan: "unknown" }])("ignores unrecognized plan metadata in favor of verified prices %#", async (metadata) => {
    const h = harness()
    h.subscriptions.mockResolvedValue(response(subscription({ metadata })))
    await h.settle()
    expect(h.inputs()[0].plan).toBe('foundry')
    expect(normalizeBillingPlan(metadata.plan)).toBeNull()
  })

  it("maps unknown plan only with an unambiguous configured base price", async () => {
    const h = harness()
    delete process.env.STRIPE_STARTUP_PRICE_ID
    process.env.STRIPE_STARTER_PRICE_ID = "price_base"
    h.subscriptions.mockResolvedValue(response(subscription({ metadata: { plan: "unknown" } })))
    h.invoices.mockResolvedValue(response(invoice()))
    await h.settle()
    expect(h.inputs()[0].plan).toBe("engine")
    process.env.STRIPE_STARTUP_PRICE_ID = "price_base"
    await expect(h.settle()).rejects.toThrow("Ambiguous")
    expect(h.inputs()).toHaveLength(1)
  })

  it("uses configured price over stale canonical metadata from before a hosted update", async () => {
    const h = harness()
    delete process.env.STRIPE_STARTUP_PRICE_ID
    process.env.STRIPE_STARTER_PRICE_ID = "price_base"
    h.subscriptions.mockResolvedValue(response(subscription()))
    h.invoices.mockResolvedValue(response(invoice()))
    await h.settle()
    expect(h.inputs()[0].plan).toBe('engine')
  })

  it.each(["basil", "legacy"])("uses live %s invoice snapshot across a later plan change", async (shape) => {
    const h = harness()
    const metadata = { plan: "starter", addons_count: "1" }
    const lines = { object: 'list' as const, has_more: false, url: '/lines', data: [serviceLine('price_engine'), serviceLine('price_addon')] }
    h.invoices.mockResolvedValue(response(invoice(shape === "basil"
      ? { subscription: undefined, parent: { type: "subscription_details", quote_details: null,
        subscription_details: { subscription: "sub_billing", metadata } }, lines }
      : { subscription_details: { metadata }, lines })))
    await h.settle()
    expect(h.inputs()[0]).toMatchObject({ plan: "engine", addons_count: 1 })
    expect(h.subscriptions).toHaveBeenCalledWith("sub_billing")
  })

  it.each(["-1", "1.5", "2junk", "NaN", "101"])("rejects malformed add-ons %s", async (addons_count) => {
    const h = harness()
    h.invoices.mockResolvedValue(response(invoice({ lines: { object: 'list', has_more: false, url: '/lines',
      data: [serviceLine(), { ...serviceLine('price_addon'), quantity: addons_count as unknown as number }] } })))
    await expect(h.settle()).rejects.toThrow(/add-on count|service amount/)
    expect(h.rpc).not.toHaveBeenCalled()
  })
})

describe("current subscription sync and initial checkout", () => {
  it.each(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"] as const)("%s uses the latest subscription, base item end, and cancellation flag", async (type) => {
    const h = harness()
    process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID = "price_addon"
    h.subscriptions.mockResolvedValue(response(subscription({ customer, cancel_at_period_end: true,
      metadata: { plan: "starter", addons_count: "9" }, items: { object: "list", has_more: false, url: "/items",
        data: [item("price_addon", 3, periodEnd + 99), item("price_base")] } })))
    await h.dispatch(type, subscription({ metadata: { plan: "enterprise" } }))
    expect(h.rpc).toHaveBeenCalledWith("sync_stripe_subscription_state", { p_site_id: siteId,
      p_customer_id: customer.id, p_subscription_id: "sub_billing", p_expected_subscription_id: 'sub_billing', p_status: "active",
      p_current_period_end: new Date(periodEnd * 1000).toISOString(), p_start_date: null, p_end_date: null, p_auto_renew: false })
    expect(h.from).toHaveBeenCalledWith('billing')
  })

  it("preserves legacy top-level period end and does not auto-renew canceled subscriptions", async () => {
    const h = harness()
    h.subscriptions.mockResolvedValue(response(Object.assign(subscription({ status: "canceled" }), { current_period_end: paidAt })))
    await syncStripeSubscription({ ...h, subscriptionId: "sub_billing" })
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_auto_renew: false, p_status: 'canceled',
      p_current_period_end: new Date(paidAt * 1000).toISOString() })
    expect(h.transport.mock.calls.every(([, request]) => request?.method !== 'PATCH')).toBe(true)
  })

  it("resets removed add-ons to zero and preserves scheduled cancellation", async () => {
    const h = harness()
    process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID = "price_addon"
    h.subscriptions.mockResolvedValue(response(subscription({ cancel_at: periodEnd })))
    await syncStripeSubscription({ ...h, subscriptionId: "sub_billing" })
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_auto_renew: false })
    expect(h.from).toHaveBeenCalledWith('billing')
  })

  it.each([null, {}])("rejects a missing or unbound billing row %#", async (row) => {
    const h = harness()
    h.subscriptions.mockResolvedValue(response(subscription({ status: 'canceled' })))
    h.billingReply(row)
    await expect(syncStripeSubscription({ ...h, subscriptionId: "sub_billing" })).rejects.toThrow(/billing row is missing|billing customer does not match/)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it("propagates fenced sync failures so a webhook can retry", async () => {
    const h = harness()
    h.subscriptions.mockResolvedValue(response(subscription({ status: 'canceled' })))
    h.syncReply({ message: "state sync failed" }, 400)
    await expect(syncStripeSubscription({ ...h, subscriptionId: "sub_billing" })).rejects.toThrow("state sync failed")
  })

  it.each([null, false, {}, { success: false }])("checks fenced sync response %#", async (data) => {
    const h = harness()
    h.syncReply(data)
    await expect(syncStripeSubscription({ ...h, subscriptionId: "sub_billing" })).rejects.toThrow("Invalid sync_stripe_subscription_state response")
  })

  it("propagates subscription upsert transport errors", async () => {
    const h = harness()
    h.syncReply({ message: "billing unavailable" }, 400)
    await expect(h.dispatch("customer.subscription.updated", subscription())).rejects.toThrow("billing unavailable")
    expect(h.from).toHaveBeenCalledWith('billing')
  })

  it.each(["checkout_first", "invoice_first"])("%s delegates the same initial invoice without a session payment", async (order) => {
    const h = harness()
    h.invoices.mockResolvedValue(response(invoice({ billing_reason: "subscription_create" })))
    // Model SQL's first settlement and subsequent invoice-keyed duplicate response;
    // actual locking/ledger behavior is covered by the separate PostgreSQL suite.
    if (order === "invoice_first") h.reply(h.settled)
    if (order === "checkout_first") h.reply(h.settled)
    h.reply({ ...h.settled, outcome: "duplicate", credits_granted: 0 })
    if (order === "invoice_first") await h.dispatch("invoice.paid")
    await h.checkout()
    if (order === "checkout_first") await h.dispatch("invoice.payment_succeeded")
    expect(h.inputs()).toHaveLength(2)
    expect(h.inputs().every((input) => input.invoice_id === "in_billing" && input.site_id === siteId && input.plan === "foundry")).toBe(true)
    expect(h.from).toHaveBeenCalledWith('billing')
    expect(h.rpc.mock.calls.map(([name]) => name).filter((name) => name !== "settle_stripe_subscription_invoice")).toEqual(Array(2).fill('sync_stripe_subscription_state'))
    expect(h.sessions).toHaveBeenCalledWith("cs_billing")
  })

  it.each([{ payment_status: "unpaid" }, { invoice: null }, { subscription: null }, { customer: null }] satisfies Partial<Stripe.Checkout.Session>[])("rejects unpaid or unidentified checkout %#", async (overrides) => {
    const h = harness()
    h.sessions.mockResolvedValue(response(session(overrides)))
    await expect(h.checkout()).rejects.toThrow()
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it("rejects a checkout invoice bound to another subscription", async () => {
    const h = harness()
    h.invoices.mockResolvedValue(response(invoice({ subscription: "sub_other" })))
    await expect(h.checkout()).rejects.toThrow("Invoice subscription does not match")
    expect(h.inputs()).toHaveLength(0)
  })

  it("propagates an invoice failure after checkout sync and retries the same invoice", async () => {
    const h = harness()
    h.reply({ message: "retry settlement" }, 400)
    await expect(h.checkout()).rejects.toThrow("retry settlement")
    await h.checkout()
    expect(h.inputs().map((input) => input.invoice_id)).toEqual(["in_billing", "in_billing"])
    expect(h.from).toHaveBeenCalledWith('billing')
  })
})