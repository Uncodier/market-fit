import type { PromoBundleData } from "@/app/components/commerce/PromoBundleExperience"

/** Category candidates are choices, not additional required item rows. */
export function selfServicePromotionItems(promo: PromoBundleData) {
  const rows = new Map<string, { id: string; minimum: number }>()
  for (const row of promo.required_items || []) {
    const minimum = Math.max(1, row.min_quantity || 1, rows.get(row.catalog_item_id)?.minimum || 0)
    rows.set(row.catalog_item_id, { id: row.catalog_item_id, minimum })
  }
  for (const item of promo.category_pick_items || []) {
    if (!rows.has(item.id)) rows.set(item.id, { id: item.id, minimum: 0 })
  }
  return [...rows.values()]
}

export function selfServicePromotionCategories(promo: PromoBundleData) {
  const rows = new Map<string, { id: string; name: string; minimum: number }>()
  for (const row of promo.required_categories || []) {
    const previous = rows.get(row.catalog_category_id)
    rows.set(row.catalog_category_id, { id: row.catalog_category_id,
      name: row.category?.name || previous?.name || "Required category",
      minimum: Math.max(1, row.min_quantity || 1, previous?.minimum || 0) })
  }
  return [...rows.values()]
}