/** Shop category query param helpers (`?category=`). */

export function readShopCategoryFromLocation(): string | null {
  if (typeof window === "undefined") return null
  const value = new URL(window.location.href).searchParams.get("category")
  if (!value || value === "all") return null
  return value
}

export function matchShopCategory(
  param: string | null | undefined,
  categories: string[],
): string | null {
  if (!param || param === "all" || categories.length === 0) return null
  const exact = categories.find((c) => c === param)
  if (exact) return exact
  const lower = param.toLowerCase()
  return categories.find((c) => c.toLowerCase() === lower) || null
}

/** Update `category` in the URL without adding history entries. */
export function writeShopCategoryToLocation(category: string): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (!category || category === "all") {
    if (!url.searchParams.has("category")) return
    url.searchParams.delete("category")
  } else if (url.searchParams.get("category") === category) {
    return
  } else {
    url.searchParams.set("category", category)
  }
  window.history.replaceState({}, "", url.toString())
}
