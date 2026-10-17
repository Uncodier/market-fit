"use client"

import { useId, useState, type FormEvent } from "react"
import { Button } from "@/app/components/ui/button"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Input } from "@/app/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { useBuyerLocation } from "@/app/components/commerce/use-buyer-location"
import type { MarketplaceListingFilters, MarketplaceRegion } from "./marketplace-product-filters"
import { parseMarketplacePrice } from "./marketplace-filter-url"
import { localizeMarketplaceRegion } from "./marketplace-region-label"

type FilterProps = {
  filters: MarketplaceListingFilters
  onChange: (filters: MarketplaceListingFilters) => void
  regions: MarketplaceRegion[]
  initialRegions?: MarketplaceRegion[]
  isLoading: boolean
  buyerLocation: ReturnType<typeof useBuyerLocation>
  locationRestricted: boolean
}

function PriceRange({ filters, onChange, currency }: Pick<FilterProps, "filters" | "onChange"> & { currency: string }) {
  const id = useId()
  const { t, locale } = useLocalization()
  const [min, setMin] = useState(filters.minPrice?.toString() || "")
  const [max, setMax] = useState(filters.maxPrice?.toString() || "")
  const [error, setError] = useState("")
  const apply = (event: FormEvent) => {
    event.preventDefault()
    const minPrice = parseMarketplacePrice(min)
    const maxPrice = parseMarketplacePrice(max)
    if ((min.trim() && minPrice === undefined) || (max.trim() && maxPrice === undefined)) {
      setError("marketplace.filters.invalidPrice")
      return
    }
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      setError("marketplace.filters.invertedPrice")
      return
    }
    setError("")
    onChange({ ...filters, minPrice, maxPrice,
      priceCurrency: minPrice !== undefined || maxPrice !== undefined ? currency : undefined })
  }
  return (
    <form onSubmit={apply} className="space-y-3" noValidate>
      <h3 className="font-semibold">{t("marketplace.filters.priceRange", { currency })}</h3>
      {filters.priceCurrency && filters.priceCurrency !== currency && (
        <p className="text-xs text-muted-foreground">{t("marketplace.filters.appliedCurrency", { appliedCurrency: filters.priceCurrency, currency })}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor={`${id}-min`} className="text-sm text-muted-foreground">{t("marketplace.filters.minPrice")}</label>
          <Input id={`${id}-min`} type="number" inputMode="decimal" min="0" max="1000000000" step="any" placeholder={t("marketplace.filters.noMin")}
            value={min} onChange={(event) => setMin(event.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-max`} className="text-sm text-muted-foreground">{t("marketplace.filters.maxPrice")}</label>
          <Input id={`${id}-max`} type="number" inputMode="decimal" min="0" max="1000000000" step="any" placeholder={t("marketplace.filters.noMax")}
            value={max} onChange={(event) => setMax(event.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
        </div>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{t(error, { max: new Intl.NumberFormat(locale).format(1000000000) })}</p>}
      <Button type="submit" variant="outline" size="sm" className="w-full">{t("marketplace.filters.apply")}</Button>
    </form>
  )
}

/** The same controls render below categories on desktop and below sort on mobile. */
export function MarketplaceFilters({ filters, onChange, regions, initialRegions, isLoading, buyerLocation, locationRestricted }: FilterProps) {
  const id = useId()
  const { t, locale } = useLocalization()
  const { displayCurrency = "USD" } = useDisplayCurrency()
  const [loadedRegions, setLoadedRegions] = useState(regions.length ? regions : initialRegions)
  if (!isLoading && loadedRegions !== regions) setLoadedRegions(regions)
  const expectedRegions = isLoading ? (regions.length ? regions : loadedRegions) : regions
  const selected = filters.nearMe ? "near-me" : filters.regionCountry || "all-regions"
  const options = (expectedRegions || []).slice(0, 6)
  const selectedRegion = expectedRegions?.find((region) => region.country === filters.regionCountry)
  if (selectedRegion && !options.includes(selectedRegion)) options.push(selectedRegion)
  const visibleOptions = isLoading ? options.filter((region) => region.country === filters.regionCountry) : options
  const missingCountry = filters.regionCountry && !visibleOptions.some((region) => region.country === filters.regionCountry)
  const skeletonCount = expectedRegions ? options.length - visibleOptions.length : 6
  const geo = buyerLocation.effectiveBuyerGeo
  const hasBuyerGeo = !!(geo?.city || geo?.country || geo?.state || geo?.zip)
  const active = Object.keys(filters).length > 0
  return (
    <section aria-label={t("marketplace.filters.title")} className="space-y-6 border-t border-border pt-6">
      <div className="space-y-1" data-location-restricted={locationRestricted}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{t("marketplace.filters.location")}</h3>
          <Button type="button" variant="link" size="sm" className="!p-0" aria-label={t("marketplace.filters.setLocation")}
            onClick={() => buyerLocation.setSheetOpen(true)}>{t("marketplace.filters.set")}</Button>
        </div>
        <p className="text-sm text-muted-foreground break-words">{hasBuyerGeo ? buyerLocation.label : t("marketplace.filters.notSet")}</p>
        {locationRestricted && <p className="text-xs text-muted-foreground">{t("marketplace.filters.locationRestricted")}</p>}
      </div>
      <div className="space-y-3">
        <h3 className="font-semibold" id={`${id}-regions`}>{t("marketplace.filters.regions")}</h3>
        <RadioGroup aria-labelledby={`${id}-regions`} aria-busy={isLoading} value={selected} onValueChange={(value) => {
          onChange({ ...filters, regionCountry: value === "all-regions" || value === "near-me" ? undefined : value,
            nearMe: value === "near-me" ? true : undefined })
          if (value === "near-me" && !hasBuyerGeo) buyerLocation.setSheetOpen(true)
        }}>
          {[
            { country: "all-regions", label: t("marketplace.filters.allRegions") },
            { country: "near-me", label: t("marketplace.filters.nearMe") },
            ...visibleOptions.map((region) => ({ ...region, label: localizeMarketplaceRegion(region.country, region.label, locale) })),
            ...(missingCountry ? [{ country: filters.regionCountry!, label: localizeMarketplaceRegion(filters.regionCountry!, filters.regionCountry!.replace(/\b\w/g, (letter) => letter.toUpperCase()), locale) }] : []),
          ].map((region) => (
            <label key={region.country} className="flex items-center gap-2 min-h-9 cursor-pointer text-sm">
              <RadioGroupItem value={region.country} aria-label={region.label} />
              <span className="flex-1">{region.label}</span>
              {"count" in region && (isLoading
                ? <Skeleton aria-hidden="true" className="h-4 w-6 motion-reduce:animate-none" />
                : <span className="text-muted-foreground tabular-nums">{String(region.count)}</span>)}
            </label>
          ))}
          {isLoading && skeletonCount > 0 && (
            <div role="status" aria-label={t("marketplace.filters.updatingRegions")} className="grid gap-2">
              {Array.from({ length: skeletonCount }, (_, index) => (
                <div key={index} data-testid="region-skeleton" aria-hidden="true" className="flex items-center gap-2 min-h-9">
                  <Skeleton className="h-4 w-4 shrink-0 rounded-full motion-reduce:animate-none" />
                  <Skeleton className="h-4 w-28 motion-reduce:animate-none" />
                  <Skeleton className="ml-auto h-4 w-6 motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          )}
        </RadioGroup>
        {filters.nearMe && !hasBuyerGeo && <p className="text-xs text-muted-foreground">{t("marketplace.filters.nearMeHint")}</p>}
      </div>
      <PriceRange key={`${filters.minPrice}:${filters.maxPrice}:${filters.priceCurrency}:${displayCurrency}`}
        filters={filters} onChange={onChange} currency={displayCurrency} />
      <label className="flex items-center gap-2 min-h-9 cursor-pointer text-sm">
        <Checkbox checked={!!filters.availableOnly} aria-label={t("marketplace.filters.availableNow")}
          onCheckedChange={(checked) => onChange({ ...filters, availableOnly: checked === true ? true : undefined })} />
        {t("marketplace.filters.availableNow")}
      </label>
      <Button type="button" variant="link" size="sm" className="!p-0" disabled={!active}
        onClick={() => onChange({})}>{t("marketplace.filters.clear")}</Button>
    </section>
  )
}