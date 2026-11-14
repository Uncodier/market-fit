import { completePosStockAddition, findPosStockShortage, canResolvePosShortage } from "@/app/pos/stock-shortage"
import { posCartInventoryError, posCartQuantities } from "@/app/pos/cart-availability"
import { kitchenDeltaForSend } from "@/app/commerce/checkout-print-delta"
import type { PosCartItem } from "@/app/pos/cart-types"
import type { CatalogItem } from "@/app/types"

const item = { id: "sku", name: "Item", kind: "product", status: "active", availability_mode: "inventory" } as CatalogItem
const context = { catalogItems: [item], originLocationId: "location",
  inventorySnapshot: { policy: "block" as const, levels: [] } }
const line = { ...item, cartQty: 1, cartPrice: 10, lineKey: "line" } as PosCartItem

it("excludes completed fulfillment without lending its quantity to new demand", () => {
  const completed = { ...line, cartQty: 2, inventoryCompletedQty: 2 }
  expect(posCartInventoryError([completed], context)).toBeNull()
  expect(posCartInventoryError([{ ...completed, cartQty: 3 }], context)).toContain("sold out")
  expect(posCartQuantities([completed, { ...line, lineKey: "new" }]).get("sku")).toBe(1)
})

it("subtracts completed modifier quantities in absolute units", () => {
  const host = { ...line, cartQty: 2, inventoryCompletedQty: 2,
    modifiers: [{ catalogItemId: "sku", groupId: "g", name: "Extra", cartQty: 2, cartPrice: 1, inventoryCompletedQty: 4 }] }
  expect(posCartInventoryError([host], context)).toBeNull()
  expect(posCartQuantities([{ ...host, cartQty: 3 }]).get("sku")).toBe(3)
})

it("detects shortages in modifiers and completes the new host and extras together", () => {
  const host = { ...line, id: "host", availability_mode: "always" as const,
    modifiers: [{ catalogItemId: "sku", groupId: "g", name: "Extra", cartQty: 2, cartPrice: 1 }] }
  const ctx = { ...context, catalogItems: [item, host] }
  expect(findPosStockShortage([host], [], ctx)).toMatchObject({ item: { id: "sku" }, quantity: 2 })
  const result = completePosStockAddition([host], [])
  expect(result[0].completedWithoutStock).toBe(true)
  expect(posCartInventoryError(result, ctx)).toBeNull()
})

it("does not offer unknown/manual/reservation/account/dynamic availability overrides", () => {
  const shortage = { sellable: false, status: "sold_out" as const, availableQty: 0, backorderQty: 0 }
  expect(canResolvePosShortage(item, { ...shortage, status: "unknown" })).toBe(false)
  for (const overrides of [{ availability_mode: "manual" }, { is_reservation: true }, { is_recurring: true }, { is_dynamic_price: true }]) {
    expect(canResolvePosShortage({ ...item, ...overrides } as CatalogItem, shortage)).toBe(false)
  }
})

it("does not send already completed additions to the kitchen", () => {
  expect(kitchenDeltaForSend({ intent: "send", existingItems: [], processedLines: [{
    catalog_item_id: "sku", quantity: 1, name: "Item", completed_without_stock: true,
  }] })).toEqual({ kind: "none", adds: [], qtyChanges: [], voids: [] })
  expect(kitchenDeltaForSend({ intent: "send", existingItems: [], nextItems: [{
    id: "line", catalog_item_id: "sku", quantity: 1, name: "Item", status: "completed",
    metadata: { completed_without_stock: true },
  }] })).toEqual({ kind: "none", adds: [], qtyChanges: [], voids: [] })
})