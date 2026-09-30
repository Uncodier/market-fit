/** @jest-environment node */
import { recordStripeAccountingRefunds } from "@/app/commerce/stripe-accounting-refunds"
import { handleBillingStripeEvent } from "@/app/api/stripe/webhook/billing-event-handlers"
import { postSaleJournalWithClient } from "@/app/accounting/source-posting"
import { revokeOrderFulfillment } from "@/app/commerce/order-fulfillment-sync"

jest.mock("server-only", () => ({}))
jest.mock("@/app/accounting/source-posting", () => ({ postSaleJournalWithClient: jest.fn() }))
jest.mock("@/app/commerce/order-fulfillment-sync", () => ({ revokeOrderFulfillment: jest.fn() }))

const saleId = "00000000-0000-4000-8000-000000000001"
const siteId = "00000000-0000-4000-8000-000000000002"
const charge = {
  id: "ch_1", payment_intent: "pi_1", amount: 10000, amount_refunded: 3000,
  currency: "usd", refunded: false,
} as any
const refund = (id = "re_1", overrides = {}) => ({
  id, charge: "ch_1", payment_intent: "pi_1", currency: "usd", amount: 3000,
  created: 1788220800, status: "succeeded", ...overrides,
})

function setup(overrides = {}) {
  const sale = { id: saleId, site_id: siteId, status: "completed", currency: "USD", ...overrides }
  const sales: any = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: sale }),
  }
  const orders: any = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: "order-1" } }),
  }
  const supabase = {
    from: jest.fn((table) => table === "sales" ? sales : orders),
    rpc: jest.fn().mockResolvedValue({ error: null }),
  } as any
  const stripe = { refunds: { list: jest.fn().mockResolvedValue({ data: [refund()], has_more: false }) },
    charges: { retrieve: jest.fn().mockResolvedValue(charge) } } as any
  const event = (type: string, object = charge) => ({ type, data: { object } }) as any
  return { supabase, stripe, sales, orders, event }
}

