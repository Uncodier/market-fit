import {
  calculateLineTax,
  calculateOrderTaxTotal,
  combinedTaxFraction,
  formatTaxRateLabel,
  roundMoney,
} from "@/app/commerce/taxes"

describe("commerce/taxes", () => {
  it("rounds money to 2 decimals", () => {
    expect(roundMoney(10.005)).toBe(10.01)
    expect(roundMoney(10.004)).toBe(10)
  })

  it("combines tax rates as a fraction", () => {
    expect(combinedTaxFraction([{ rate: 16 }, { rate: 8 }])).toBeCloseTo(0.24)
  })

  it("calculates exclusive line tax", () => {
    expect(calculateLineTax(100, [{ rate: 16 }])).toBe(16)
  })

  it("aggregates order tax by item associations", () => {
    const total = calculateOrderTaxTotal(
      [
        { catalogItemId: "a", subtotal: 100 },
        { catalogItemId: "b", subtotal: 50 },
      ],
      {
        a: [{ rate: 16 }],
        b: [{ rate: 8 }],
      },
    )
    expect(total).toBe(20)
  })

  it("formats rate labels", () => {
    expect(formatTaxRateLabel(16)).toBe("16%")
    expect(formatTaxRateLabel(16.5)).toBe("16.50%")
  })
})
