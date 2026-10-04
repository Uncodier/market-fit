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
  it("fails closed on an invalid grant response without recording a successful payment", async () => {
    const h = harness()
    h.rpc.mockResolvedValueOnce({ data: { success: false }, error: null })
    await expect(handleCreditsPurchase(h.client, h.session)).rejects.toThrow("Invalid purchased credit grant response")
    expect(h.upsert).not.toHaveBeenCalled()
  })
})