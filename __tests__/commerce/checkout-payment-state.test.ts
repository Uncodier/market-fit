import { resolveCheckoutPaymentState } from "@/app/commerce/checkout-payment-state"

describe("resolveCheckoutPaymentState", () => {
  it("preserves prior payments when a payment is added to an existing order", () => {
    const prior = [{ id: "old", amount: 40, method: "cash" }]
    const next = [{ id: "new", amount: 60, method: "credit_card" }]

    expect(resolveCheckoutPaymentState(100, prior, next)).toEqual({
      payments: [...prior, ...next],
      totalPaid: 100,
      amountDue: 0,
      isFullyPaid: true,
    })
  })

  it("keeps the remaining balance for a partial payment", () => {
    const state = resolveCheckoutPaymentState(
      100,
      [{ amount: "25" }],
      [{ amount: 15 }],
    )

    expect(state.totalPaid).toBe(40)
    expect(state.amountDue).toBe(60)
    expect(state.isFullyPaid).toBe(false)
  })

  it("preserves a legacy balance when payment rows are missing", () => {
    const state = resolveCheckoutPaymentState(100, [], [{ amount: 15 }], {
      amount: 100,
      amountDue: 75,
    })

    expect(state.totalPaid).toBe(40)
    expect(state.amountDue).toBe(60)
  })
})
