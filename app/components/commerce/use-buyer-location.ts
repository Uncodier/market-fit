"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { BuyerGeo } from "@/app/commerce/buyer-geo"
import type { Location } from "@/app/types"
import {
  formatBuyerLocationLabel,
  shouldShowShopLocationPill,
  type SettingsLocation,
} from "@/app/commerce/buyer-location-availability"
import type { GeocodedPlace } from "@/app/commerce/geocode-search"

type StoredOverride = {
  geo?: BuyerGeo
  selectedLocationId?: string | null
  selectedLocationName?: string | null
}

function storageKey(scope: string) {
  return `buyer-location:${scope}`
}

function placeToBuyerGeo(place: GeocodedPlace): BuyerGeo {
  return {
    latitude: String(place.lat),
    longitude: String(place.lon),
    city: place.city,
    state: place.state,
    // Prefer full country name for settings match; fall back to ISO code
    country: place.country || place.countryCode,
    zip: place.zip,
  }
}

function readStored(scope: string): StoredOverride | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(storageKey(scope))
    if (!raw) return null
    return JSON.parse(raw) as StoredOverride
  } catch {
    return null
  }
}

function writeStored(scope: string, value: StoredOverride | null) {
  if (typeof window === "undefined") return
  try {
    if (!value) sessionStorage.removeItem(storageKey(scope))
    else sessionStorage.setItem(storageKey(scope), JSON.stringify(value))
  } catch {
    // ignore quota / private mode
  }
}

export function useBuyerLocation(params: {
  scope: string
  initialGeo?: BuyerGeo | null
  /** Shop inventory locations for multi-store picker */
  inventoryLocations?: Location[]
  settingsLocations?: SettingsLocation[] | null
  /** When true, pill always shows (marketplace). */
  alwaysShowPill?: boolean
  setLocationFallback?: string
}) {
  const {
    scope,
    initialGeo,
    inventoryLocations = [],
    settingsLocations = null,
    alwaysShowPill = false,
    setLocationFallback = "Set location",
  } = params

  const [overrideGeo, setOverrideGeo] = useState<BuyerGeo | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [selectedLocationName, setSelectedLocationName] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    const stored = readStored(scope)
    if (stored?.geo && (stored.geo.city || stored.geo.country || stored.geo.zip)) {
      setOverrideGeo(stored.geo)
    }
    if (stored?.selectedLocationId) {
      setSelectedLocationId(stored.selectedLocationId)
      setSelectedLocationName(stored.selectedLocationName || null)
    }
    setHydrated(true)
  }, [scope])

  const effectiveBuyerGeo = overrideGeo || initialGeo || undefined

  useEffect(() => {
    if (!hydrated) return
    if (!overrideGeo && !selectedLocationId) {
      writeStored(scope, null)
      return
    }
    writeStored(scope, {
      geo: overrideGeo || undefined,
      selectedLocationId,
      selectedLocationName,
    })
  }, [hydrated, scope, overrideGeo, selectedLocationId, selectedLocationName])

  const showPill = useMemo(() => {
    if (alwaysShowPill) return true
    return shouldShowShopLocationPill({
      inventoryLocations,
      settingsLocations,
      buyerGeo: effectiveBuyerGeo,
    })
  }, [alwaysShowPill, inventoryLocations, settingsLocations, effectiveBuyerGeo])

  const label = useMemo(() => {
    if (selectedLocationName) return selectedLocationName
    return formatBuyerLocationLabel(effectiveBuyerGeo, setLocationFallback)
  }, [selectedLocationName, effectiveBuyerGeo, setLocationFallback])

  const applyPlace = useCallback((place: GeocodedPlace) => {
    const geo = placeToBuyerGeo(place)
    // Require at least one restriction-matchable field so lat/lon-only cannot unlock catalogs
    if (!geo.city && !geo.country && !geo.zip) {
      return { ok: false as const, error: "Could not resolve city or country" }
    }
    setOverrideGeo(geo)
    setSelectedLocationId(null)
    setSelectedLocationName(null)
    setSheetOpen(false)
    return { ok: true as const }
  }, [])

  /**
   * Store pick scopes pickup/stock and relocates the availability check to that store's area
   * (city/country), so settings include/exclude evaluate against Celaya — not the old IP city.
   */
  const applyStore = useCallback(
    (loc: Location) => {
      setSelectedLocationId(loc.id)
      setSelectedLocationName(loc.name)
      const city = (loc.city || loc.name || "").trim() || undefined
      const state = (loc.state || "").trim() || undefined
      const zip = (loc.zip || "").trim() || undefined
      const settingsMatch = (settingsLocations || []).find((s) => {
        const sn = (s.name || "").trim().toLowerCase()
        const sc = (s.city || "").trim().toLowerCase()
        const ln = (loc.name || "").trim().toLowerCase()
        const lc = (city || "").trim().toLowerCase()
        return (sn && sn === ln) || (sc && lc && sc === lc)
      })
      const country =
        (loc.country || "").trim() ||
        (settingsMatch?.country || "").trim() ||
        undefined
      setOverrideGeo((prev) => ({
        city,
        state: state || settingsMatch?.state || prev?.state,
        country: country || prev?.country || initialGeo?.country,
        zip: zip || settingsMatch?.zip || undefined,
      }))
      setSheetOpen(false)
    },
    [initialGeo?.country, settingsLocations]
  )

  const useMyLocation = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return { ok: false as const, error: "Geolocation is not available" }
    }
    setLocating(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 60_000,
        })
      })
      const { latitude, longitude } = position.coords
      const res = await fetch(`/api/geocode?lat=${latitude}&lon=${longitude}`)
      const data = await res.json()
      const place = data.place as GeocodedPlace | null
      if (!place) {
        return { ok: false as const, error: "Could not resolve city or country" }
      }
      return applyPlace(place)
    } catch (e: any) {
      return { ok: false as const, error: e?.message || "Could not get location" }
    } finally {
      setLocating(false)
    }
  }, [applyPlace])

  const searchPlaces = useCallback(async (query: string) => {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`)
    const data = await res.json()
    return (data.places || []) as GeocodedPlace[]
  }, [])

  return {
    effectiveBuyerGeo,
    selectedLocationId,
    label,
    showPill,
    sheetOpen,
    setSheetOpen,
    locating,
    applyPlace,
    applyStore,
    useMyLocation,
    searchPlaces,
  }
}
