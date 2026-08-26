import {
  checkoutLinesNeedFxConversion,
  convertCartAmountToCurrency,
  normalizeCheckoutLinesToCurrency,
  resolveSiteCurrency,
} from "../../app/commerce/checkout-currency"

const rates = {
  EUR: 0.9,
  MXN: 18.0,
  GBP: 0.8,
}

describe("resolveSiteCurrency", () => {
  it("uppercases and falls back to USD", () => {
    expect(resolveSiteCurrency("mxn")).toBe("MXN")
    expect(resolveSiteCurrency("  eur ")).toBe("EUR")
    expect(resolveSiteCurrency(null)).toBe("USD")
    expect(resolveSiteCurrency("")).toBe("USD")
  })
})

describe("checkoutLinesNeedFxConversion", () => {
  it("is false when every line already matches the target", () => {
    expect(
      checkoutLinesNeedFxConversion(
        [
          { currency: "USD", unit_price: 10, subtotal: 10 },
          { currency: "usd", unit_price: 5, subtotal: 10 },
        ],
        "USD",
      ),
    ).toBe(false)
  })

  it("is true when any line differs from the target", () => {
    expect(
      checkoutLinesNeedFxConversion(
        [
          { currency: "USD", unit_price: 10, subtotal: 10 },
          { currency: "MXN", unit_price: 180, subtotal: 180 },
        ],
        "USD",
      ),
    ).toBe(true)
  })
})

describe("normalizeCheckoutLinesToCurrency", () => {
  it("leaves matching currency lines unchanged except normalizing the code", () => {
    const result = normalizeCheckoutLinesToCurrency(
      [{ currency: "usd", unit_price: 10.5, subtotal: 21 }],
      "USD",
      rates,
    )
    expect(result.lines[0]).toEqual({
      currency: "USD",
      unit_price: 10.5,
      subtotal: 21,
    })
    expect(result.subtotal).toBe(21)
  })

  it("converts USD to EUR and MXN to USD", () => {
    const usdToEur = normalizeCheckoutLinesToCurrency(
      [{ currency: "USD", unit_price: 100, subtotal: 200 }],
      "EUR",
      rates,
    )
    expect(usdToEur.lines[0].unit_price).toBe(90)
    expect(usdToEur.lines[0].subtotal).toBe(180)
    expect(usdToEur.lines[0].currency).toBe("EUR")
    expect(usdToEur.subtotal).toBe(180)

    const mxnToUsd = normalizeCheckoutLinesToCurrency(
      [{ currency: "MXN", unit_price: 180, subtotal: 360 }],
      "USD",
      rates,
    )
    expect(mxnToUsd.lines[0].unit_price).toBe(10)
    expect(mxnToUsd.lines[0].subtotal).toBe(20)
  })

  it("converts mixed-currency lines onto the site currency", () => {
    const result = normalizeCheckoutLinesToCurrency(
      [
        { currency: "USD", unit_price: 100, subtotal: 100, name: "Coffee" },
        { currency: "MXN", unit_price: 180, subtotal: 360, name: "Pan" },
      ],
      "USD",
      rates,
    )
    expect(result.lines.map((l) => l.currency)).toEqual(["USD", "USD"])
    expect(result.lines[0].subtotal).toBe(100)
    expect(result.lines[1].unit_price).toBe(10)
    expect(result.lines[1].subtotal).toBe(20)
    expect(result.subtotal).toBe(120)
  })

  it("throws when a required rate is missing", () => {
    expect(() =>
      normalizeCheckoutLinesToCurrency(
        [{ currency: "JPY", unit_price: 1000, subtotal: 1000 }],
        "USD",
        rates,
      ),
    ).toThrow("Unable to convert JPY to USD.")
  })
})

describe("convertCartAmountToCurrency", () => {
  it("converts when rates exist and keeps the original when they do not", () => {
    expect(convertCartAmountToCurrency(180, "MXN", "USD", rates)).toBe(10)
    expect(convertCartAmountToCurrency(100, "USD", "USD", rates)).toBe(100)
    expect(convertCartAmountToCurrency(1000, "JPY", "USD", rates)).toBe(1000)
    expect(convertCartAmountToCurrency(100, "EUR", "USD", {})).toBe(100)
  })
})
