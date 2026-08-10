/** Shared shop catalog constants and helpers (client + server safe). */

export const SHOP_PAGE_SIZE = 20
export const SHOP_UNCATEGORIZED_NAME = "Other"

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
  const sections: { name: string; items: T[] }[] = []
  let current: { name: string; items: T[] } | null = null

  for (const item of items) {
    const name = item._shop?.categoryName || SHOP_UNCATEGORIZED_NAME
    if (!current || current.name !== name) {
      current = { name, items: [] }
      sections.push(current)
    }
    current.items.push(item)
  }

  return sections
}
