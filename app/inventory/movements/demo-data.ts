import type { InventoryMovement } from "./types"

// Explicit, read-only UI preview data. Never returned by a backend action.
export const demoLocations = [
  { id: "demo-warehouse", name: "Main Warehouse" },
  { id: "demo-store", name: "Downtown Store" },
  { id: "demo-outlet", name: "North Outlet" },
  { id: "demo-distribution", name: "Distribution Center" },
]

export const demoItems = [
  { id: "demo-coffee", name: "Coffee Beans", sku: "COF-001" },
  { id: "demo-mug", name: "Ceramic Mug", sku: "MUG-002" },
  { id: "demo-tea", name: "Green Tea", sku: "TEA-003" },
]

export const demoMembers = [
  { id: "demo-member-alex", name: "Alex Morgan" },
  { id: "demo-member-jordan", name: "Jordan Lee" },
]

export const demoMovements: InventoryMovement[] = Array.from({ length: 8 }, (_, index) => {
  const item = demoItems[index % demoItems.length]
  const from = demoLocations[index % demoLocations.length]
  const to = demoLocations[(index + 1) % demoLocations.length]
  return {
    id: `demo-movement-${index + 1}`,
    created_at: `2026-11-${String(13 - index).padStart(2, "0")}T10:00:00Z`,
    catalog_item_id: item.id,
    item_name: item.name,
    from_location_id: from.id,
    to_location_id: to.id,
    from_location_name: from.name,
    to_location_name: to.name,
    quantity: (index + 1) * 5,
    kind: "transfer",
    notes: index === 0 ? "Weekly store replenishment" : null,
    purchase_id: null,
    receiving_user_id: index % 3 === 0 ? null : demoMembers[index % demoMembers.length].id,
    receiving_user_name: index % 3 === 0 ? null : demoMembers[index % demoMembers.length].name,
  }
})