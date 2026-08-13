import {
  computeKitchenDelta,
  kitchenDeltaHasWork,
  type DeltaLineInput,
} from "../../../lib/printer/core/order-delta"

function line(
  partial: Partial<DeltaLineInput> & Pick<DeltaLineInput, "key" | "name" | "quantity">,
): DeltaLineInput {
  return {
    catalogItemId: partial.catalogItemId ?? partial.key,
    ...partial,
  }
}

describe("computeKitchenDelta", () => {
  it("returns a full ticket on first send", () => {
    const next = [
      line({ key: "burger", name: "Burger", quantity: 2 }),
      line({
        key: "burger:mod:cheese",
        name: "Cheese",
        quantity: 2,
        parentKey: "burger",
        isModifier: true,
      }),
    ]
    const delta = computeKitchenDelta([], next)
    expect(delta.kind).toBe("full")
    expect(delta.adds).toHaveLength(1)
    expect(delta.adds[0].name).toBe("Burger")
    expect(delta.adds[0].modifiers?.[0].name).toBe("Cheese")
    expect(kitchenDeltaHasWork(delta)).toBe(true)
  })

  it("adds a new line on later send", () => {
    const existing = [
      line({ key: "burger", name: "Burger", quantity: 1, status: "new", itemId: "1" }),
    ]
    const next = [
      line({ key: "burger", name: "Burger", quantity: 1 }),
      line({ key: "fries", name: "Fries", quantity: 1 }),
    ]
    const delta = computeKitchenDelta(existing, next)
    expect(delta.kind).toBe("delta")
    expect(delta.adds.map((a) => a.name)).toEqual(["Fries"])
    expect(delta.qtyChanges).toHaveLength(0)
    expect(delta.voids).toHaveLength(0)
  })

  it("records quantity increases and decreases", () => {
    const existing = [
      line({ key: "burger", name: "Burger", quantity: 2, status: "new", itemId: "1" }),
    ]
    const next = [line({ key: "burger", name: "Burger", quantity: 3 })]
    const up = computeKitchenDelta(existing, next)
    expect(up.kind).toBe("delta")
    expect(up.qtyChanges[0]).toMatchObject({ from: 2, to: 3 })

    const down = computeKitchenDelta(existing, [
      line({ key: "burger", name: "Burger", quantity: 1 }),
    ])
    expect(down.qtyChanges[0]).toMatchObject({ from: 2, to: 1 })
  })

  it("voids sent lines removed from the cart", () => {
    const existing = [
      line({ key: "burger", name: "Burger", quantity: 1, status: "new", itemId: "1" }),
      line({ key: "fries", name: "Fries", quantity: 1, status: "preparing", itemId: "2" }),
    ]
    const next = [line({ key: "burger", name: "Burger", quantity: 1 })]
    const delta = computeKitchenDelta(existing, next)
    expect(delta.kind).toBe("delta")
    expect(delta.voids.map((v) => v.name)).toEqual(["Fries"])
  })

  it("does not void draft-only removals", () => {
    const existing = [
      line({ key: "burger", name: "Burger", quantity: 1, status: "new", itemId: "1" }),
      line({ key: "draft", name: "Draft item", quantity: 1, status: "draft", itemId: "2" }),
    ]
    const next = [line({ key: "burger", name: "Burger", quantity: 1 })]
    const delta = computeKitchenDelta(existing, next)
    expect(delta.voids).toHaveLength(0)
    expect(delta.kind).toBe("none")
  })

  it("excludes draft lines from a first-send full ticket", () => {
    const next = [
      line({ key: "draft", name: "Draft item", quantity: 1, status: "draft" }),
      line({ key: "burger", name: "Burger", quantity: 1, status: "new" }),
    ]
    const delta = computeKitchenDelta([], next)
    expect(delta.kind).toBe("full")
    expect(delta.adds.map((a) => a.name)).toEqual(["Burger"])
  })

  it("has no kitchen work when the first snapshot is draft-only", () => {
    const next = [
      line({ key: "draft", name: "Draft item", quantity: 1, status: "draft" }),
    ]
    const delta = computeKitchenDelta([], next)
    expect(delta.kind).toBe("full")
    expect(kitchenDeltaHasWork(delta)).toBe(false)
  })

  it("treats a previously draft line as an add when sent", () => {
    const existing = [
      line({ key: "burger", name: "Burger", quantity: 1, status: "new", itemId: "1" }),
      line({ key: "fries", name: "Fries", quantity: 1, status: "draft", itemId: "2" }),
    ]
    const next = [
      line({ key: "burger", name: "Burger", quantity: 1 }),
      line({ key: "fries", name: "Fries", quantity: 1 }),
    ]
    const delta = computeKitchenDelta(existing, next)
    expect(delta.adds.map((a) => a.name)).toEqual(["Fries"])
  })
})
