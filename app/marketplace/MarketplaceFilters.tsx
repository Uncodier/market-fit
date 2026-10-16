"use client"

import { useId, useState, type FormEvent } from "react"
import { Button } from "@/app/components/ui/button"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Input } from "@/app/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import type { useBuyerLocation } from "@/app/components/commerce/use-buyer-location"
import type { MarketplaceListingFilters, MarketplaceRegion } from "./marketplace-product-filters"
import { parseMarketplacePrice } from "./marketplace-filter-url"

type FilterProps = {
  filters: MarketplaceListingFilters
  onChange: (filters: MarketplaceListingFilters) => void
  regions: MarketplaceRegion[]
  isLoading: boolean
  buyerLocation: ReturnType<typeof useBuyerLocation>
  locationRestricted: boolean
}

function PriceRange({ filters, onChange, currency }: Pick<FilterProps, "filters" | "onChange"> & { currency: string }) {
  const id = useId()
  const [min, setMin] = useState(filters.minPrice?.toString() || "")
  const [max, setMax] = useState(filters.maxPrice?.toString() || "")
  const [error, setError] = useState("")
  const apply = (event: FormEvent) => {
    event.preventDefault()
    const minPrice = parseMarketplacePrice(min)
    const maxPrice = parseMarketplacePrice(max)
    if ((min.trim() && minPrice === undefined) || (max.trim() && maxPrice === undefined)) {
      setError("Enter a price between 0 and 1,000,000,000.")
      return
    }
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      setError("Minimum price must not exceed maximum price.")
      return
    }
    setError("")
    onChange({ ...filters, minPrice, maxPrice,
      priceCurrency: minPrice !== undefined || maxPrice !== undefined ? currency : undefined })
  }
  return (
    <form onSubmit={apply} className="space-y-3" noValidate>
      <h3 className="font-semibold">Price range ({currency})</h3>
      {filters.priceCurrency && filters.priceCurrency !== currency && (
        <p className="text-xs text-muted-foreground">Applied range: {filters.priceCurrency}. Apply to use {currency}.</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor={`${id}-min`} className="text-sm text-muted-foreground">Min price</label>
          <Input id={`${id}-min`} type="number" inputMode="decimal" min="0" max="1000000000" step="any" placeholder="No min"
            value={min} onChange={(event) => setMin(event.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-max`} className="text-sm text-muted-foreground">Max price</label>
          <Input id={`${id}-max`} type="number" inputMode="decimal" min="0" max="1000000000" step="any" placeholder="No max"
            value={max} onChange={(event) => setMax(event.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
        </div>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" variant="outline" size="sm" className="w-full">Apply</Button>
    </form>
  )
}

/** The same controls render below categories on desktop and below sort on mobile. */
export function MarketplaceFilters({ filters, onChange, regions, isLoading, buyerLocation, locationRestricted }: FilterProps) {
  const id = useId()
  const { displayCurrency = "USD" } = useDisplayCurrency()
  const selected = filters.nearMe ? "near-me" : filters.regionCountry || "all-regions"
  const options = regions.slice(0, 6)
  const selectedRegion = regions.find((region) => region.country === filters.regionCountry)
  if (selectedRegion && !options.includes(selectedRegion)) options.push(selectedRegion)
  const missingCountry = filters.regionCountry && !options.some((region) => region.country === filters.regionCountry)
  const geo = buyerLocation.effectiveBuyerGeo
  const hasBuyerGeo = !!(geo?.city || geo?.country || geo?.state || geo?.zip)
  const active = Object.keys(filters).length > 0
  return (
    <section aria-label="Product filters" className="space-y-6 border-t border-border pt-6">
      <div className="space-y-1" data-location-restricted={locationRestricted}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Your location</h3>
          <Button type="button" variant="link" size="sm" className="!p-0" aria-label="Set your location"
            onClick={() => buyerLocation.setSheetOpen(true)}>Set</Button>
        </div>
        <p className="text-sm text-muted-foreground break-words">{hasBuyerGeo ? buyerLocation.label : "Not set"}</p>
        {locationRestricted && <p className="text-xs text-muted-foreground">Some items are not available at your location.</p>}
      </div>
      <div className="space-y-3">
        <h3 className="font-semibold" id={`${id}-regions`}>Top regions</h3>
        <RadioGroup aria-labelledby={`${id}-regions`} value={selected} onValueChange={(value) => {
          onChange({ ...filters, regionCountry: value === "all-regions" || value === "near-me" ? undefined : value,
            nearMe: value === "near-me" ? true : undefined })
          if (value === "near-me" && !hasBuyerGeo) buyerLocation.setSheetOpen(true)
        }}>
          {[
            { country: "all-regions", label: "All regions" },
            { country: "near-me", label: "Near me" },
            ...options,
            ...(missingCountry ? [{ country: filters.regionCountry!, label: filters.regionCountry!.replace(/\b\w/g, (letter) => letter.toUpperCase()) }] : []),
          ].map((region) => (
            <label key={region.country} className="flex items-center gap-2 min-h-9 cursor-pointer text-sm">
              <RadioGroupItem value={region.country} aria-label={region.label} />
              <span className="flex-1">{region.label}</span>
              {!isLoading && "count" in region && <span className="text-muted-foreground tabular-nums">{String(region.count)}</span>}
            </label>
          ))}
        </RadioGroup>
        {isLoading && <p role="status" className="text-xs text-muted-foreground">Updating regions…</p>}
        {filters.nearMe && !hasBuyerGeo && <p className="text-xs text-muted-foreground">Set your location to find nearby items.</p>}
      </div>
      <PriceRange key={`${filters.minPrice}:${filters.maxPrice}:${filters.priceCurrency}:${displayCurrency}`}
        filters={filters} onChange={onChange} currency={displayCurrency} />
      <label className="flex items-center gap-2 min-h-9 cursor-pointer text-sm">
        <Checkbox checked={!!filters.availableOnly} aria-label="Available now"
          onCheckedChange={(checked) => onChange({ ...filters, availableOnly: checked === true ? true : undefined })} />
        Available now
      </label>
      <Button type="button" variant="link" size="sm" className="!p-0" disabled={!active}
        onClick={() => onChange({})}>Clear filters</Button>
    </section>
  )
}