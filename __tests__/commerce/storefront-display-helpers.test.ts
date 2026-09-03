import {
  getInventoryDisplayRule,
  isLowStockUrgent,
} from "../../app/commerce/storefront-display-helpers"
import { CatalogItem } from "../../app/types"

describe("isLowStockUrgent", () => {
  it("is not urgent when remaining is 0", () => {
    expect(isLowStockUrgent(0, 40)).toBe(false)
  })

  it("uses a leftover of 5 when capacity is unknown", () => {
    expect(isLowStockUrgent(6)).toBe(false)
    expect(isLowStockUrgent(5)).toBe(true)
  })

  it("turns red at 20% of seat or ticket capacity, with a floor of 5", () => {
    expect(isLowStockUrgent(38, 40)).toBe(false)
    expect(isLowStockUrgent(8, 40)).toBe(true)
    expect(isLowStockUrgent(3, 10)).toBe(true)
    expect(isLowStockUrgent(6, 10)).toBe(false)
  })
})

describe("getInventoryDisplayRule", () => {
  const baseItem = {
    id: "1",
    site_id: "s1",
    kind: "product",
    name: "Test",
    track_inventory: true,
    availability_mode: "inventory",
    availability_status: "available",
    status: "active",
    sort_order: 0,
    is_pos_available: false,
    is_recurring: false,
    is_reservation: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as CatalogItem

  it("returns none by default", () => {
    expect(getInventoryDisplayRule(baseItem, {})).toEqual({ type: 'none' })
  })

  it("shows only_left when availableQty <= 5 and no showSeller (current legacy behavior)", () => {
    expect(getInventoryDisplayRule(baseItem, { availableQty: 3 }, false)).toEqual({
      type: 'only_left',
      count: 3,
      isUrgent: true,
    })
  })

  it("hides only_left when availableQty <= 5 but showSeller is true (legacy behavior)", () => {
    expect(getInventoryDisplayRule(baseItem, { availableQty: 3 }, true)).toEqual({ type: 'none' })
  })

  it("shows only_left even when > 5 if show_available_inventory is true", () => {
    const itemWithFlag = {
      ...baseItem,
      metadata: { show_available_inventory: true }
    }
    expect(getInventoryDisplayRule(itemWithFlag, { availableQty: 10 }, false)).toEqual({
      type: 'only_left',
      count: 10,
      isUrgent: false,
    })
  })

  it("shows only_left even if showSeller is true when show_available_inventory is true", () => {
    const itemWithFlag = {
      ...baseItem,
      metadata: { show_available_inventory: true }
    }
    expect(getInventoryDisplayRule(itemWithFlag, { availableQty: 2 }, true)).toEqual({
      type: 'only_left',
      count: 2,
      isUrgent: true,
    })
  })

  it("compares leftover tickets against remaining plus sold quantity", () => {
    const ticket = {
      ...baseItem,
      kind: "digital_asset",
      digital_subtype: "ticket",
      metadata: { show_available_inventory: true },
    } as CatalogItem
    expect(getInventoryDisplayRule(ticket, { availableQty: 38, soldQty: 2 })).toEqual({
      type: "only_left",
      count: 38,
      isUrgent: false,
    })
    expect(getInventoryDisplayRule(ticket, { availableQty: 7, soldQty: 33 })).toEqual({
      type: "only_left",
      count: 7,
      isUrgent: true,
    })
  })

  it("shows spots_left for reservations with nextSlotAvailable and show_available_inventory=true", () => {
    const resItem = {
      ...baseItem,
      is_reservation: true,
      metadata: { show_available_inventory: true }
    }
    expect(getInventoryDisplayRule(resItem, { nextSlotAvailable: 4 }, false)).toEqual({
      type: 'spots_left',
      count: 4,
      isUrgent: true,
    })
  })

  it("keeps reservation leftover muted when the next slot is still mostly open", () => {
    const resItem = {
      ...baseItem,
      is_reservation: true,
      metadata: { show_available_inventory: true }
    }
    expect(getInventoryDisplayRule(resItem, {
      nextSlotAvailable: 18,
      nextSlotCapacity: 20,
    })).toEqual({
      type: "spots_left",
      count: 18,
      isUrgent: false,
    })
  })

  it("falls back to none if reservation but nextSlotAvailable is 0", () => {
    const resItem = {
      ...baseItem,
      is_reservation: true,
      metadata: { show_available_inventory: true }
    }
    expect(getInventoryDisplayRule(resItem, { nextSlotAvailable: 0 }, false)).toEqual({ type: 'none' })
  })
})
