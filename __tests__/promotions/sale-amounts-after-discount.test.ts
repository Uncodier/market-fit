import { saleAmountsAfterDiscount } from "@/app/promotions/sale-amounts-after-discount"

describe("saleAmountsAfterDiscount", () => {
  it("keeps a paid sale paid after the discount", () => {
    expect(
      saleAmountsAfterDiscount(128, {
        amount: 160,
        amount_due: 0,
        payments: [{ amount: 160 }],
        status: "completed",
      })
    ).toEqual({ amount: 128, amount_due: 0 })
  })

  it("does not reopen amount_due when the customer already paid in full", () => {
    expect(
      saleAmountsAfterDiscount(95, {
        amount: 100,
        amount_due: 0,
        status: "completed",
      })
    ).toEqual({ amount: 95, amount_due: 0 })
  })

  it("reduces the remaining balance on a partially paid sale", () => {
    expect(
      saleAmountsAfterDiscount(80, {
        amount: 100,
        amount_due: 40,
        payments: [{ amount: 60 }],
      })
    ).toEqual({ amount: 80, amount_due: 20 })
  })

  it("marks a pending sale completed when the discount clears the balance", () => {
    expect(
      saleAmountsAfterDiscount(0, {
        amount: 20,
        amount_due: 20,
        status: "pending",
      })
    ).toEqual({ amount: 0, amount_due: 0, status: "completed" })
  })
})
