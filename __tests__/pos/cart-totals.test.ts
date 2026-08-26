import {
  posCartSubtotalInSiteCurrency,
  posCartTaxLinesInSiteCurrency,
  resolvePosCartCurrency,
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

  it("keeps original amounts when the target matches the line", () => {
    expect(
      posCartSubtotalInSiteCurrency(
        [line({ cartPrice: 250, currency: "MXN" })],
        "MXN",
        rates,
      ),
    ).toBe(250)
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

describe("resolvePosCartCurrency", () => {
  it("uses the product currency when the cart is uniform", () => {
    expect(
      resolvePosCartCurrency(
        [line({ currency: "MXN" }), line({ currency: "MXN", cartQty: 2 })],
        "USD",
      ),
    ).toBe("MXN")
  })

  it("uses the site currency when the cart is mixed", () => {
    expect(
      resolvePosCartCurrency(
        [line({ currency: "USD" }), line({ currency: "MXN" })],
        "USD",
      ),
    ).toBe("USD")
  })

  it("uses the site currency when cart lines omit a product currency", () => {
    expect(
      resolvePosCartCurrency(
        [line({ currency: null }), line({ currency: undefined, cartQty: 2 })],
        "MXN",
      ),
    ).toBe("MXN")
  })
})
