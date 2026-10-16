import { hasPosOrderCartSnapshot, posSessionFromOrder } from "@/app/pos/order-session"

const parent = {
  id: "line-1", catalog_item_id: "coffee", name: "Coffee", quantity: 2,
  unit_price: 10, status: "sent", metadata: { client_line_key: "coffee-line" },
  parent_sale_order_item_id: null,
}
const modifier = {
  id: "modifier-1", catalog_item_id: "milk", name: "Milk", quantity: 2,
  unit_price: 1, status: "sent", metadata: { modifier_group_id: "extras" },
  parent_sale_order_item_id: parent.id,
}
const cancelled = {
  ...parent, id: "cancelled-parent", status: "cancelled", catalog_item_id: null,
  name: null, unit_price: null, quantity: null, metadata: null,
}

function snapshot(sale_order_items: unknown[]) {
  return { id: "order-1", status: "pending", sale_order_items }
}

describe("POS order cart snapshot completeness", () => {
  it("requires a usable active parent, not descriptions or cancelled history alone", () => {
    for (const order of [null, {}, snapshot([]), snapshot([cancelled]),
      snapshot([{ name: "Coffee", quantity: 2 }]), snapshot([modifier])]) {
      expect(hasPosOrderCartSnapshot(order)).toBe(false)
    }
    expect(hasPosOrderCartSnapshot(snapshot([parent, modifier]))).toBe(true)
  })

  it("ignores cancelled nullable catalog references without losing usable active lines", () => {
    const order = snapshot([parent, modifier, cancelled, {
      ...cancelled, id: "cancelled-modifier", parent_sale_order_item_id: parent.id,
    }])
    expect(hasPosOrderCartSnapshot(order)).toBe(true)
    const cart = posSessionFromOrder(order, [])?.cart
    expect(cart).toMatchObject([{
      id: "coffee", name: "Coffee", cartQty: 2, cartPrice: 10,
      modifiers: [{ catalogItemId: "milk", name: "Milk", cartQty: 1, cartPrice: 1 }],
    }])
    expect(cart).toHaveLength(1)
    expect(cart?.[0].modifiers).toHaveLength(1)
  })

  it("excludes active children of cancelled parents even if their catalog data is gone", () => {
    const order = snapshot([parent, modifier, cancelled, {
      id: "historical-child", status: "sent", catalog_item_id: null,
      parent_sale_order_item_id: cancelled.id,
    }])
    expect(hasPosOrderCartSnapshot(order)).toBe(true)
    const cart = posSessionFromOrder(order, [])?.cart
    expect(cart).toHaveLength(1)
    expect(cart?.[0].modifiers).toHaveLength(1)
    expect(cart?.[0].modifiers).toMatchObject([{
      groupId: "extras", catalogItemId: "milk", name: "Milk", cartQty: 1,
      cartPrice: 1, backorderQty: 0,
    }])
    expect(hasPosOrderCartSnapshot(snapshot([cancelled, {
      ...modifier, parent_sale_order_item_id: cancelled.id,
    }]))).toBe(false)
  })

  it("accepts stored numeric strings and null metadata", () => {
    expect(hasPosOrderCartSnapshot(snapshot([{
      ...parent, unit_price: "0", quantity: "1.5", metadata: null,
    }]))).toBe(true)
  })

  it.each(["id", "catalog_item_id", "name", "unit_price", "quantity", "metadata", "parent_sale_order_item_id"])(
    "rejects missing %s on active parents and modifiers", (field) => {
      const incompleteParent: Record<string, unknown> = { ...parent }
      const incompleteModifier: Record<string, unknown> = { ...modifier }
      delete incompleteParent[field]
      delete incompleteModifier[field]
      expect(hasPosOrderCartSnapshot(snapshot([incompleteParent]))).toBe(false)
      expect(hasPosOrderCartSnapshot(snapshot([parent, incompleteModifier]))).toBe(false)
    },
  )

  it.each([
    { id: null }, { id: " " }, { catalog_item_id: null }, { catalog_item_id: "" },
    { name: null }, { name: " " }, { name: 1 }, { unit_price: null },
    { unit_price: Infinity }, { unit_price: "invalid" }, { unit_price: " " },
    { unit_price: true }, { unit_price: [] }, { quantity: null }, { quantity: NaN },
    { quantity: Infinity }, { quantity: 0 }, { quantity: -1 }, { quantity: " " },
    { quantity: true }, { metadata: undefined }, { metadata: [] }, { metadata: "invalid" },
    { parent_sale_order_item_id: undefined }, { parent_sale_order_item_id: "" },
    { parent_sale_order_item_id: 1 },
  ])("rejects malformed active data %j", (invalid) => {
    expect(hasPosOrderCartSnapshot(snapshot([{ ...parent, ...invalid }]))).toBe(false)
    expect(hasPosOrderCartSnapshot(snapshot([parent, { ...modifier, ...invalid }]))).toBe(false)
  })

  it("rejects unknown active rows and orphan or nested active modifiers", () => {
    for (const row of [null, [], "invalid", {
      ...modifier, parent_sale_order_item_id: "missing-parent",
    }]) {
      expect(hasPosOrderCartSnapshot(snapshot([parent, row]))).toBe(false)
    }
    expect(hasPosOrderCartSnapshot(snapshot([parent, modifier, {
      ...modifier, id: "nested-modifier", parent_sale_order_item_id: modifier.id,
    }]))).toBe(false)
  })
})