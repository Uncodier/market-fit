import {
  SHORT_ITEM_DESCRIPTION_CHARS,
  hasPdpProductDetails,
  isShortItemDescription,
} from "@/app/components/commerce/pdp/pdp-item-description"

describe("isShortItemDescription", () => {
  it("treats empty copy as short so the below-the-fold About section is skipped", () => {
    expect(isShortItemDescription(null)).toBe(true)
    expect(isShortItemDescription("")).toBe(true)
    expect(isShortItemDescription("   ")).toBe(true)
  })

  it("treats food-style one-liners as short", () => {
    const food =
      "Orden de 4 tacos de milanesa de pollo sobre tortilla hechas a mano frita."
    expect(food.length).toBeLessThanOrEqual(SHORT_ITEM_DESCRIPTION_CHARS)
    expect(isShortItemDescription(food)).toBe(true)
  })

  it("treats retail-length copy as long", () => {
    const long = "A".repeat(SHORT_ITEM_DESCRIPTION_CHARS + 1)
    expect(isShortItemDescription(long)).toBe(false)
  })

  it("uses the trimmed length at the threshold", () => {
    const atLimit = "B".repeat(SHORT_ITEM_DESCRIPTION_CHARS)
    expect(isShortItemDescription(`  ${atLimit}  `)).toBe(true)
  })
})

describe("hasPdpProductDetails", () => {
  it("hides the below-the-fold block for short copy with no attrs or specs", () => {
    expect(
      hasPdpProductDetails({
        description: "Order of 4 chicken milanesa tacos.",
        attrCount: 0,
        specCount: 0,
      }),
    ).toBe(false)
  })

  it("shows the block for long copy even without attrs", () => {
    expect(
      hasPdpProductDetails({
        description: "C".repeat(SHORT_ITEM_DESCRIPTION_CHARS + 1),
        attrCount: 0,
        specCount: 0,
      }),
    ).toBe(true)
  })
})
