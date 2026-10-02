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
const periodEnd = 1_793_500_000
const customer: Stripe.Customer = {
  id: "cus_billing", object: "customer", metadata: { site_id: siteId }, balance: 0,
  created: paidAt, default_source: null, description: null, email: null,
  invoice_prefix: "OFFLINE", invoice_settings: { custom_fields: null, default_payment_method: null,
    footer: null, rendering_options: null }, livemode: false, shipping: null,
}
const priceKeys = ["STRIPE_STARTER_PRICE_ID", "STRIPE_STARTUP_PRICE_ID",
  "STRIPE_ENTERPRISE_PRICE_ID", "STRIPE_ACCOUNT_ADDON_PRICE_ID"] as const
const initialPrices = Object.fromEntries(priceKeys.map((key) => [key, process.env[key]]))

// Only the fields read by these handlers are populated; method mocks retain SDK types.
function item(price: string, quantity = 1, end = periodEnd): Stripe.SubscriptionItem {
  return { id: `si_${price}`, price: { id: price }, quantity, current_period_end: end } as Stripe.SubscriptionItem
}
function subscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return { id: "sub_billing", object: "subscription", customer: customer.id,
    metadata: { plan: "foundry", addons_count: "2" }, status: "active",
    cancel_at_period_end: false, cancel_at: null, ended_at: null,
    items: { object: "list", data: [item("price_base")], has_more: false, url: "/items" },
    ...overrides } as Stripe.Subscription
}
function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return { id: "in_billing", object: "invoice", customer: customer.id, subscription: "sub_billing",
    payment_intent: "pi_billing", status: "paid", amount_paid: 12_345, amount_due: 12_345,
    currency: "usd", billing_reason: "subscription_cycle", parent: null,
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
  const subscriptions = jest.spyOn(stripe.subscriptions, "retrieve").mockResolvedValue(response(subscription()))
  const customers = jest.spyOn(stripe.customers, "retrieve").mockResolvedValue(response(customer))
  const sessions = jest.spyOn(stripe.checkout.sessions, "retrieve").mockResolvedValue(response(session()))
  const settled = { outcome: "settled", payment_id: paymentId, credits_granted: 110 }
  const transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async (url) => {
    const target = new URL(String(url))
    if (target.hostname !== "billing.example.test") throw new Error("Unexpected Supabase host")
    let body: unknown
    if (target.pathname.endsWith("/rpc/settle_stripe_subscription_invoice")) body = settled
    else if (target.pathname.endsWith("/rpc/upsert_billing")) body = { success: true }
    else if (target.pathname === "/rest/v1/billing") body = { id: randomUUID() }
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
  const reply = (data: unknown, status = 200) => transport.mockResolvedValueOnce(
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }),
  )
  return { stripe, stripeTransport, supabase, invoices, subscriptions, customers, sessions,
    transport, rpc, from, dispatch, settle, checkout, inputs, reply, settled }
}

