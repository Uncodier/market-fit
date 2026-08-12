import type { CatalogItem, Location } from "@/app/types"
import type { BuyerGeo } from "@/app/commerce/buyer-geo"
import { getItemPickupLocationIds } from "@/app/commerce/delivery-options"
import {
  evaluateLocationRestrictions,
  type Address,
} from "@/app/commerce/location-restrictions"

export type SettingsLocation = {
  name?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  restrictions?: {
    enabled?: boolean
    included_addresses?: Address[]
    excluded_addresses?: Address[]
  }
}

function normalize(str?: string): string {
  return (str || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

export function buyerGeoToAddress(geo?: BuyerGeo | null): Address {
  if (!geo) return {}
  return {
    city: geo.city,
    state: geo.state,
    country: geo.country,
    zip: geo.zip,
  }
}

export function formatBuyerLocationLabel(
  geo?: BuyerGeo | null,
  fallback = "Set location"
): string {
  if (geo?.city) return geo.city
  if (geo?.country) return geo.country
  return fallback
}

/** True when buyer city matches a site office / inventory location name or city. */
export function buyerMatchesSiteLocations(
  buyerGeo: BuyerGeo | null | undefined,
  siteLocations: Array<{ name?: string; city?: string }> | null | undefined
): boolean {
  const city = normalize(buyerGeo?.city)
  if (!city || !siteLocations?.length) return false
  return siteLocations.some((l) => {
    const lc = normalize(l.city)
    const ln = normalize(l.name)
    return (lc && lc === city) || (ln && ln === city)
  })
}

/** Shop pill: multi inventory stores OR settings geo needs relocate. */
export function shouldShowShopLocationPill(params: {
  inventoryLocations: Array<Pick<Location, "id" | "is_active">>
  settingsLocations?: SettingsLocation[] | null
  buyerGeo?: BuyerGeo | null
}): boolean {
  const active = (params.inventoryLocations || []).filter((l) => l.is_active !== false)
  if (active.length > 1) return true

  const settings = params.settingsLocations || []
  const hasEnabled = settings.some((l) => l.restrictions?.enabled)
  if (!hasEnabled) return false

  const address = buyerGeoToAddress(params.buyerGeo)
  if (!address.country && !address.city && !address.zip) return true

  if (buyerMatchesSiteLocations(params.buyerGeo, settings)) return false

  const { available } = evaluateLocationRestrictions(settings, address)
  return !available
}

/**
 * Site-level: current location context is outside service area (chip turns red).
 * Store selection counts as compatible for the branch itself.
 */
export function isBuyerLocationIncompatible(params: {
  settingsLocations?: SettingsLocation[] | null
  inventoryLocations?: Array<{ name?: string; city?: string }> | null
  buyerGeo?: BuyerGeo | null
  selectedLocationId?: string | null
}): boolean {
  if (params.selectedLocationId) return false

  const settings = params.settingsLocations || []
  if (!settings.length) return false

  const address = buyerGeoToAddress(params.buyerGeo)
  if (!address.country && !address.city && !address.zip) return false

  if (buyerMatchesSiteLocations(params.buyerGeo, settings)) return false
  if (buyerMatchesSiteLocations(params.buyerGeo, params.inventoryLocations)) return false

  return !evaluateLocationRestrictions(settings, address).available
}

export function isItemLocationAvailable(params: {
  item: Partial<CatalogItem>
  settingsLocations?: SettingsLocation[] | null
  inventoryLocations?: Array<{ name?: string; city?: string }> | null
  buyerGeo?: BuyerGeo | null
  selectedLocationId?: string | null
}): boolean {
  const selectedId = params.selectedLocationId

  // Browsing a specific store: stock/pickup scope only.
  if (selectedId) {
    const pickupIds = getItemPickupLocationIds(params.item)
    if (pickupIds.length > 0 && !pickupIds.includes(selectedId)) {
      return false
    }
    return true
  }

  const settings = params.settingsLocations || []
  if (settings.length > 0) {
    const address = buyerGeoToAddress(params.buyerGeo)
    if (address.country || address.city || address.zip) {
      // Buyer is at a city where the business has a presence
      if (
        buyerMatchesSiteLocations(params.buyerGeo, settings) ||
        buyerMatchesSiteLocations(params.buyerGeo, params.inventoryLocations)
      ) {
        return true
      }
      const geo = evaluateLocationRestrictions(settings, address)
      if (!geo.available) return false
    }
  }

  return true
}
