import type { BuyerGeo } from "@/app/commerce/buyer-geo"
import { normalizeCountry } from "@/app/commerce/location-restrictions"
import { convertAmount } from "@/app/lib/fx"
import { matchesBuyerArea, type RankingCandidate } from "./marketplace-ranking"

export type MarketplaceRegion = { country: string; label: string; count: number }
export type MarketplaceListingFilters = {
  regionCountry?: string
  nearMe?: boolean
  minPrice?: number
  maxPrice?: number
  availableOnly?: boolean
  priceCurrency?: string
}
export type MarketplaceArea = Pick<BuyerGeo, "country" | "city" | "state" | "zip">

let countryNames: Map<string, { country: string; label: string }> | undefined

function knownCountries() {
  if (countryNames) return countryNames
  countryNames = new Map()
  const displayNames = ["en", "es", "pt", "fr", "de"].map(locale => new Intl.DisplayNames([locale], { type: "region" }))
  for (let first = 65; first <= 90; first++) for (let second = 65; second <= 90; second++) {
    const code = String.fromCharCode(first, second)
    const label = displayNames[0].of(code)
    if (!label || label === code || ["ZZ", "XA", "XB"].includes(code)) continue
    const value = { country: normalizeCountry(label), label }
    countryNames.set(normalizeCountry(code), value)
    for (const names of displayNames) {
      const name = names.of(code)
      if (name) countryNames.set(normalizeCountry(name), value)
    }
  }
  return countryNames
}

/** Map real ISO codes/localized country names; exclude placeholders and inferred text. */
export function marketplaceCountry(value?: string | null): { country: string; label: string } | null {
  if (!value?.trim()) return null
  return knownCountries().get(normalizeCountry(value)) || null
}

export function marketplaceRegions(
  items: RankingCandidate[],
  areasBySite: Map<string, MarketplaceArea[]>,
): MarketplaceRegion[] {
  const regions = new Map<string, MarketplaceRegion>()
  for (const item of items) {
    const countries = new Map((areasBySite.get(item.site_id) || []).flatMap(area => {
      const region = marketplaceCountry(area.country)
      return region ? [[region.country, region] as const] : []
    }))
    for (const region of countries.values()) {
      const existing = regions.get(region.country)
      regions.set(region.country, { ...region, count: (existing?.count || 0) + 1 })
    }
  }
  return [...regions.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export function filterMarketplaceGeography<T extends RankingCandidate>(
  items: T[], filters: MarketplaceListingFilters,
  areasBySite: Map<string, MarketplaceArea[]>, buyer?: BuyerGeo,
): T[] {
  const selectedCountry = marketplaceCountry(filters.regionCountry)?.country
  if (!selectedCountry && !filters.nearMe) return items
  return items.filter(item => (areasBySite.get(item.site_id) || []).some(area => {
    if (selectedCountry) return marketplaceCountry(area.country)?.country === selectedCountry
    return matchesBuyerArea(area, buyer)
  }))
}

export function filterMarketplacePrices<T extends RankingCandidate>(
  items: T[], filters: MarketplaceListingFilters, rates: Record<string, number>,
): T[] {
  if (filters.minPrice == null && filters.maxPrice == null) return items
  return items.filter(item => {
    if (item.target_sale_price == null) return false
    const price = convertAmount(Number(item.target_sale_price), item.currency || "USD", filters.priceCurrency || "USD", rates)
    return price != null && Number.isFinite(price) &&
      (filters.minPrice == null || price >= filters.minPrice) &&
      (filters.maxPrice == null || price <= filters.maxPrice)
  })
}