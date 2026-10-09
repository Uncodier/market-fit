/** @jest-environment node */
import { randomUUID } from "node:crypto"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { handleCreditsPurchase } from "@/app/api/stripe/webhook/credit-purchase-settlement"

function harness() {
  const site = randomUUID()
  const session = { id: `cs_${randomUUID()}`, payment_status: "paid", amount_total: 2000,
    currency: "usd", customer: "cus_synthetic", payment_intent: "pi_synthetic",
    metadata: { site_id: site, credits: "20" } } as unknown as Stripe.Checkout.Session
  const single = jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } })
  const upsert = jest.fn().mockResolvedValue({ error: null })
  const from = jest.fn(() => ({ select: () => ({ eq: () => ({ single }) }), upsert }))
  const rpc = jest.fn().mockResolvedValue({ data: { success: true, outcome: "granted", new_balance: 21, credits_granted: 20 }, error: null })
  const client = { from, rpc } as unknown as Pick<SupabaseClient, "from" | "rpc">
  return { site, session, single, upsert, rpc, client }
}

describe("non-expiring purchased credit settlement", () => {
  it("uses a stable purchase key and never calls the unclassified additive RPC", async () => {
    const h = harness()
    await handleCreditsPurchase(h.client, h.session)
    expect(h.rpc).toHaveBeenCalledWith("grant_purchased_site_credits", {
      p_site_id: h.site, p_amount: 20, p_idempotency_key: `stripe_${h.session.id}`,
      p_metadata: expect.objectContaining({ stripe_session_id: h.session.id, credits_purchased: 20 }),
    })
    expect(h.upsert).toHaveBeenCalledWith(expect.objectContaining({ transaction_type: "credits_purchase", credits: 20 }),
      { onConflict: "transaction_id", ignoreDuplicates: true })
  })
  it("records the reduced Stripe total while granting the purchased package", async () => {
    const h = harness()
    await handleCreditsPurchase(h.client, { ...h.session, amount_total: 1500 } as Stripe.Checkout.Session)
    expect(h.rpc).toHaveBeenCalledWith("grant_purchased_site_credits", expect.objectContaining({ p_amount: 20 }))
    expect(h.upsert).toHaveBeenCalledWith(expect.objectContaining({ amount: 15, credits: 20 }),
      { onConflict: "transaction_id", ignoreDuplicates: true })
  })
  it("a failed payment write retries the same grant key without granting twice", async () => {
    const h = harness()
    h.upsert.mockResolvedValueOnce({ error: { message: "Synthetic payment failure" } })
    await expect(handleCreditsPurchase(h.client, h.session)).rejects.toThrow("Synthetic payment failure")
    h.rpc.mockResolvedValueOnce({ data: { success: true, outcome: "duplicate", new_balance: 21, credits_granted: 0 }, error: null })
    await handleCreditsPurchase(h.client, h.session)
    expect(h.rpc.mock.calls[0][1].p_idempotency_key).toEqual(h.rpc.mock.calls[1][1].p_idempotency_key)
  })
  it("completed historical purchases do not grant again", async () => {
    const h = harness()
    h.single.mockResolvedValueOnce({ data: { id: randomUUID(), site_id: h.site, transaction_type: "credits_purchase",
      status: "completed", credits: 20 }, error: null })
    await handleCreditsPurchase(h.client, h.session)
    expect(h.rpc).not.toHaveBeenCalled()
  })
  it.each(["failed", "unpaid"])("rejects %s session payment state", async status => {
    const h = harness()
    await expect(handleCreditsPurchase(h.client, { ...h.session, payment_status: status } as Stripe.Checkout.Session)).rejects.toThrow("Invalid paid credits purchase")
    expect(h.rpc).not.toHaveBeenCalled()
  })
  it.each([["20", 2000], ["52", 4925], ["515", 50000]])(
    "grants %s credits for a verified fully discounted Checkout", async (credits, price) => {
      const h = harness()
      const freeSession = { ...h.session, mode: "payment", status: "complete",
        payment_status: "no_payment_required", payment_intent: null,
        amount_subtotal: price, amount_total: 0,
        total_details: { amount_discount: price, amount_tax: 0, amount_shipping: 0 },
        metadata: { site_id: h.site, type: "credits_purchase", credits },
      } as Stripe.Checkout.Session
      await handleCreditsPurchase(h.client, freeSession)
      expect(h.rpc).toHaveBeenCalledWith("grant_purchased_site_credits", expect.objectContaining({
        p_amount: Number(credits), p_idempotency_key: `stripe_${h.session.id}`,
      }))
      expect(h.upsert).toHaveBeenCalledWith(expect.objectContaining({ amount: 0, credits: Number(credits) }),
        { onConflict: "transaction_id", ignoreDuplicates: true })
    })
  it.each([{ status: "open" }, { mode: "subscription" }, { amount_subtotal: 1 },
    { total_details: { amount_discount: 0, amount_tax: 0, amount_shipping: 0 } },
    { payment_intent: "pi_unexpected" }, { currency: "eur" },
    { metadata: { type: "credits_purchase", credits: "515" } }])(
    "rejects a zero-cost credit purchase without full proof %#", async override => {
      const h = harness()
      const session = { ...h.session, mode: "payment", status: "complete",
        payment_status: "no_payment_required", payment_intent: null, amount_subtotal: 2000, amount_total: 0,
        total_details: { amount_discount: 2000, amount_tax: 0, amount_shipping: 0 },
        metadata: { site_id: h.site, type: "credits_purchase", credits: "20" },
        ...override } as Stripe.Checkout.Session
      await expect(handleCreditsPurchase(h.client, session)).rejects.toThrow("Invalid paid credits purchase")
      expect(h.rpc).not.toHaveBeenCalled()
    })
  it("fails closed on an invalid grant response without recording a successful payment", async () => {
    const h = harness()
    h.rpc.mockResolvedValueOnce({ data: { success: false }, error: null })
    await expect(handleCreditsPurchase(h.client, h.session)).rejects.toThrow("Invalid purchased credit grant response")
    expect(h.upsert).not.toHaveBeenCalled()
  })
})