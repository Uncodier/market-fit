import {
  checkoutIdempotencyKey,
  existingCheckoutResult,
  fromStripeMinorAmount,
  linkCheckoutSession,
  payableAmount,
  reserveCheckoutAttempt,
  toStripeMinorAmount,
} from "@/app/api/stripe/checkout/checkout-payment-guard"

describe("Stripe checkout payment guards", () => {
  it("accepts pending and completed sales with an outstanding balance", () => {
    expect(payableAmount({
      id: "sale-1",
      status: "pending",
      amount_due: "12.34",
    })).toEqual({ amount: 12.34 })

    expect(payableAmount({
      id: "sale-1",
      status: "completed",
      amount_due: 12.34,
    })).toEqual({ amount: 12.34 })

    expect(payableAmount({
      id: "sale-1",
      status: "cancelled",
      amount_due: 12.34,
    })).toEqual({ error: "This payment is no longer available" })

    expect(payableAmount({
      id: "sale-1",
      status: "refunded",
      amount_due: 12.34,
    })).toEqual({ error: "This payment is no longer available" })

    expect(payableAmount({
      id: "sale-1",
      status: "pending",
      amount_due: 0,
    })).toEqual({ error: "This document has no outstanding balance" })
  })

  it("converts standard, zero-decimal, and Stripe-compatible UGX amounts", () => {
    expect(toStripeMinorAmount(12.34, "USD")).toBe(1234)
    expect(toStripeMinorAmount(1234, "JPY")).toBe(1234)
    expect(toStripeMinorAmount(1234, "KMF")).toBe(1234)
    expect(toStripeMinorAmount(1234, "UGX")).toBe(123400)
    expect(() => toStripeMinorAmount(1234.5, "UGX")).toThrow(
      "Stripe requires UGX amounts to use whole currency units",
    )

    expect(fromStripeMinorAmount(1234, "USD")).toBe(12.34)
    expect(fromStripeMinorAmount(1234, "KMF")).toBe(1234)
    expect(fromStripeMinorAmount(123400, "UGX")).toBe(1234)
    expect(() => fromStripeMinorAmount(123450, "UGX")).toThrow(
      "Stripe UGX minor amounts must be divisible by 100",
    )
  })

  it("reuses only an open session matching the current balance", async () => {
    const expire = jest.fn().mockResolvedValue({ status: "expired" })
    const retrieve = jest.fn()
      .mockResolvedValueOnce({
        id: "cs_matching",
        status: "open",
        amount_total: 2500,
        currency: "usd",
        url: "https://checkout.stripe.test/matching",
      })
      .mockResolvedValueOnce({
        id: "cs_stale",
        status: "open",
        amount_total: 5000,
        currency: "usd",
        url: "https://checkout.stripe.test/stale",
      })
    const stripe = {
      checkout: { sessions: { retrieve, expire } },
    } as any

    await expect(existingCheckoutResult(
      stripe,
      "cs_matching",
      { amountMinor: 2500, currency: "USD" }
    )).resolves.toEqual({ url: "https://checkout.stripe.test/matching" })

    await expect(existingCheckoutResult(
      stripe,
      "cs_stale",
      { amountMinor: 2500, currency: "USD" }
    )).resolves.toBeNull()
    expect(expire).toHaveBeenCalledWith("cs_stale")
  })

  it("uses the durable attempt version in the idempotency key", () => {
    expect(checkoutIdempotencyKey({
      saleId: "sale-1",
      amountMinor: 2500,
      currency: "USD",
      attempt: 7,
    })).toBe("public-checkout:sale:sale-1:7:usd:2500")
  })

  it("reserves and links checkout attempts through atomic RPCs", async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce({
        data: { status: "reserved", attempt: 3 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { status: "linked" },
        error: null,
      })
    const supabase = { rpc } as any

    await expect(reserveCheckoutAttempt(supabase, {
      saleId: "sale-1",
      amountMinor: 2500,
      currency: "USD",
      expectedSessionId: "cs_previous",
    })).resolves.toEqual({ status: "reserved", attempt: 3 })

    await expect(linkCheckoutSession(supabase, {
      saleId: "sale-1",
      amountMinor: 2500,
      currency: "USD",
      attempt: 3,
      sessionId: "cs_new",
    })).resolves.toBe(true)

    expect(rpc).toHaveBeenNthCalledWith(1, "reserve_stripe_checkout_attempt", {
      p_sale_id: "sale-1",
      p_amount_minor: 2500,
      p_currency: "usd",
      p_expected_session_id: "cs_previous",
    })
    expect(rpc).toHaveBeenNthCalledWith(2, "link_stripe_checkout_session", {
      p_sale_id: "sale-1",
      p_attempt: 3,
      p_session_id: "cs_new",
      p_amount_minor: 2500,
      p_currency: "usd",
    })
  })
})
