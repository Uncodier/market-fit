import type { MarketplaceListingFilters } from "./marketplace-product-filters"
import { marketplaceCountry } from "./marketplace-product-filters"

const FILTER_KEYS = ["regionCountry", "nearMe", "minPrice", "maxPrice", "availableOnly", "priceCurrency"] as const
type SearchSource = { toString(): string } | string | null | undefined

export function parseMarketplacePrice(value: string | null | undefined): number | undefined {
  if (!value?.trim()) return undefined
  const price = Number(value)
  return Number.isFinite(price) && price >= 0 && price <= 1e9 ? price : undefined
}

/** Listing geography never changes the buyer's address or checkout geography. */
export function parseMarketplaceListingFilters(current: SearchSource): MarketplaceListingFilters {
  const params = new URLSearchParams(current?.toString() || "")
  const nearMe = params.get("nearMe") === "true"
  const regionCountry = marketplaceCountry(params.get("regionCountry"))?.country
  let minPrice = parseMarketplacePrice(params.get("minPrice"))
  let maxPrice = parseMarketplacePrice(params.get("maxPrice"))
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    minPrice = undefined
    maxPrice = undefined
  }
  const currency = params.get("priceCurrency")?.trim().toUpperCase()
  return {
    ...(nearMe ? { nearMe: true } : regionCountry ? { regionCountry } : {}),
    ...(minPrice !== undefined ? { minPrice } : {}),
    ...(maxPrice !== undefined ? { maxPrice } : {}),
    ...(params.get("availableOnly") === "true" ? { availableOnly: true } : {}),
    ...((minPrice !== undefined || maxPrice !== undefined) && currency && /^[A-Z]{3}$/.test(currency)
      ? { priceCurrency: currency } : {}),
  }
}

/** Replace only listing filters, keeping category, sort, buyer location and cart params. */
export function buildMarketplaceListingFilterSearch(current: SearchSource, filters: MarketplaceListingFilters): string {
  const params = new URLSearchParams(current?.toString() || "")
  for (const key of FILTER_KEYS) params.delete(key)
  const requested = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    const value = filters[key]
    if (value !== undefined && value !== false && value !== "") requested.set(key, String(value))
  }
  const normalized = parseMarketplaceListingFilters(requested)
  for (const key of FILTER_KEYS) {
    const value = normalized[key]
    if (value !== undefined) params.set(key, String(value))
  }
  return params.toString()
}