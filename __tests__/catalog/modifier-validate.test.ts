import {
  validateModifierSelections,
  buildModifierSignature,
} from "@/app/catalog/modifier-validate"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"

const extrasGroup: ModifierGroupWithItems = {
  id: "g1",
  site_id: "s1",
  name: "Coffee extras",
  min_select: 0,
  max_select: 3,
  sort_order: 0,
  items: [
    {
      id: "gi1",
      catalog_item_id: "shot",
      sort_order: 0,
      name: "Extra shot",
      price: 15,
    },
    {
      id: "gi2",
      catalog_item_id: "syrup",
      sort_order: 1,
      name: "Syrup",
      price: 15,
    },
  ],
}

const milkGroup: ModifierGroupWithItems = {
  id: "g2",
  site_id: "s1",
  name: "Milk",
  min_select: 1,
  max_select: 1,
  sort_order: 1,
  items: [
    {
      id: "gi3",
      catalog_item_id: "almond",
      sort_order: 0,
      name: "Almond milk",
      price: 15,
    },
  ],
}

describe("validateModifierSelections", () => {
  it("allows empty optional groups", () => {
    const result = validateModifierSelections([extrasGroup], [])
    expect(result.ok).toBe(true)
  })

  it("enforces min_select", () => {
    const result = validateModifierSelections([milkGroup], [])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.groupId).toBe("g2")
      expect(result.error).toMatch(/at least 1/i)
    }
  })

  it("enforces max_select across quantities", () => {
    const result = validateModifierSelections([extrasGroup], [
      { groupId: "g1", catalogItemId: "shot", quantity: 2 },
      { groupId: "g1", catalogItemId: "syrup", quantity: 2 },
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/at most 3/i)
  })

  it("rejects unknown option in group", () => {
    const result = validateModifierSelections([extrasGroup], [
      { groupId: "g1", catalogItemId: "unknown", quantity: 1 },
    ])
    expect(result.ok).toBe(false)
  })

  it("accepts valid multi-group selection", () => {
    const result = validateModifierSelections([extrasGroup, milkGroup], [
      { groupId: "g1", catalogItemId: "shot", quantity: 1 },
      { groupId: "g2", catalogItemId: "almond", quantity: 1 },
    ])
    expect(result.ok).toBe(true)
  })
})

describe("buildModifierSignature", () => {
  it("is stable regardless of modifier order", () => {
    const a = buildModifierSignature("latte", [
      { catalogItemId: "syrup", quantity: 1 },
      { catalogItemId: "shot", quantity: 2 },
    ])
    const b = buildModifierSignature("latte", [
      { catalogItemId: "shot", quantity: 2 },
      { catalogItemId: "syrup", quantity: 1 },
    ])
    expect(a).toBe(b)
  })
})
