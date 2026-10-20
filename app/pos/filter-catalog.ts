import type { CatalogItem } from "@/app/types"
import { moveUncategorizedCatalogItemsToEnd } from "./catalog-alphabet"

export function filterLocalPosCatalog(source: CatalogItem[], catalog: CatalogItem[], query: string, category: string) {
  const q = query.trim().toLowerCase()
  let items = source.filter(item => !item.parent_id)
  if (q) items = items.filter(item => item.name?.toLowerCase().includes(q) || item.sku?.toLowerCase().includes(q))
  if (category !== "all" && category !== "unavailable") {
    items = items.filter(item => category.startsWith("kind_") ? item.kind === category.slice(5) : item.category_id === category)
  }
  return moveUncategorizedCatalogItemsToEnd(items).map(item => {
    const children = catalog.filter(child => child.parent_id === item.id && child.status === "active" && child.is_purchasable !== false)
    if (!children.length) return item
    const variantLabels = children.slice(0, 4).map(child => {
      const prefix = `${item.name || ""} / `
      return child.name?.startsWith(prefix) ? child.name.slice(prefix.length) : child.name || ""
    }).filter(Boolean)
    return { ...item, _shop: { ...item._shop, variantLabels } }
  })
}