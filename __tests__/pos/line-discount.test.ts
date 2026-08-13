import {
  applyLineDiscountFields,
  clampDiscountPercent,
  clearLineDiscountFields,
  discountedUnitPrice,
  lineListPrice,
} from "@/app/pos/line-discount"

describe("lineListPrice", () => {
  it("uses cartListPrice when present so later percents do not compound", () => {
    expect(lineListPrice({ cartPrice: 72, cartListPrice: 80 })).toBe(80)
  })

  it("falls back to cartPrice before any discount is stored", () => {
    expect(lineListPrice({ cartPrice: 80 })).toBe(80)
  })
})

describe("clampDiscountPercent", () => {
  it("clamps to 0–100 and rounds to cents", () => {
    expect(clampDiscountPercent(-5)).toBe(0)
    expect(clampDiscountPercent(150)).toBe(100)
    expect(clampDiscountPercent(12.345)).toBe(12.35)
    expect(clampDiscountPercent(Number.NaN)).toBe(0)
  })
})

describe("discountedUnitPrice", () => {
  it("takes a percent off the list price", () => {
    expect(discountedUnitPrice(80, 10)).toBe(72)
    expect(discountedUnitPrice(80, 0)).toBe(80)
    expect(discountedUnitPrice(80, 100)).toBe(0)
  })
})

describe("applyLineDiscountFields", () => {
  it("keeps the original list price across successive percent edits", () => {
    const once = applyLineDiscountFields({ cartPrice: 80 }, 10)
    expect(once).toMatchObject({
      cartPrice: 72,
      cartListPrice: 80,
      cartDiscountPercent: 10,
    })
    const twice = applyLineDiscountFields(once, 25)
    expect(twice).toMatchObject({
      cartPrice: 60,
      cartListPrice: 80,
      cartDiscountPercent: 25,
    })
  })

  it("restores list price at 0%", () => {
    const discounted = applyLineDiscountFields({ cartPrice: 80 }, 10)
    expect(applyLineDiscountFields(discounted, 0)).toMatchObject({
      cartPrice: 80,
      cartListPrice: 80,
      cartDiscountPercent: 0,
    })
  })
})

describe("clearLineDiscountFields", () => {
  it("treats a price override as the new list price", () => {
    const discounted = applyLineDiscountFields({ cartPrice: 80 }, 10)
    expect(clearLineDiscountFields(discounted, 50)).toMatchObject({
      cartPrice: 50,
      cartListPrice: 50,
      cartDiscountPercent: 0,
    })
  })
})
