import type { CatalogItem } from "@/app/types"
import type { PosCartItem } from "@/app/pos/cart-types"
import {
  annotatePosCartInventory, posCartInventoryError, posCatalogItemAvailability, posCartQuantities,
  type PosCartInventoryContext,
} from "@/app/pos/cart-availability"

const item = (id = "sku", overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id, name: id, status: "active", availability_mode: "inventory", track_inventory: true,
  availability_status: "available", is_pos_available: true, ...overrides,
} as CatalogItem)
const line = (id = "sku", cartQty = 1, lineKey = "line"): PosCartItem => ({
  ...item(id), cartQty, lineKey, cartPrice: 10,
})
const context = (overrides: Partial<PosCartInventoryContext> = {}): PosCartInventoryContext => ({
  catalogItems: [item(), item("extra")], originLocationId: "store-a",
  inventorySnapshot: { policy: "block", levels: [
    { catalog_item_id: "sku", location_id: "store-a", quantity: 2 },
    { catalog_item_id: "sku", location_id: "store-b", quantity: 8 },
    { catalog_item_id: "extra", location_id: "store-a", quantity: 1 },
  ] }, ...overrides,
})

describe("POS cart stock", () => {
  it("counts duplicate SKU lines and extras against a shared quantity", () => {
    const cart = [line("sku", 2), { ...line("extra", 1, "second"), modifiers: [
      { groupId: "g", catalogItemId: "sku", name: "SKU extra", cartQty: 2, cartPrice: 1 },
    ] }]
    expect(posCartQuantities(cart).get("sku")).toBe(4)
    expect(posCartInventoryError(cart, context())).toContain("sku")
  })

  it("marks an exhausted card sold out using the whole cart", () => {
    expect(posCatalogItemAvailability(item(), [line("sku", 2)], context()).status).toBe("sold_out")
    expect(posCatalogItemAvailability(item(), [line("sku", 2)], context({ originLocationId: "" })).status).toBe("available")
  })

  it("blocks increases but allows reductions after switching to a sold-out location", () => {
    const ctx = context({ originLocationId: "missing" })
    expect(posCartInventoryError([line("sku", 3)], ctx, [line("sku", 2)])).toBeTruthy()
    expect(posCartInventoryError([line("sku", 1)], ctx, [line("sku", 2)])).toBeNull()
    expect(posCartInventoryError([], ctx, [line("sku", 2)])).toBeNull()
    expect(posCartInventoryError([line("sku", 1)], ctx)).toBeTruthy()
  })

  it.each([NaN, Infinity])("rejects non-finite quantities: %s", (quantity) => {
    expect(posCartInventoryError([line("sku", quantity)], context())).toMatch(/finite/)
  })

  it("shows a parent with available variants even when the parent has no stock", () => {
    const parent = item("parent")
    const child = item("sku", { parent_id: "parent" })
    const ctx = context({ catalogItems: [parent, child] })
    expect(posCatalogItemAvailability(parent, [], ctx).status).toBe("available")
    expect(posCatalogItemAvailability(parent, [line("sku", 2)], ctx).status).toBe("sold_out")
    expect(posCatalogItemAvailability({ ...parent, availability_mode: "manual", availability_status: "unavailable" }, [], {
      ...ctx, catalogItems: [{ ...parent, availability_mode: "manual", availability_status: "unavailable" }, child],
    }).sellable).toBe(false)
  })

  it("allocates only the shortage as backorder across lines and removes it after replenishment", () => {
    const ctx = context()
    ctx.inventorySnapshot!.policy = "warn"
    const cart = [line("sku", 2), line("sku", 3, "second")]
    const result = annotatePosCartInventory(cart, ctx)
    expect(result.map((entry) => entry.backorderQty)).toEqual([0, 3])
    expect(posCartInventoryError(cart, ctx)).toBeNull()
    ctx.inventorySnapshot!.levels[0].quantity = 5
    expect(annotatePosCartInventory(result, ctx).map((entry) => entry.backorderQty)).toEqual([0, 0])
  })

  it("blocks unknown inventory, including missing modifier catalog data", () => {
    expect(posCartInventoryError([line()], context({ inventorySnapshot: null }))).toBeTruthy()
    const cart = [{ ...line(), modifiers: [
      { groupId: "g", catalogItemId: "missing", name: "Missing", cartQty: 1, cartPrice: 1 },
    ] }]
    expect(posCartInventoryError(cart, context())).toContain("unknown")
  })

  it("does not trust an old cart's availability after the SKU leaves the catalog", () => {
    const cart = [{ ...line(), availability_mode: "always" as const }]
    expect(posCartInventoryError(cart, context({ catalogItems: [] }))).toContain("unknown")
    expect(posCartInventoryError([], context({ catalogItems: [] }), cart)).toBeNull()
  })
})