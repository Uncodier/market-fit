/** @jest-environment node */
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { processStripeSaleSettlementEffects } from "@/app/api/stripe/webhook/sale-settlement-effects"
import { validateLiveSaleCheckoutSession } from "@/app/api/stripe/webhook/sale-checkout-settlement"

jest.mock("@/app/commerce/post-payment", () => ({ processPostPaymentFulfillment: jest.fn() }))
jest.mock("@/app/commerce/entitlements", () => ({ syncSubscriptionEntitlements: jest.fn() }))
jest.mock("@/app/accounting/source-posting", () => ({ postSaleJournalWithClient: jest.fn() }))

const session = {
  id: "cs_wallet", mode: "payment", status: "complete", payment_status: "paid",
  amount_total: 16400, currency: "mxn", payment_intent: "pi_wallet",
  metadata: { type: "sale", sale_id: "00000000-0000-4000-8000-000000000001" },
} as unknown as Stripe.Checkout.Session
const checkout = validateLiveSaleCheckoutSession(session)
const settlement = {
  outcome: "settled" as const, resumeEffects: true, saleId: checkout.saleId,
  siteId: "00000000-0000-4000-8000-000000000002", leadId: null,
  orderId: null, orderUserId: null, orderBuyerUserId: null,
}

function transport(currency: string, available = true) {
  const rpc = jest.fn().mockResolvedValue({ data: { status: "completed" }, error: null })
  const stripe = { paymentIntents: { retrieve: jest.fn().mockResolvedValue({
    id: "pi_wallet", currency: "mxn", amount: 16400, amount_received: 16400, status: "succeeded",
    latest_charge: {
      id: "ch_wallet", payment_intent: "pi_wallet", paid: true, status: "succeeded",
      currency: "mxn", amount: 16400, amount_captured: 16400,
      balance_transaction: available ? { source: "ch_wallet", currency, amount: 918 } : null,
    },
  }) } }
  return {
    rpc,
    params: {
      supabase: { rpc } as unknown as SupabaseClient,
      stripe: stripe as unknown as Stripe, checkout, settlement,
    },
  }
}

it("sends only converted USD to the atomic financial effects RPC", async () => {
  const h = transport("usd")
  await processStripeSaleSettlementEffects(h.params)
  expect(h.rpc).toHaveBeenCalledTimes(1)
  expect(h.rpc).toHaveBeenCalledWith("apply_stripe_sale_financial_effects", {
    p_sale_id: checkout.saleId, p_session_id: "cs_wallet",
    p_settlement_amount: 9.18, p_settlement_currency: "USD",
  })
})

it.each([true, false])("does not run finance or fulfillment when USD settlement is unavailable (balance present: %s)", async available => {
  const h = transport("mxn", available)
  await expect(processStripeSaleSettlementEffects(h.params)).rejects.toThrow()
  expect(h.rpc).not.toHaveBeenCalled()
})