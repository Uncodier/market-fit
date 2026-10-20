"use client"

import { useMemo, useState, type ComponentProps } from "react"
import type { CatalogItem } from "@/app/types"
import { shouldUseCompactMobileListing } from "@/app/components/commerce/CommerceProductGrid"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { useBuyerLocation } from "@/app/components/commerce/use-buyer-location"
import { isItemLocationAvailable, type SettingsLocation } from "@/app/commerce/buyer-location-availability"
import type { PromoBadge, StorefrontPromoCard } from "@/app/promotions/promotion-merchandising"
import { MarketplaceCategoryChips, MarketplaceFilterSidebar } from "./MarketplaceCategoryChips"
import { MarketplaceSortControl } from "./MarketplaceSortControl"
import { MarketplaceDiscountsFeed } from "./MarketplaceDiscountsFeed"
import { MarketplaceProductList } from "./MarketplaceProductList"
import { useMarketplaceProducts } from "./useMarketplaceProducts"
import { MarketplaceFilters } from "./MarketplaceFilters"
import { buildMarketplaceListingFilterSearch, parseMarketplaceListingFilters } from "./marketplace-filter-url"
import type { MarketplaceListingFilters, MarketplaceRegion } from "./marketplace-product-filters"

export interface MarketplaceItem extends CatalogItem {
  site: { id: string; name: string; logo_url?: string | null; settings?: { locations?: SettingsLocation[] } }
}

type MarketplaceCatalogProps = Omit<ComponentProps<typeof MarketplaceCategoryChips>, "productFilters"> & ComponentProps<typeof MarketplaceSortControl> & {
  initialItems: MarketplaceItem[]
  initialCount: number
  initialTotalPages: number
  initialRegions?: MarketplaceRegion[]
  searchQuery: string
  buyerLocation: ReturnType<typeof useBuyerLocation>
  sellerLocationRestricted: boolean | null
  onPrimaryAction: (item: MarketplaceItem) => void
  discountsFeed: StorefrontPromoCard[]
  promoBadgesByItemId: Record<string, PromoBadge>
}

/** Listing data, availability indicator and responsive catalog controls. */
export function MarketplaceCatalog({
  initialItems, initialCount, initialTotalPages, initialRegions, searchQuery, buyerLocation,
  sellerLocationRestricted, onPrimaryAction, discountsFeed, promoBadgesByItemId,
  ...filters
}: MarketplaceCatalogProps) {
  const { t } = useLocalization()
  const searchParams = useSearchParams()
  const pathname = usePathname() || "/marketplace"
  const router = useRouter()
  const sourceSearch = searchParams?.toString() || ""
  const [selection, setSelection] = useState(() => ({ sourceSearch, filters: parseMarketplaceListingFilters(sourceSearch) }))
  // Immediate control feedback keeps rapid changes together while navigation commits.
  if (selection.sourceSearch !== sourceSearch) {
    setSelection({ sourceSearch, filters: parseMarketplaceListingFilters(sourceSearch) })
  }
  const listingFilters = selection.filters
  const setListingFilters = (next: MarketplaceListingFilters) => {
    const qs = buildMarketplaceListingFilterSearch(searchParams, next)
    setSelection({ sourceSearch, filters: parseMarketplaceListingFilters(qs) })
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const showingDiscounts = filters.selectedKind === "discounts"
  const { items, page, setPage, totalPages, isLoading, count, regions, error, retry } = useMarketplaceProducts(
    initialItems, initialTotalPages, searchQuery,
    showingDiscounts ? "all" : filters.selectedKind,
    filters.selectedSubtype, filters.selectedKind === "recurring",
    showingDiscounts ? "featured" : filters.selectedSort,
    showingDiscounts ? undefined : buyerLocation.effectiveBuyerGeo,
    showingDiscounts ? undefined : listingFilters, initialRegions, initialCount,
    searchParams?.get("siteId") || undefined,
  )
  const compactMobile = shouldUseCompactMobileListing(showingDiscounts ? initialCount : count)
  const listingLocationRestricted = useMemo(() => !showingDiscounts && !isLoading && !error && items.some((item) =>
    !isItemLocationAvailable({
      item,
      settingsLocations: (item as MarketplaceItem).site?.settings?.locations || null,
      buyerGeo: buyerLocation.effectiveBuyerGeo,
    }),
  ), [showingDiscounts, isLoading, error, items, buyerLocation.effectiveBuyerGeo])
  const locationRestricted = sellerLocationRestricted ?? listingLocationRestricted
  const productFilters = <MarketplaceFilters filters={listingFilters} onChange={setListingFilters}
    regions={regions} initialRegions={initialRegions} isLoading={isLoading} buyerLocation={buyerLocation} locationRestricted={locationRestricted} />

  return (
    <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <MarketplaceFilterSidebar {...filters} productFilters={productFilters} />
        <div className="flex-1 min-w-0 w-full">
          <MarketplaceCategoryChips {...filters} />
          {showingDiscounts ? (
            <MarketplaceDiscountsFeed discountsFeed={discountsFeed} compactMobile={compactMobile} />
          ) : (
            <>
              <div className="md:hidden mb-6">
                {productFilters}
              </div>
              <div className="flex justify-end mb-6" aria-label={t("marketplace.sort.title")}>
                {searchQuery.trim() ? (
                  <p className="text-sm text-muted-foreground">Relevance · up to 200 candidates. Filters apply within this search window, not the entire catalog.</p>
                ) : <MarketplaceSortControl selectedSort={filters.selectedSort} setSelectedSort={filters.setSelectedSort} />}
              </div>
              {error ? (
                <div role="alert" className="space-y-3 py-8">
                  <p>{t("marketplace.loadError")}</p>
                  <Button type="button" variant="outline" onClick={retry}>{t("marketplace.tryAgain")}</Button>
                </div>
              ) : (
                <MarketplaceProductList
                  items={items} initialCount={count} globalInitialCount={initialCount} isLoading={isLoading}
                  compactMobile={compactMobile} page={page} totalPages={totalPages} setPage={setPage}
                  onPrimaryAction={(item) => { if (item.site) onPrimaryAction({ ...item, site: item.site }) }} buyerGeo={buyerLocation.effectiveBuyerGeo}
                  promoBadgesByItemId={promoBadgesByItemId}
                />
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}