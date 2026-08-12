/** Marketplace category filter query params (`filter`, `subtype`). */

export const MARKETPLACE_KIND_VALUES = [
  "all",
  "discounts",
  "product",
  "service",
  "digital_asset",
  "recurring",
] as const

export const MARKETPLACE_SUBTYPE_VALUES = [
  "all",
  "course",
  "ticket",
  "pass",
  "license",
  "file",
] as const

const KIND_SET = new Set<string>(MARKETPLACE_KIND_VALUES)
const SUBTYPE_SET = new Set<string>(MARKETPLACE_SUBTYPE_VALUES)

export function parseMarketplaceKind(value: string | null | undefined): string {
  if (value && KIND_SET.has(value)) return value
  return "all"
}

export function parseMarketplaceSubtype(value: string | null | undefined): string {
  if (value && SUBTYPE_SET.has(value)) return value
  return "all"
}

/** Preserve unrelated query params while writing category filters. */
export function buildMarketplaceCategorySearch(
  current: URLSearchParams | string | null | undefined,
  next: { kind: string; subtype: string },
): string {
  const params = new URLSearchParams(
    typeof current === "string" ? current : current?.toString() || "",
  )

  const kind = parseMarketplaceKind(next.kind)
  const subtype =
    kind === "digital_asset" ? parseMarketplaceSubtype(next.subtype) : "all"

  if (kind === "all") params.delete("filter")
  else params.set("filter", kind)

  if (subtype === "all") params.delete("subtype")
  else params.set("subtype", subtype)

  return params.toString()
}
