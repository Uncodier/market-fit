/** @jest-environment node */
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { fulfillLinkedOrderAfterPayment } from "@/app/commerce/order-fulfillment-sync"
import { tryUpsertPolizaForSale } from "@/app/accounting/ensure"
import { registerSubscriptionPayment } from "@/app/subscriptions/register-payment"

jest.mock("server-only", () => ({}))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/accounting/ensure", () => ({ tryUpsertPolizaForSale: jest.fn() }))
jest.mock("@/app/commerce/order-fulfillment-sync", () => ({
  ...jest.requireActual("@/app/commerce/order-fulfillment-sync"),
  fulfillLinkedOrderAfterPayment: jest.fn(),
}))

const siteId = "11111111-1111-4111-8111-111111111111"
const subscriptionId = "22222222-2222-4222-8222-222222222222"
const invoiceId = "33333333-3333-4333-8333-333333333333"
const requestId = "44444444-4444-4444-8444-444444444444"
const input = { siteId, subscriptionId, invoiceId, requestId, amount: 25, method: "cash", notes: "Deposit" }

function harness() {
  const invoice = {
    id: invoiceId, status: "pending", amount_due: "125", payments: [{ id: "previous", amount: 10 }],
    updated_at: "2026-10-01T12:00:00Z", accounting_state: "posted", lead_id: "lead", user_id: "user",
  }
  const subscription = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: subscriptionId }, error: null }),
  }
  const sales = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValueOnce({ data: invoice, error: null })
      .mockResolvedValue({ data: { id: invoiceId, accounting_state: "posted" }, error: null }),
  }
  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "actor" } }, error: null }) },
    rpc: jest.fn().mockResolvedValue({ data: "collaborator", error: null }),
    from: jest.fn((table: string) => {
      if (table === "subscriptions") return subscription
      if (table === "sales") return sales
      throw new Error(`Unexpected table ${table}`)
    }),
  }
  jest.mocked(createClient).mockResolvedValue(client)
  return { invoice, subscription, sales, client }
}

