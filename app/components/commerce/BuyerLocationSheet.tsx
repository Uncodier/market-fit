"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { MapPin } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/app/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import type { Location } from "@/app/types"
import type { GeocodedPlace } from "@/app/commerce/geocode-search"

export function BuyerLocationSheet({
  open,
  onOpenChange,
  stores = [],
  selectedLocationId = null,
  locating = false,
  onSelectStore,
  onSelectPlace,
  onUseMyLocation,
  searchPlaces,
  showSearch = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  stores?: Location[]
  selectedLocationId?: string | null
  locating?: boolean
  onSelectStore?: (loc: Location) => void
  onSelectPlace: (place: GeocodedPlace) => { ok: true } | { ok: false; error?: string }
  onUseMyLocation: () => Promise<{ ok: boolean; error?: string }>
  searchPlaces: (query: string) => Promise<GeocodedPlace[]>
  showSearch?: boolean
}) {
  const { t } = useLocalization()
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GeocodedPlace[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
      setSearching(false)
    }
  }, [open])

  const activeStores = stores.filter((l) => l.is_active !== false)
  const showStores = activeStores.length > 0 && !!onSelectStore

  const runSearch = async () => {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    try {
      const places = await searchPlaces(q)
      setResults(places)
      if (places.length === 0) {
        toast.error(t("shop.location.noResults") || "No locations found")
      }
    } catch {
      toast.error(t("shop.location.searchFailed") || "Search failed")
    } finally {
      setSearching(false)
    }
  }

  const handleUseMyLocation = async () => {
    const res = await onUseMyLocation()
    if (!res.ok) {
      toast.error(res.error || t("shop.location.gpsFailed") || "Could not get your location")
    }
  }

  const body = (
    <div className="space-y-6">
      {showStores && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {t("shop.location.storeLocations") || "Store locations"}
          </h3>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {activeStores.map((loc) => {
              const selected = selectedLocationId === loc.id
              const subtitle = [loc.city, loc.country].filter(Boolean).join(", ")
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => onSelectStore?.(loc)}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                    selected
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-border bg-background hover:bg-muted/60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{loc.name}</div>
                      {subtitle && (
                        <div
                          className={`text-xs mt-0.5 truncate ${
                            selected ? "opacity-80" : "text-muted-foreground"
                          }`}
                        >
                          {subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {showSearch && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {t("shop.location.searchArea") || "Search your area"}
          </h3>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full justify-center gap-2"
            disabled={locating}
            onClick={handleUseMyLocation}
          >
            <MapPin className="h-4 w-4" />
            {locating
              ? t("shop.location.locating") || "Locating..."
              : t("shop.location.useMyLocation") || "Use my location"}
          </Button>
          <form
            className="relative w-full"
            onSubmit={(e) => {
              e.preventDefault()
              void runSearch()
            }}
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("shop.location.searchPlaceholder") || "City, region, or country"}
              className="rounded-full w-full pr-[5.5rem]"
              aria-label={t("common.search") || "Search"}
            />
            <div className="absolute inset-y-0 right-1 flex items-center">
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={searching || !query.trim()}
                className="h-8 rounded-full px-3.5 text-sm font-medium shadow-none hover:scale-100 active:scale-100 focus-visible:ring-0"
              >
                {searching
                  ? t("common.loading") || "..."
                  : t("common.search") || "Search"}
              </Button>
            </div>
          </form>
          {results.length > 0 && (
            <div className="space-y-2 max-h-[36vh] overflow-y-auto">
              {results.map((place, idx) => (
                <button
                  key={`${place.lat}-${place.lon}-${idx}`}
                  type="button"
                  onClick={() => {
                    const res = onSelectPlace(place)
                    if (!res.ok) {
                      toast.error(
                        res.error ||
                          t("shop.location.searchFailed") ||
                          "Could not use this location"
                      )
                    }
                  }}
                  className="w-full text-left rounded-xl border border-border px-4 py-3 hover:bg-muted/60 transition-colors"
                >
                  <div className="font-medium text-sm">
                    {[place.city, place.state, place.countryCode || place.country]
                      .filter(Boolean)
                      .join(", ") || place.displayName}
                  </div>
                  {place.displayName && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {place.displayName}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )

  if (!mounted) return null

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[85vh] overflow-y-auto p-0"
        >
          <div className="px-5 pt-5 pb-8 space-y-6">
            <SheetTitle className="text-lg font-bold">
              {t("shop.location.title") || "Your location"}
            </SheetTitle>
            {body}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto rounded-2xl p-6 gap-0">
        <DialogTitle className="text-lg font-bold mb-6 pr-8">
          {t("shop.location.title") || "Your location"}
        </DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  )
}
