/** @jest-environment node */
import type Stripe from "stripe"
import { stripeInvoiceCreditPeriod } from "@/app/api/stripe/webhook/subscription-invoice-period"
import { resolveStripeSubscriptionDetails } from "@/app/api/stripe/webhook/subscription-billing"

const start = 1_790_900_000
const end = start + 2_592_000
const originalAddon = process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID
const result = { period_start: new Date(start * 1000).toISOString(), period_end: new Date(end * 1000).toISOString() }

function line(price: string, overrides = {}): Stripe.InvoiceLineItem {
  return { id: "il_period", subscription: "sub_period", period: { start, end },
    pricing: { price_details: { price } },
    parent: { subscription_item_details: { subscription: "sub_period", proration: false } },
    ...overrides } as Stripe.InvoiceLineItem
}
function invoice(lines: Stripe.InvoiceLineItem[] = [], overrides = {}): Stripe.Invoice {
  return { billing_reason: "subscription_cycle", period_start: start - 500, period_end: start,
    lines: { data: lines, has_more: false }, ...overrides } as Stripe.Invoice
}
afterEach(() => {
  if (originalAddon === undefined) delete process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID
  else process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID = originalAddon
})

describe("monthly entitlement invoice periods", () => {
  it("uses the live base subscription line, excluding an add-on with different dates", () => {
    process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID = "price_addon"
    expect(stripeInvoiceCreditPeriod(invoice([
      line("price_addon", { period: { start: start - 50, end: end + 50 } }), line("price_base"),
    ]), "sub_period")).toEqual(result)
  })
  it("supports the legacy subscription line shape", () => {
    expect(stripeInvoiceCreditPeriod(invoice([
      line("price_base", { pricing: null, parent: null, type: "subscription", proration: false, price: { id: "price_base" } }),
    ]), "sub_period")).toEqual(result)
  })
  it("does not use invoice creation bounds when a line period is available", () => {
    expect(stripeInvoiceCreditPeriod(invoice([line("price_base")]), "sub_period")).toEqual(result)
  })
  it("accepts historical invoice bounds only when the entire line list is absent", () => {
    expect(stripeInvoiceCreditPeriod(invoice([], { lines: undefined, period_start: start, period_end: end }), "sub_period")).toEqual(result)
  })
  it.each([
    invoice([line("price_base"), line("price_other")]),
    invoice([line("price_base")], { lines: { data: [line("price_base")], has_more: true } }),
    invoice([line("price_base", { period: { start, end: start } })]),
    invoice([line("price_base", { period: { start: NaN, end } })]),
    invoice([line("price_base", { parent: null, subscription: "sub_other" })]),
    invoice([line("price_base", { parent: { subscription_item_details: { subscription: "sub_period", proration: true } } })]),
  ])("fails closed on ambiguous, invalid, or incomplete monthly periods %#", (value) => {
    expect(() => stripeInvoiceCreditPeriod(value, "sub_period")).toThrow()
  })
  it("proration invoices have no monthly reset period", () => {
    expect(stripeInvoiceCreditPeriod(invoice([line("price_base")], { billing_reason: "subscription_update" }), "sub_period"))
      .toEqual({ period_start: null, period_end: null })
  })
})

describe("canceled subscriptions without surviving paid metadata", () => {
  it.each(["canceled", "cancelled", "incomplete_expired"])("allows %s fallback without paid metadata or add-ons", (status) => {
    const value = { status, metadata: {}, items: { data: [], has_more: false } } as unknown as Stripe.Subscription
    expect(resolveStripeSubscriptionDetails(value)).toEqual({ plan: null, addonsCount: 0, billingInterval: null, currentPeriodEnd: null })
  })
  it("active subscriptions still fail closed on a missing paid plan", () => {
    const value = { status: "active", metadata: {}, items: { data: [] } } as unknown as Stripe.Subscription
    expect(() => resolveStripeSubscriptionDetails(value)).toThrow("unknown subscription plan")
  })
})