describe("Stripe accounting refunds", () => {
  beforeEach(() => jest.resetAllMocks())

  it("records partial refunds as exact dated amounts using the signature-authorized client", async () => {
    const { supabase, stripe, event } = setup()
    await handleBillingStripeEvent({ supabase, stripe, event: event("charge.refunded") })
    expect(stripe.refunds.list).toHaveBeenCalledWith({ charge: "ch_1", limit: 100 })
    expect(supabase.rpc).toHaveBeenCalledWith("accounting_record_sale_refund", {
      p_sale_id: saleId, p_refund_id: "re_1", p_amount: 30, p_currency: "USD",
      p_refunded_at: "2026-09-01T00:00:00.000Z",
    })
    expect(postSaleJournalWithClient).toHaveBeenCalledWith(supabase, saleId, siteId)
    expect(revokeOrderFulfillment).not.toHaveBeenCalled()
  })

  it("reads every page, excludes failed/pending refunds, and retains each successful date", async () => {
    const { supabase, stripe } = setup()
    stripe.refunds.list
      .mockResolvedValueOnce({ data: [refund("re_2", { created: 1788307200 }), refund("re_failed", { status: "failed" })], has_more: true })
      .mockResolvedValueOnce({ data: [refund("re_1"), refund("re_pending", { status: "pending" })], has_more: false })
    await recordStripeAccountingRefunds(supabase, stripe, charge)
    expect(stripe.refunds.list).toHaveBeenNthCalledWith(2, { charge: "ch_1", limit: 100, starting_after: "re_failed" })
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
    expect(supabase.rpc).toHaveBeenNthCalledWith(1, "accounting_record_sale_refund", expect.objectContaining({
      p_refund_id: "re_1", p_refunded_at: "2026-09-01T00:00:00.000Z",
    }))
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "accounting_record_sale_refund", expect.objectContaining({
      p_refund_id: "re_2", p_refunded_at: "2026-09-02T00:00:00.000Z",
    }))
  })

  it.each(["refunded", "cancelled"])("reconciles full refund replays for %s sales", async (status) => {
    const { supabase, stripe, sales, event } = setup({ status })
    stripe.refunds.list.mockResolvedValue({ data: [refund('re_full', { amount: 10000 })], has_more: false })
    const params = { supabase, stripe, event: event("charge.refunded", { ...charge, refunded: true }) }
    await handleBillingStripeEvent(params)
    await handleBillingStripeEvent(params)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
    expect(supabase.rpc.mock.calls[0]).toEqual(supabase.rpc.mock.calls[1])
    expect(postSaleJournalWithClient).toHaveBeenCalledTimes(2)
    expect(sales.update).not.toHaveBeenCalled()
    expect(revokeOrderFulfillment).toHaveBeenCalledTimes(2)
  })

  it("does not create a cash refund for disputes", async () => {
    const { supabase, stripe, sales, event } = setup()
    await handleBillingStripeEvent({ supabase, stripe, event: event("charge.dispute.created") })
    expect(revokeOrderFulfillment).toHaveBeenCalledTimes(1)
    expect(stripe.refunds.list).not.toHaveBeenCalled()
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(sales.update).not.toHaveBeenCalled()
    expect(postSaleJournalWithClient).not.toHaveBeenCalled()
  })

  it("does not manufacture cash receipts by clearing amount due on full refunds", async () => {
    const { supabase, stripe, sales, event } = setup()
    stripe.refunds.list.mockResolvedValue({ data: [refund('re_full', { amount: 10000 })], has_more: false })
    await handleBillingStripeEvent({ supabase, stripe, event: event("charge.refunded", { ...charge, refunded: true }) })
    expect(sales.update).toHaveBeenCalledWith({ status: "refunded", accounting_state: "pending", updated_at: expect.any(String) })
    expect(sales.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(postSaleJournalWithClient).toHaveBeenCalledTimes(1)
  })

  it('processes a pending refund that succeeds later and tolerates reordered notifications', async () => {
    const { supabase, stripe, event } = setup()
    stripe.refunds.list.mockResolvedValueOnce({ data: [refund('re_1', { status: 'pending' })], has_more: false })
    await handleBillingStripeEvent({ supabase, stripe, event: event('refund.created', refund('re_1', { status: 'pending' })) })
    expect(supabase.rpc).not.toHaveBeenCalled()
    await handleBillingStripeEvent({ supabase, stripe, event: event('refund.updated', refund()) })
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(postSaleJournalWithClient).toHaveBeenCalledTimes(1)
    await handleBillingStripeEvent({ supabase, stripe, event: event('refund.created', refund('re_1', { status: 'pending' })) })
    expect(supabase.rpc.mock.calls[0]).toEqual(supabase.rpc.mock.calls[1])
  })

  it('does not revoke fulfillment for a pending full refund', async () => {
    const { supabase, stripe, event } = setup()
    stripe.refunds.list.mockResolvedValue({ data: [refund('re_full', { status: 'pending', amount: 10000 })], has_more: false })
    await handleBillingStripeEvent({ supabase, stripe, event: event('charge.refunded', { ...charge, refunded: true }) })
    expect(revokeOrderFulfillment).not.toHaveBeenCalled()
    expect(postSaleJournalWithClient).not.toHaveBeenCalled()
  })

  it('handles failed status notifications without posting a nonexistent cash refund', async () => {
    const { supabase, stripe, event } = setup()
    stripe.refunds.list.mockResolvedValue({ data: [refund('re_failed', { status: 'failed' })], has_more: false })
    expect(await handleBillingStripeEvent({ supabase, stripe, event: event('refund.failed', refund('re_failed', { status: 'failed' })) })).toBe(true)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("retries an idempotent refund receipt when journal replacement fails", async () => {
    const { supabase, stripe } = setup()
    jest.mocked(postSaleJournalWithClient).mockRejectedValueOnce(new Error("Posting failed"))
    await expect(recordStripeAccountingRefunds(supabase, stripe, charge)).rejects.toThrow("Posting failed")
    await recordStripeAccountingRefunds(supabase, stripe, charge)
    expect(supabase.rpc.mock.calls[0]).toEqual(supabase.rpc.mock.calls[1])
    expect(postSaleJournalWithClient).toHaveBeenCalledTimes(2)
  })

  it.each(["source", "record", "pagination"])("propagates %s errors rather than acknowledging the webhook", async (stage) => {
    const { supabase, stripe, sales } = setup()
    if (stage === "source") sales.maybeSingle.mockResolvedValue({ error: { message: "offline" } })
    if (stage === "record") supabase.rpc.mockResolvedValue({ error: { message: "unavailable" } })
    if (stage === "pagination") stripe.refunds.list.mockRejectedValue(new Error("Stripe unavailable"))
    await expect(recordStripeAccountingRefunds(supabase, stripe, charge)).rejects.toThrow()
    expect(postSaleJournalWithClient).not.toHaveBeenCalled()
  })

  it.each([
    { currency: "eur" }, { charge: "ch_other" }, { amount: -100 }, { created: NaN },
  ])("rejects invalid successful refunds %j", async (changes) => {
    const { supabase, stripe } = setup()
    stripe.refunds.list.mockResolvedValue({ data: [refund("re_invalid", changes)], has_more: false })
    await expect(recordStripeAccountingRefunds(supabase, stripe, charge)).rejects.toThrow("Invalid successful Stripe refund")
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("rejects a currency mismatch before recording any receipt", async () => {
    const { supabase, stripe } = setup({ currency: "EUR" })
    await expect(recordStripeAccountingRefunds(supabase, stripe, charge)).rejects.toThrow("does not match")
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("uses currency-specific Stripe minor units", async () => {
    const { supabase, stripe } = setup({ currency: "JPY" })
    stripe.refunds.list.mockResolvedValue({ data: [refund("re_yen", { currency: "jpy", amount: 300 })], has_more: false })
    await recordStripeAccountingRefunds(supabase, stripe, { ...charge, currency: "jpy" })
    expect(supabase.rpc).toHaveBeenCalledWith("accounting_record_sale_refund", expect.objectContaining({ p_amount: 300, p_currency: "JPY" }))
  })

  it("does not post if Stripe only returned unsuccessful refund attempts", async () => {
    const { supabase, stripe } = setup()
    stripe.refunds.list.mockResolvedValue({ data: [refund("re_failed", { status: "failed" })], has_more: false })
    await recordStripeAccountingRefunds(supabase, stripe, charge)
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(postSaleJournalWithClient).not.toHaveBeenCalled()
  })
})