beforeEach(() => { for (const key of priceKeys) delete process.env[key] })
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
    expect(h.rpc).toHaveBeenCalledTimes(1)
    expect(h.inputs()).toEqual([{ site_id: siteId, invoice_id: "in_billing", customer_id: customer.id,
      subscription_id: "sub_billing", payment_intent_id: "pi_billing", status: "paid", amount: 123.45,
      currency: "USD", billing_reason: "subscription_cycle", plan: "foundry", addons_count: 2,
      paid_at: new Date(paidAt * 1000).toISOString(), invoice_url: "https://invoices.example.test/billing", event_id: notification.id }])
    expect(h.invoices).toHaveBeenCalledWith("in_billing", { expand: ["payments"] })
    expect(h.subscriptions).toHaveBeenCalledWith("sub_billing")
    expect(h.customers).toHaveBeenCalledWith(customer.id)
    expect(h.from).not.toHaveBeenCalled()
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
    expect(h.from).not.toHaveBeenCalled()
    expect(h.rpc.mock.calls.every(([name]) => name === "settle_stripe_subscription_invoice")).toBe(true)
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
    expect(h.from).not.toHaveBeenCalled()
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

  it.each(["subscription_create", "subscription_cycle", "subscription_update"] as const)("leaves %s grant policy in SQL", async (billing_reason) => {
    const h = harness()
    h.invoices.mockResolvedValue(response(invoice({ billing_reason, currency: "jpy", amount_paid: 1200, payment_intent: null })))
    await h.settle()
    expect(h.inputs()[0]).toMatchObject({ billing_reason, currency: "JPY", amount: 1200, payment_intent_id: null })
    expect(h.rpc).toHaveBeenCalledTimes(1)
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
    expect(h.inputs()[0].plan).toBe(canonical)
    expect(normalizeBillingPlan(raw)).toBe(canonical)
  })

  it.each<Stripe.Metadata>([{}, { plan: "free" }, { plan: "unknown" }])("rejects unrecognized plan metadata %#", async (metadata) => {
    const h = harness()
    h.subscriptions.mockResolvedValue(response(subscription({ metadata })))
    await expect(h.settle()).rejects.toThrow("Missing or unknown subscription plan")
    expect(h.rpc).not.toHaveBeenCalled()
    expect(normalizeBillingPlan(metadata.plan)).toBeNull()
  })

  it("maps unknown plan only with an unambiguous configured base price", async () => {
    const h = harness()
    process.env.STRIPE_STARTER_PRICE_ID = "price_base"
    h.subscriptions.mockResolvedValue(response(subscription({ metadata: { plan: "unknown" } })))
    await h.settle()
    expect(h.inputs()[0].plan).toBe("engine")
    process.env.STRIPE_STARTUP_PRICE_ID = "price_base"
    await expect(h.settle()).rejects.toThrow("Ambiguous")
    expect(h.inputs()).toHaveLength(1)
  })

  it("rejects canonical metadata conflicting with a configured base price", async () => {
    const h = harness()
    process.env.STRIPE_STARTER_PRICE_ID = "price_base"
    await expect(h.settle()).rejects.toThrow("does not match configured price")
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it.each(["basil", "legacy"])("uses live %s invoice snapshot across a later plan change", async (shape) => {
    const h = harness()
    const metadata = { plan: "starter", addons_count: "1" }
    h.invoices.mockResolvedValue(response(invoice(shape === "basil"
      ? { subscription: undefined, parent: { type: "subscription_details", quote_details: null,
        subscription_details: { subscription: "sub_billing", metadata } } }
      : { subscription_details: { metadata } })))
    await h.settle()
    expect(h.inputs()[0]).toMatchObject({ plan: "engine", addons_count: 1 })
    expect(h.subscriptions).toHaveBeenCalledWith("sub_billing")
  })

  it.each(["-1", "1.5", "2junk", "NaN", "101"])("rejects malformed add-ons %s", async (addons_count) => {
    const h = harness()
    h.subscriptions.mockResolvedValue(response(subscription({ metadata: { plan: "engine", addons_count } })))
    await expect(h.settle()).rejects.toThrow("add-on count")
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
    expect(h.rpc).toHaveBeenCalledWith("upsert_billing", { p_site_id: siteId, p_plan: "engine",
      p_stripe_customer_id: customer.id, p_stripe_subscription_id: "sub_billing", p_subscription_status: "active",
      p_subscription_current_period_end: new Date(periodEnd * 1000).toISOString(), p_auto_renew: false })
    expect(h.transport.mock.calls[1][1]?.body).toBe(JSON.stringify({ addons_count: 3 }))
  })

  it("preserves legacy top-level period end and does not auto-renew canceled subscriptions", async () => {
    const h = harness()
    h.subscriptions.mockResolvedValue(response(Object.assign(subscription({ status: "canceled" }), { current_period_end: paidAt })))
    await syncStripeSubscription({ ...h, subscriptionId: "sub_billing" })
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_auto_renew: false,
      p_subscription_current_period_end: new Date(paidAt * 1000).toISOString() })
  })

  it("resets removed add-ons to zero and preserves scheduled cancellation", async () => {
    const h = harness()
    process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID = "price_addon"
    h.subscriptions.mockResolvedValue(response(subscription({ cancel_at: periodEnd })))
    await syncStripeSubscription({ ...h, subscriptionId: "sub_billing" })
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_auto_renew: false })
    expect(h.transport.mock.calls[1][1]?.body).toBe(JSON.stringify({ addons_count: 0 }))
    expect(String(h.transport.mock.calls[1][0])).toContain(`site_id=eq.${siteId}`)
  })

  it.each([null, {}])("rejects a missing billing row after upsert %#", async (row) => {
    const h = harness()
    h.reply({ success: true })
    h.reply(row)
    await expect(syncStripeSubscription({ ...h, subscriptionId: "sub_billing" })).rejects.toThrow("billing row is missing")
  })

  it("propagates add-on update failures so a webhook can retry", async () => {
    const h = harness()
    h.reply({ success: true })
    h.reply({ message: "add-on write failed" }, 400)
    await expect(syncStripeSubscription({ ...h, subscriptionId: "sub_billing" })).rejects.toThrow("add-on write failed")
  })

  it.each([null, false, {}, { success: false }])("checks upsert_billing rejection %# before add-on writes", async (data) => {
    const h = harness()
    h.reply(data)
    await expect(syncStripeSubscription({ ...h, subscriptionId: "sub_billing" })).rejects.toThrow("rejected")
    expect(h.from).not.toHaveBeenCalled()
  })

  it("propagates subscription upsert transport errors", async () => {
    const h = harness()
    h.reply({ message: "billing unavailable" }, 400)
    await expect(h.dispatch("customer.subscription.updated", subscription())).rejects.toThrow("billing unavailable")
    expect(h.from).not.toHaveBeenCalled()
  })

  it.each(["checkout_first", "invoice_first"])("%s delegates the same initial invoice without a session payment", async (order) => {
    const h = harness()
    h.invoices.mockResolvedValue(response(invoice({ billing_reason: "subscription_create" })))
    // Model SQL's first settlement and subsequent invoice-keyed duplicate response;
    // actual locking/ledger behavior is covered by the separate PostgreSQL suite.
    if (order === "invoice_first") h.reply(h.settled)
    h.reply({ success: true })
    h.reply({ id: randomUUID() })
    if (order === "checkout_first") h.reply(h.settled)
    h.reply({ ...h.settled, outcome: "duplicate", credits_granted: 0 })
    if (order === "invoice_first") await h.dispatch("invoice.paid")
    await h.checkout()
    if (order === "checkout_first") await h.dispatch("invoice.payment_succeeded")
    expect(h.inputs()).toHaveLength(2)
    expect(h.inputs().every((input) => input.invoice_id === "in_billing" && input.site_id === siteId && input.plan === "foundry")).toBe(true)
    expect(h.from.mock.calls).toEqual([["billing"]])
    expect(h.rpc.mock.calls.map(([name]) => name).filter((name) => name !== "settle_stripe_subscription_invoice")).toEqual(["upsert_billing"])
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
    h.reply({ success: true })
    h.reply({ id: randomUUID() })
    h.reply({ message: "retry settlement" }, 400)
    await expect(h.checkout()).rejects.toThrow("retry settlement")
    await h.checkout()
    expect(h.inputs().map((input) => input.invoice_id)).toEqual(["in_billing", "in_billing"])
    expect(h.from.mock.calls).toEqual([["billing"], ["billing"]])
  })
})