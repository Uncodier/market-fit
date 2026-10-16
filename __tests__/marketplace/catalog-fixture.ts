import type { MarketplaceItem } from "@/app/marketplace/MarketplaceCatalog"

export function marketplaceItem(id: string): MarketplaceItem {
  return {
    id, site_id: "seller-one", site: { id: "seller-one", name: "Seller" }, name: id,
    kind: "product", target_sale_price: 10, track_inventory: false,
    availability_mode: "always", availability_status: "available", status: "active",
    sort_order: 0, is_pos_available: true, is_recurring: false, is_reservation: false,
    created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
  }
}