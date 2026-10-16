import type { CatalogItem } from "@/app/types"

export function shopItem(id: string, categoryName: string, sortOrder = 0): CatalogItem {
  return {
    id,
    name: id,
    site_id: "site",
    kind: "product",
    track_inventory: false,
    availability_mode: "always",
    availability_status: "available",
    status: "active",
    sort_order: sortOrder,
    is_pos_available: true,
    is_recurring: false,
    is_reservation: false,
    created_at: "2026-10-16T00:00:00Z",
    updated_at: "2026-10-16T00:00:00Z",
    _shop: { categoryName, sellable: true },
  }
}