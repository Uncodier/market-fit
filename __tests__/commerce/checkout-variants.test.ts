import {
  VARIANT_SELECTION_REASON,
  shouldSkipVariantSelectionForCheckoutLine,
  variantSelectionBlockReason,
} from "@/app/catalog/product-details"

describe("variant purchasable guard", () => {
  it("blocks parent items that are not purchasable", () => {
    expect(variantSelectionBlockReason({ is_purchasable: false }, 0)).toBe(
      VARIANT_SELECTION_REASON,
    )
  })

  it("blocks legacy parents that still have purchasable children", () => {
    expect(variantSelectionBlockReason({ is_purchasable: true }, 4)).toBe(
      VARIANT_SELECTION_REASON,
    )
  })

  it("allows child variant SKUs", () => {
    expect(
      variantSelectionBlockReason({ is_purchasable: true, parent_id: "parent-1" }, 0),
    ).toBeNull()
  })

  it("allows simple items without variants", () => {
    expect(variantSelectionBlockReason({ is_purchasable: true }, 0)).toBeNull()
    expect(variantSelectionBlockReason({}, 0)).toBeNull()
  })
})

describe("shouldSkipVariantSelectionForCheckoutLine", () => {
  it("skips when attaching a reservation line to an existing booking", () => {
    expect(
      shouldSkipVariantSelectionForCheckoutLine({
        existingReservationId: "res-1",
        reservationStart: "2026-08-26T18:00:00Z",
      }),
    ).toBe(true)
  })

  it("still requires a variant for new cart lines", () => {
    expect(
      shouldSkipVariantSelectionForCheckoutLine({
        reservationStart: "2026-08-26T18:00:00Z",
      }),
    ).toBe(false)
    expect(
      shouldSkipVariantSelectionForCheckoutLine({
        existingReservationId: "res-1",
      }),
    ).toBe(false)
  })
})
