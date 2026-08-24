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

/**
 * Walking-distance cutoff for pickup/cash defaults.
 * City or IP location is too coarse to know whether the buyer can actually get to the store.
 */
export const NEARBY_PICKUP_METERS = 500

export type NearbyLocationRef = {
  id?: string
  name?: string
  city?: string
  zip?: string
  is_default?: boolean
  latitude?: string | number | null
  longitude?: string | number | null
}

function parseCoord(value?: string | number | null): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : parseFloat(value)
  return Number.isFinite(n) ? n : null
}

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

function locationCoords(loc: NearbyLocationRef): { lat: number; lon: number } | null {
  const lat = parseCoord(loc.latitude)
  const lon = parseCoord(loc.longitude)
  if (lat == null || lon == null) return null
  return { lat, lon }
}

function buyerCoords(geo?: BuyerGeo | null): { lat: number; lon: number } | null {
  const lat = parseCoord(geo?.latitude)
  const lon = parseCoord(geo?.longitude)
  if (lat == null || lon == null) return null
  return { lat, lon }
}

function isParticularlyCloseToLocation(
  buyerGeo: BuyerGeo | null | undefined,
  loc: NearbyLocationRef
): boolean {
  const from = buyerCoords(buyerGeo)
  const to = locationCoords(loc)
  if (!from || !to) return false
  return haversineKm(from, to) * 1000 <= NEARBY_PICKUP_METERS
}

/**
 * Buyer is close enough to default to store pickup (and cash).
 * Same city is not enough — only a chosen store or coordinates within 500m.
 */
export function isBuyerParticularlyClose(params: {
  buyerGeo?: BuyerGeo | null
  inventoryLocations?: NearbyLocationRef[] | null
  settingsLocations?: NearbyLocationRef[] | null
  selectedLocationId?: string | null
}): boolean {
  if (params.selectedLocationId) return true
  const locations = [
    ...(params.inventoryLocations || []),
    ...(params.settingsLocations || []),
  ]
  if (!params.buyerGeo || locations.length === 0) return false
  return locations.some((loc) => isParticularlyCloseToLocation(params.buyerGeo, loc))
}

/** Prefer a store within 500m; otherwise the default / first location. */
export function pickPreferredPickupLocation<T extends NearbyLocationRef>(
  locations: T[],
  buyerGeo?: BuyerGeo | null
): T | undefined {
  if (!locations.length) return undefined
  const close = locations.find((loc) => isParticularlyCloseToLocation(buyerGeo, loc))
  if (close) return close
  return locations.find((loc) => loc.is_default) || locations[0]
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
