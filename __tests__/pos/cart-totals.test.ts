import {
  posCartSubtotalInSiteCurrency,
  posCartTaxLinesInSiteCurrency,
} from "../../app/pos/cart-totals"

const rates = { EUR: 0.9, MXN: 18.0 }

function line(partial: Record<string, unknown>) {
  return {
    cartQty: 1,
    cartPrice: 0,
    currency: "USD",
    modifiers: [],
    ...partial,
  } as any
}

describe("posCartSubtotalInSiteCurrency", () => {
  it("sums mixed currencies into the site currency", () => {
    expect(
      posCartSubtotalInSiteCurrency(
        [
          line({ cartPrice: 100, currency: "USD" }),
          line({ cartPrice: 180, currency: "MXN", cartQty: 2 }),
        ],
        "USD",
        rates,
      ),
    ).toBe(120)
  })

  it("keeps original amounts when rates are missing", () => {
    expect(
      posCartSubtotalInSiteCurrency(
        [line({ cartPrice: 180, currency: "MXN" })],
        "USD",
        {},
      ),
    ).toBe(180)
  })
})

describe("posCartTaxLinesInSiteCurrency", () => {
  it("converts host and modifier subtotals using the host currency", () => {
    const lines = posCartTaxLinesInSiteCurrency(
      [
        line({
          id: "host",
          cartPrice: 180,
          currency: "MXN",
          modifiers: [{ catalogItemId: "mod", cartPrice: 18, cartQty: 1 }],
        }),
      ],
      "USD",
      rates,
    )
    expect(lines).toEqual([
      { catalogItemId: "host", subtotal: 10 },
      { catalogItemId: "mod", subtotal: 1 },
    ])
  })
})
