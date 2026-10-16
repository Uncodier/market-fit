import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { RankingCandidate } from "./marketplace-ranking"
import { readAllRows } from "./load-marketplace-sales"

export type AvailabilityCandidate = RankingCandidate & {
  availability_mode?: string | null
  availability_status?: string | null
  is_purchasable?: boolean | null
}

/** In-stock filter includes purchasable variants, not inventory backorders. */
export async function filterMarketplaceAvailability<T extends AvailabilityCandidate>(supabase: SupabaseClient, items: T[]) {
  const available = new Set<string>()
  for (let index = 0; index < items.length; index += 100) {
    const batch = items.slice(index, index + 100)
    const byId = new Map(batch.map(item => [item.id, item]))
    const children = await readAllRows<Omit<AvailabilityCandidate, "created_at"> & { parent_id: string }>((from, to) =>
      supabase.from("catalog_items").select("id, site_id, parent_id, availability_mode, availability_status, is_purchasable")
        .in("parent_id", batch.map(item => item.id)).eq("status", "active").eq("is_purchasable", true)
        .order("id").range(from, to))
    const ownChildren = children.filter(child => child.site_id === byId.get(child.parent_id)?.site_id)
    const all = [...batch, ...ownChildren]
    const inventory = new Map<string, number>()
    for (let offset = 0; offset < all.length; offset += 100) {
      const ids = all.slice(offset, offset + 100).map(item => item.id)
      const rows = await readAllRows<{ catalog_item_id: string; site_id: string; quantity: number }>((from, to) =>
        supabase.from("inventory_levels").select("catalog_item_id, site_id, quantity")
          .in("catalog_item_id", ids).order("id").range(from, to))
      const siteByItem = new Map(all.map(item => [item.id, item.site_id]))
      for (const row of rows) {
        if (row.site_id !== siteByItem.get(row.catalog_item_id)) continue
        inventory.set(row.catalog_item_id, (inventory.get(row.catalog_item_id) || 0) + Number(row.quantity || 0))
      }
    }
    const inStock = (item: Omit<AvailabilityCandidate, "created_at">) => {
      if (item.availability_mode === "manual") return item.availability_status === "available"
      if (item.availability_mode === "inventory") return (inventory.get(item.id) || 0) > 0
      return true
    }
    for (const item of batch) {
      const variants = ownChildren.filter(child => child.parent_id === item.id)
      if (variants.length ? variants.some(inStock) : item.is_purchasable !== false && inStock(item)) available.add(item.id)
    }
  }
  return items.filter(item => available.has(item.id))
}