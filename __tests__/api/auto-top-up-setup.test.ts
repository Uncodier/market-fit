/** @jest-environment node */
import { randomUUID } from "node:crypto"
import type Stripe from "stripe"
import { settleAutoTopUpSetup } from "@/app/api/stripe/auto-top-up/setup/settlement"

const site = randomUUID()
const token = randomUUID()
const rpc = jest.fn()
const billingLookup = jest.fn()
const from = jest.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: billingLookup }) }) }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: async () => ({ rpc, from }) }))
const session = { id: "cs_synthetic", mode: "setup", status: "complete",
  customer: "cus_synthetic", setup_intent: "seti_synthetic",
  metadata: { type: "credit_auto_top_up_setup", site_id: site, setup_token: token } } as unknown as Stripe.Checkout.Session
const retrieveSession = jest.fn()
const retrieveCustomer = jest.fn()
const retrieveSetup = jest.fn()
const retrieveMethod = jest.fn()
const stripe = { checkout: { sessions: { retrieve: retrieveSession } },
  customers: { retrieve: retrieveCustomer }, setupIntents: { retrieve: retrieveSetup },
  paymentMethods: { retrieve: retrieveMethod } } as unknown as Stripe
beforeEach(() => {
  jest.clearAllMocks()
  retrieveSession.mockResolvedValue(session)
  billingLookup.mockResolvedValue({ data: { stripe_customer_id: session.customer }, error: null })
  retrieveCustomer.mockResolvedValue({ id: session.customer, metadata: { site_id: site } })
  retrieveSetup.mockResolvedValue({ id: "seti_synthetic", usage: "off_session", status: "succeeded", customer: session.customer,
    payment_method: "pm_synthetic", metadata: { type: "credit_auto_top_up_setup", site_id: site, setup_token: token } })
  retrieveMethod.mockResolvedValue({ id: "pm_synthetic", type: "card", customer: session.customer })
  rpc.mockResolvedValue({ data: { success: true, outcome: "attached" }, error: null })
})
it("attaches only a successful setup and verified card for the site's billing customer", async () => {
  await settleAutoTopUpSetup(stripe, session)
  expect(rpc).toHaveBeenCalledWith("complete_credit_auto_top_up_setup", {
    p_site_id: site, p_token: token, p_stripe_customer_id: session.customer, p_stripe_payment_method_id: "pm_synthetic",
  })
})
it("rejects another customer's card before storing consent", async () => {
  retrieveMethod.mockResolvedValueOnce({ id: "pm_other", type: "card", customer: "cus_other" })
  await expect(settleAutoTopUpSetup(stripe, session)).rejects.toThrow("Payment method not attached")
  expect(rpc).not.toHaveBeenCalled()
})
it("rejects incomplete or unauthenticated SetupIntents", async () => {
  retrieveSetup.mockResolvedValueOnce({ status: "requires_action" })
  await expect(settleAutoTopUpSetup(stripe, session)).rejects.toThrow("Unverified top-up setup")
  expect(rpc).not.toHaveBeenCalled()
})
