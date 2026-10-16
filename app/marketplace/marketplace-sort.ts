/** Sort values shared by marketplace controls and product requests. */
export const MARKETPLACE_SORT_VALUES = [
  "featured",
  "best_selling",
  "newest",
  "price_asc",
  "price_desc",
] as const

export type MarketplaceSort = (typeof MARKETPLACE_SORT_VALUES)[number]

export function parseMarketplaceSort(value: string | null | undefined): MarketplaceSort {
  return MARKETPLACE_SORT_VALUES.find((sort) => sort === value) || "featured"
}

/** Only change sort; keep category, location, cart and checkout query params. */
export function buildMarketplaceSortSearch(
  current: { toString(): string } | string | null | undefined,
  next: string,
): string {
  const params = new URLSearchParams(current?.toString() || "")
  const sort = parseMarketplaceSort(next)
  if (sort === "featured") params.delete("sort")
  else params.set("sort", sort)
  return params.toString()
}