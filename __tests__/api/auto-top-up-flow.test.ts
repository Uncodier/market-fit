/** @jest-environment node */
import { randomUUID } from "node:crypto"
import type Stripe from "stripe"
import { processAutoTopUpSite } from "@/app/api/stripe/auto-top-up/worker/process"
import { settleAutoTopUpIntent } from "@/app/api/stripe/auto-top-up/settlement"

const rpc = jest.fn()
const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() }
const from = jest.fn(() => query)
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn(async () => ({ rpc, from })) }))
const siteId = randomUUID(), attemptId = randomUUID()
const claim = { outcome: "claimed", attempt_id: attemptId, claim_token: randomUUID(),
  idempotency_key: `credit-auto-top-up-${attemptId}`, claim_expires_at: new Date(Date.now() + 600000).toISOString(),
  credits: 20, amount_cents: 2000, stripe_customer_id: "cus_synthetic", stripe_payment_method_id: "pm_synthetic", stripe_payment_intent_id: null }
const paid = { id: "pi_synthetic", status: "succeeded", amount: 2000, amount_received: 2000, currency: "usd",
  customer: claim.stripe_customer_id, payment_method: claim.stripe_payment_method_id,
  metadata: { type: "credit_auto_top_up", site_id: siteId, attempt_id: attemptId } } as unknown as Stripe.PaymentIntent
const create = jest.fn(), retrieve = jest.fn(), customer = jest.fn(), method = jest.fn()
const stripe = { paymentIntents: { create, retrieve }, customers: { retrieve: customer }, paymentMethods: { retrieve: method } } as unknown as Stripe
beforeEach(() => {
  jest.clearAllMocks(); query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue({ data: { id: attemptId, site_id: siteId,
    amount_cents: 2000, stripe_customer_id: claim.stripe_customer_id,
    stripe_payment_method_id: claim.stripe_payment_method_id, claim_token: claim.claim_token,
    stripe_payment_intent_id: null, status: "pending" }, error: null })
  rpc.mockImplementation(async (name: string) => ({ data: name === "begin_credit_auto_top_up_attempt" ? claim
    : { outcome: ({ authorize_credit_auto_top_up_dispatch: "authorized", complete_credit_auto_top_up_attempt: "succeeded",
      record_credit_auto_top_up_intent: "recorded", fail_credit_auto_top_up_attempt: "failed" } as Record<string,string>)[name] }, error: null }))
  create.mockResolvedValue(paid); retrieve.mockResolvedValue(paid)
  customer.mockResolvedValue({ id: claim.stripe_customer_id, metadata: { site_id: siteId } })
  method.mockResolvedValue({ id: claim.stripe_payment_method_id, customer: claim.stripe_customer_id, type: "card" })
})
it("persists single-use dispatch before Stripe and settles once", async () => {
  expect(await processAutoTopUpSite(stripe, siteId)).toBe("succeeded")
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ amount: 2000, confirm: true, off_session: true }), { idempotencyKey: claim.idempotency_key })
  expect(rpc.mock.calls.map(call => call[0])).toEqual(["begin_credit_auto_top_up_attempt", "authorize_credit_auto_top_up_dispatch", "record_credit_auto_top_up_intent", "complete_credit_auto_top_up_attempt"])
})
it("recovers saved intent without creating/confirming another charge", async () => {
  rpc.mockResolvedValueOnce({ data: { ...claim, stripe_payment_intent_id: paid.id }, error: null })
  expect(await processAutoTopUpSite(stripe, siteId)).toBe("succeeded")
  expect(create).not.toHaveBeenCalled(); expect(customer).not.toHaveBeenCalled()
})
it.each(["needs_reconciliation", "in_progress", "not_eligible"])("does not create for %s", async outcome => {
  rpc.mockResolvedValueOnce({ data: { outcome }, error: null })
  expect(await processAutoTopUpSite(stripe, siteId)).toBe(outcome); expect(create).not.toHaveBeenCalled()
})
it("honors revoked consent before dispatch", async () => {
  rpc.mockResolvedValueOnce({ data: claim, error: null }).mockResolvedValueOnce({ data: { outcome: "not_authorized" }, error: null })
  expect(await processAutoTopUpSite(stripe, siteId)).toBe("needs_reconciliation"); expect(create).not.toHaveBeenCalled()
})
it("never sends an expired worker's Stripe request", async () => {
  rpc.mockResolvedValueOnce({ data: { ...claim, claim_expires_at: new Date(Date.now()-1000).toISOString() }, error: null })
  await expect(processAutoTopUpSite(stripe, siteId)).rejects.toThrow("expired"); expect(create).not.toHaveBeenCalled()
})
it("retains an ambiguous dispatched attempt without a second create", async () => {
  create.mockRejectedValueOnce(new Error("Synthetic timeout"))
  await expect(processAutoTopUpSite(stripe, siteId)).rejects.toThrow("requires reconciliation")
  expect(create).toHaveBeenCalledTimes(1)
  expect(rpc).not.toHaveBeenCalledWith("fail_credit_auto_top_up_attempt", expect.anything())
})
it("recovers error.payment_intent but never trusts the error payment state", async () => {
  create.mockRejectedValueOnce({ payment_intent: { id: paid.id, status: "succeeded" } })
  retrieve.mockResolvedValue({ ...paid, status: "requires_payment_method" })
  expect(await processAutoTopUpSite(stripe, siteId)).toBe("requires_payment_method")
  expect(rpc).toHaveBeenCalledWith("record_credit_auto_top_up_intent", expect.anything())
  expect(rpc).not.toHaveBeenCalledWith("complete_credit_auto_top_up_attempt", expect.anything())
})
it.each([{ customer: "cus_other" }, { amount_received: 1 }])("rejects payment identity / paid amount mismatch %#", async override => {
  retrieve.mockResolvedValue({ ...paid, ...override })
  await expect(settleAutoTopUpIntent(stripe, paid)).rejects.toThrow("identity mismatch"); expect(rpc).not.toHaveBeenCalled()
})
it("validates live customer and card before money movement", async () => {
  method.mockResolvedValueOnce({ id: claim.stripe_payment_method_id, customer: "cus_other", type: "card" })
  await expect(processAutoTopUpSite(stripe, siteId)).rejects.toThrow("mismatch"); expect(create).not.toHaveBeenCalled()
})
it.each(["requires_action", "processing", "requires_payment_method"])("retains reservation for %s", async status => {
  retrieve.mockResolvedValue({ ...paid, status }); expect(await settleAutoTopUpIntent(stripe, paid)).toBe(status)
  expect(rpc).not.toHaveBeenCalledWith("complete_credit_auto_top_up_attempt", expect.anything())
  expect(rpc).not.toHaveBeenCalledWith("fail_credit_auto_top_up_attempt", expect.anything())
})
it("rejects a forged attempt from a Stripe error", async () => {
  create.mockRejectedValue({ payment_intent: "pi_other" })
  retrieve.mockResolvedValue({ ...paid, metadata: { ...paid.metadata, attempt_id: randomUUID() } })
  await expect(processAutoTopUpSite(stripe, siteId)).rejects.toThrow("Unexpected")
})