describe("register subscription invoice payment", () => {
  beforeEach(() => jest.clearAllMocks())

  it("appends a payment and computes the outstanding balance from server-owned data", async () => {
    const h = harness()
    expect(await registerSubscriptionPayment(input)).toEqual({ success: true })
    expect(createClient).toHaveBeenCalledWith(true)
    expect(h.client.rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: siteId })
    expect(h.subscription.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(h.subscription.eq).toHaveBeenCalledWith("id", subscriptionId)
    expect(h.sales.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(h.sales.eq).toHaveBeenCalledWith("subscription_id", subscriptionId)
    expect(h.sales.eq).toHaveBeenCalledWith("id", invoiceId)
    expect(h.sales.eq).toHaveBeenCalledWith("updated_at", h.invoice.updated_at)
    expect(h.sales.eq).toHaveBeenCalledWith("amount_due", "125")
    expect(h.sales.update).toHaveBeenCalledWith(expect.objectContaining({
      amount_due: 100, status: "pending", payment_method: "cash", accounting_state: "pending",
      payments: [h.invoice.payments[0], expect.objectContaining({
        id: `subscription-payment-${requestId}`, amount: 25, method: "cash", notes: "Deposit",
      })],
    }))
    expect(fulfillLinkedOrderAfterPayment).not.toHaveBeenCalled()
    expect(tryUpsertPolizaForSale).toHaveBeenCalledWith(invoiceId, siteId)
    expect(revalidatePath).toHaveBeenCalledWith(`/subscriptions/${subscriptionId}`)
  })

  it("completes a fully paid invoice and preserves unpublished accounting", async () => {
    const h = harness()
    h.invoice.accounting_state = "unpublished"
    expect(await registerSubscriptionPayment({ ...input, amount: 125 })).toEqual({ success: true })
    expect(h.sales.update).toHaveBeenCalledWith(expect.objectContaining({
      amount_due: 0, status: "completed", accounting_state: "unpublished",
    }))
    expect(fulfillLinkedOrderAfterPayment).toHaveBeenCalledWith(expect.objectContaining({
      supabase: h.client, siteId, saleId: invoiceId, leadId: "lead", userId: "user",
    }))
  })

  it("uses cent arithmetic for decimal payments", async () => {
    const h = harness()
    h.invoice.amount_due = "0.30"
    await registerSubscriptionPayment({ ...input, amount: 0.1 })
    expect(h.sales.update).toHaveBeenCalledWith(expect.objectContaining({ amount_due: 0.2 }))
  })

  it.each([
    { amount: 0 }, { amount: -5 }, { amount: Infinity }, { amount: NaN }, { amount: 0.001 },
    { siteId: "bad" }, { subscriptionId: "bad" }, { invoiceId: "bad" }, { requestId: "bad" },
    { method: "forged" }, { notes: "a".repeat(2001) },
  ])("rejects malformed details before accessing the database: %p", async (values) => {
    expect(await registerSubscriptionPayment({ ...input, ...values })).toEqual({ error: "Enter valid payment details" })
    expect(createClient).not.toHaveBeenCalled()
  })

  it.each(["anonymous", "foreign-site", "marketing"])("denies %s requests before accessing invoices", async (kind) => {
    const h = harness()
    if (kind === "anonymous") h.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    else h.client.rpc.mockResolvedValue({ data: kind === "marketing" ? "marketing" : null, error: null })
    expect(await registerSubscriptionPayment(input)).toEqual({ error: "Not authorized to register payments in this site" })
    expect(h.client.from).not.toHaveBeenCalled()
  })

  it("does not load invoices for a missing or foreign subscription", async () => {
    const h = harness()
    h.subscription.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await registerSubscriptionPayment(input)).toEqual({ error: "Subscription not found" })
    expect(h.client.from).not.toHaveBeenCalledWith("sales")
  })

  it("rejects invoices not linked to the scoped subscription", async () => {
    const h = harness()
    h.sales.maybeSingle.mockReset().mockResolvedValue({ data: null, error: null })
    expect(await registerSubscriptionPayment(input)).toEqual({ error: "Invoice not found for this subscription" })
    expect(h.sales.update).not.toHaveBeenCalled()
  })

  it.each(["cancelled", "refunded"])("never accepts payments for %s invoices", async (status) => {
    const h = harness()
    h.invoice.status = status
    expect(await registerSubscriptionPayment(input)).toEqual({ error: "This invoice has no outstanding balance" })
    expect(h.sales.update).not.toHaveBeenCalled()
  })

  it("rejects paid invoices and overpayment against the current balance", async () => {
    const h = harness()
    h.invoice.amount_due = "20"
    expect(await registerSubscriptionPayment(input)).toEqual({ error: "Payment amount cannot exceed the amount due" })
    expect(h.sales.update).not.toHaveBeenCalled()
    const paid = harness()
    paid.invoice.amount_due = "0"
    expect(await registerSubscriptionPayment(input)).toEqual({ error: "This invoice has no outstanding balance" })
  })

  it("returns success for an identical retry without recording it again", async () => {
    const h = harness()
    Object.assign(h.invoice, { status: "completed", amount_due: 0,
      payments: [{ id: `subscription-payment-${requestId}`, amount: 25, method: "cash", notes: "Deposit" }] })
    expect(await registerSubscriptionPayment(input)).toEqual({ success: true })
    expect(h.sales.update).not.toHaveBeenCalled()
    expect(await registerSubscriptionPayment({ ...input, amount: 50 })).toHaveProperty("error")
  })

  it("detects a concurrent invoice change without silently overwriting another payment", async () => {
    const h = harness()
    h.sales.maybeSingle.mockReset().mockResolvedValueOnce({ data: h.invoice, error: null })
      .mockResolvedValue({ data: null, error: null })
    expect(await registerSubscriptionPayment(input)).toEqual({ error: "Invoice changed while registering the payment. Reload and retry." })
    expect(fulfillLinkedOrderAfterPayment).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("does not return raw database errors or report a failed write as successful", async () => {
    const h = harness()
    h.sales.maybeSingle.mockReset().mockResolvedValueOnce({ data: h.invoice, error: null })
      .mockResolvedValue({ data: null, error: { message: "private schema details" } })
    expect(await registerSubscriptionPayment(input)).toEqual({ error: "Unable to confirm payment. Retry with the same details.", uncertain: true })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("reports secondary recovery separately without prompting another payment", async () => {
    harness()
    jest.mocked(tryUpsertPolizaForSale).mockRejectedValueOnce(new Error("Accounting unavailable"))
    expect(await registerSubscriptionPayment(input)).toEqual({
      success: true, warning: "Payment saved, but accounting synchronization needs review.",
    })
    expect(revalidatePath).toHaveBeenCalledWith(`/sales/${invoiceId}`)
  })

  it("warns when the accounting helper resolves but leaves the invoice pending review", async () => {
    const h = harness()
    h.sales.maybeSingle.mockReset().mockResolvedValueOnce({ data: h.invoice, error: null })
      .mockResolvedValueOnce({ data: { id: invoiceId }, error: null })
      .mockResolvedValue({ data: { accounting_state: "pending" }, error: null })
    expect(await registerSubscriptionPayment(input)).toEqual({
      success: true, warning: "Payment saved, but accounting synchronization needs review.",
    })
  })

  it("recovers post-payment work for an identical full-payment retry without another receipt", async () => {
    const h = harness()
    Object.assign(h.invoice, { status: "completed", amount_due: 0,
      payments: [{ id: `subscription-payment-${requestId}`, amount: 25, method: "cash", notes: "Deposit" }] })
    expect(await registerSubscriptionPayment(input)).toEqual({ success: true })
    expect(h.sales.update).not.toHaveBeenCalled()
    expect(fulfillLinkedOrderAfterPayment).toHaveBeenCalledWith(expect.objectContaining({ saleId: invoiceId, siteId }))
    expect(tryUpsertPolizaForSale).toHaveBeenCalledWith(invoiceId, siteId)
    expect(revalidatePath).toHaveBeenCalledWith(`/subscriptions/${subscriptionId}`)
  })
})