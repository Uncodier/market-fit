/** @jest-environment node */
import type Stripe from "stripe"
import { resolveStripeSaleWalletAmount } from "@/app/api/stripe/webhook/sale-wallet-amount"

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_wallet", mode: "payment", status: "complete", payment_status: "paid",
    currency: "mxn", amount_total: 16400, payment_intent: "pi_wallet", ...overrides,
  } as unknown as Stripe.Checkout.Session
}

function transport(currency = "usd") {
  const transaction = { id: "txn_wallet", currency, amount: 918, net: 860, source: "ch_wallet" }
  const charge = {
    id: "ch_wallet", payment_intent: "pi_wallet", paid: true, status: "succeeded",
    currency: "mxn", amount: 16400, amount_captured: 16400, balance_transaction: transaction,
  }
  const intent = {
    id: "pi_wallet", status: "succeeded", currency: "mxn", amount: 16400,
    amount_received: 16400, latest_charge: charge,
  }
  const stripe = {
    paymentIntents: { retrieve: jest.fn().mockResolvedValue(intent) },
    charges: { retrieve: jest.fn().mockResolvedValue(charge) },
    balanceTransactions: { retrieve: jest.fn().mockResolvedValue(transaction) },
  }
  return { stripe: stripe as unknown as Stripe, intent, charge, transaction, mocks: stripe }
}

describe("Stripe USD wallet revenue", () => {
  it("converts MXN using verified gross USD settlement, not net Stripe proceeds", async () => {
    const h = transport()
    await expect(resolveStripeSaleWalletAmount(h.stripe, session())).resolves.toEqual({ amount: 9.18, currency: "USD" })
  })

  it("does not credit 164 MXN as 164 USD when conversion is unavailable", async () => {
    const h = transport("mxn")
    h.transaction.amount = 16400
    await expect(resolveStripeSaleWalletAmount(h.stripe, session())).rejects.toThrow("not USD")
  })

  it("keeps modern Adaptive Pricing USD integration amounts without double conversion", async () => {
    const h = transport("mxn")
    await expect(resolveStripeSaleWalletAmount(h.stripe, session({
      currency: "usd", amount_total: 918,
      presentment_details: { presentment_amount: 16400, presentment_currency: "mxn" },
    }))).resolves.toEqual({ amount: 9.18, currency: "USD" })
    expect(h.mocks.paymentIntents.retrieve).not.toHaveBeenCalled()
  })

  it("uses the authoritative legacy Adaptive Pricing USD source total", async () => {
    const h = transport()
    await expect(resolveStripeSaleWalletAmount(h.stripe, session({
      currency_conversion: { source_currency: "usd", amount_total: 918 },
    }))).resolves.toEqual({ amount: 9.18, currency: "USD" })
    expect(h.mocks.paymentIntents.retrieve).not.toHaveBeenCalled()
  })

  it("retrieves unexpanded charge and balance transaction references", async () => {
    const h = transport()
    Object.assign(h.intent, { latest_charge: "ch_wallet" })
    Object.assign(h.charge, { balance_transaction: "txn_wallet" })
    await expect(resolveStripeSaleWalletAmount(h.stripe, session())).resolves.toEqual({ amount: 9.18, currency: "USD" })
    expect(h.mocks.charges.retrieve).toHaveBeenCalledWith("ch_wallet", { expand: ["balance_transaction"] })
    expect(h.mocks.balanceTransactions.retrieve).toHaveBeenCalledWith("txn_wallet")
  })

  it("fails retryably when Stripe has not created a balance transaction", async () => {
    const h = transport()
    Object.assign(h.charge, { balance_transaction: null })
    await expect(resolveStripeSaleWalletAmount(h.stripe, session())).rejects.toThrow("retry settlement later")
  })

  it.each([
    { id: "pi_other" }, { status: "processing" }, { currency: "usd" },
    { amount: 918 }, { amount_received: 0 },
  ])("rejects mismatched or unpaid intent %j", async overrides => {
    const h = transport()
    Object.assign(h.intent, overrides)
    await expect(resolveStripeSaleWalletAmount(h.stripe, session())).rejects.toThrow("intent does not match")
  })

  it.each([
    { payment_intent: "pi_other" }, { paid: false }, { amount_captured: 0 },
  ])("rejects mismatched or uncaptured charge %j", async overrides => {
    const h = transport()
    Object.assign(h.charge, overrides)
    await expect(resolveStripeSaleWalletAmount(h.stripe, session())).rejects.toThrow("charge does not match")
  })

  it("rejects a balance transaction belonging to a different charge", async () => {
    const h = transport()
    h.transaction.source = "ch_other"
    await expect(resolveStripeSaleWalletAmount(h.stripe, session())).rejects.toThrow("not available")
  })

  it.each([0, -10, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("rejects invalid USD minor amount %s", async amount => {
    const h = transport()
    h.transaction.amount = amount
    await expect(resolveStripeSaleWalletAmount(h.stripe, session())).rejects.toThrow("positive minor-unit integer")
  })

  it("never uses a local fallback when intent is missing or retrieval fails", async () => {
    const h = transport()
    await expect(resolveStripeSaleWalletAmount(h.stripe, session({ payment_intent: null }))).rejects.toThrow("no verifiable")
    h.mocks.paymentIntents.retrieve.mockRejectedValue(new Error("Stripe unavailable"))
    await expect(resolveStripeSaleWalletAmount(h.stripe, session())).rejects.toThrow("Stripe unavailable")
  })
})