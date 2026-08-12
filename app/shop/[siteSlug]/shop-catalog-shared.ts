/** Shared shop catalog constants and helpers (client + server safe). */

export const SHOP_PAGE_SIZE = 20
export const SHOP_UNCATEGORIZED_NAME = "Other"
/** Data-cache TTL for public shop fetches (seconds). */
export const SHOP_CACHE_REVALIDATE_SECONDS = 60

export function shopCacheTag(siteId: string): string {
  return `shop:${siteId}`
}

export function shopSlugCacheTag(slug: string): string {
  return `shop-slug:${slug}`
}

export type ShopCategoryOffset = {
  name: string
  offset: number
  count: number
}

export function categoryDomId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `shop-cat-${slug || "other"}`
}

export function groupItemsByCategory<T extends { id: string; _shop?: { categoryName?: string | null } }>(
  items: T[]
): { name: string; items: T[] }[] {
  // Aggregate by category name (first-seen order) so interleaved sort_order
  // cannot create duplicate section keys / DOM ids.
  const order: string[] = []
  const byName = new Map<string, T[]>()

  for (const item of items) {
    const name = item._shop?.categoryName || SHOP_UNCATEGORIZED_NAME
    let bucket = byName.get(name)
    if (!bucket) {
      bucket = []
      byName.set(name, bucket)
      order.push(name)
    }
    bucket.push(item)
  }

  return order.map((name) => ({ name, items: byName.get(name)! }))
}

/** Preserve first-seen order while dropping duplicate category names. */
export function uniqueCategoryNames(names: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const name of names) {
    if (seen.has(name)) continue
    seen.add(name)
    unique.push(name)
  }
  return unique
}

/**
 * Build jump targets: first-seen offset + total item count per category name.
 * Count includes every occurrence (not only the first contiguous run) so chips
 * know when a category is only partially loaded.
 */
export function buildShopCategoryOffsets(categoryNames: string[]): ShopCategoryOffset[] {
  const offsets: ShopCategoryOffset[] = []
  const indexByName = new Map<string, number>()

  for (let i = 0; i < categoryNames.length; i++) {
    const name = categoryNames[i] || SHOP_UNCATEGORIZED_NAME
    const existing = indexByName.get(name)
    if (existing === undefined) {
      indexByName.set(name, offsets.length)
      offsets.push({ name, offset: i, count: 1 })
    } else {
      offsets[existing].count += 1
    }
  }

  return offsets
}
