"use client"

import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { CatalogItem } from "@/app/types"
import { Search } from "@/app/components/ui/icons"
import { CatalogListingCard } from "@/app/components/commerce/CatalogListingCard"
import {
  CommerceProductGrid,
  shouldUseCompactMobileListing,
} from "@/app/components/commerce/CommerceProductGrid"
import {
  FeaturedListingsRail,
  FEATURED_LISTING_THRESHOLD,
} from "@/app/components/commerce/FeaturedListingPoster"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { ShopCategoryOffset } from "./shop-catalog-shared"
import {
  categoryDomId,
  buildShopCategorySections,
  SHOP_UNCATEGORIZED_NAME,
  uniqueCategoryNames,
} from "./shop-catalog-shared"
import {
  matchShopCategory,
  readShopCategoryFromLocation,
  writeShopCategoryToLocation,
} from "./shop-category-url"
import { ShopCategoryChips } from "./ShopCategoryChips"
import { useShopCategorySpy } from "./useShopCategorySpy"
import { PromoCarousel } from "@/app/components/commerce/PromoCarousel"
import { ShopCatalogSections } from "./ShopCatalogSections"
import type {
  PromoBadge,
  StorefrontPromoCard,
} from "@/app/promotions/promotion-merchandising"
import type { DeviceOrder } from "@/app/commerce/device-order-storage"
import { ShopDeviceOrders } from "./ShopDeviceOrders"
import { useShopCatalogViewport, type ShopCatalogRequestResult } from "./useShopCatalogViewport"
import { Button } from "@/app/components/ui/button"

interface ShopCatalogMainProps {
  siteSlug: string | string[]
  categories: string[]
  categoryOffsets: ShopCategoryOffset[]
  searchQuery: string
  ownedItems: CatalogItem[]
  ownedAccessMap: Map<string, boolean>
  deviceOrders?: DeviceOrder[]
  siteId?: string
  onDeviceOrdersHydrated?: (orders: DeviceOrder[]) => void
  sellableCatalogItems: CatalogItem[]
  rawCatalogItems?: CatalogItem[]
  initialCount: number
  isLoading: boolean
  isLoadingMore: boolean
  isJumping: boolean
  hasMoreBelow: boolean
  loadMoreBelow: () => ShopCatalogRequestResult | Promise<ShopCatalogRequestResult>
  jumpToCategory: (offset: number, categoryName: string, categoryCount?: number, scrollToTarget?: boolean) => ShopCatalogRequestResult | Promise<ShopCatalogRequestResult>
  pendingScrollCategory: string | null
  clearPendingScrollCategory: () => void
  addToCart: (item: CatalogItem) => void
  locationAvailable?: boolean
  getLocationAvailable?: (item: CatalogItem) => boolean
  leadingChip?: ReactNode
  onActiveCategoryChange?: (category: string) => void
  generalPromos?: StorefrontPromoCard[]
  promoBadgesByItemId?: Record<string, PromoBadge>
  categoryPromosByName?: Record<string, StorefrontPromoCard[]>
}

export const ShopCatalogMain = React.memo(function ShopCatalogMain({
  siteSlug,
  categories,
  categoryOffsets,
  searchQuery,
  ownedItems,
  ownedAccessMap,
  deviceOrders = [],
  siteId,
  onDeviceOrdersHydrated,
  sellableCatalogItems,
  rawCatalogItems,
  initialCount,
  isLoading,
  isLoadingMore,
  isJumping,
  hasMoreBelow,
  loadMoreBelow,
  jumpToCategory,
  pendingScrollCategory,
  clearPendingScrollCategory,
  addToCart,
  locationAvailable = true,
  getLocationAvailable,
  leadingChip,
  onActiveCategoryChange,
  generalPromos = [],
  promoBadgesByItemId = {},
  categoryPromosByName = {},
}: ShopCatalogMainProps) {
  const resolveLocationAvailable = (item: CatalogItem) =>
    getLocationAvailable ? getLocationAvailable(item) : locationAvailable
  const { t } = useLocalization()
  const sentinelRef = useRef<HTMLDivElement>(null)
  // Reconciled totals must not switch card geometry while navigating the mounted catalog.
  const [layoutCount] = useState(initialCount)
  /** Captured once so the initial "all" spy state cannot wipe `?category=` before restore. */
  const urlCategoryRef = useRef<string | null | undefined>(undefined)
  const [categoryUrlReady, setCategoryUrlReady] = useState(false)
  const isSearching = Boolean(searchQuery.trim())

  const chipCategories = useMemo(() => {
    const names = categoryOffsets.map((o) => o.name)
    // Prefer ordered offsets; fall back to categories prop
    return uniqueCategoryNames(names.length > 0 ? names : categories)
  }, [categoryOffsets, categories])

  const useSections = !isSearching && chipCategories.length > 0
  const sections = useMemo(
    () => (useSections ? buildShopCategorySections(sellableCatalogItems, categoryOffsets, rawCatalogItems) : []),
    [useSections, sellableCatalogItems, categoryOffsets, rawCatalogItems]
  )
  const loadedSectionNames = useMemo(() => sections.map((s) => s.name), [sections])

  const { activeCategory, setActiveCategory, scrollToCategory } = useShopCategorySpy(
    loadedSectionNames,
    useSections
  )

  useEffect(() => {
    onActiveCategoryChange?.(activeCategory)
  }, [activeCategory, onActiveCategoryChange])

  // Capture `?category=` once on mount (before any URL writes).
  useEffect(() => {
    if (urlCategoryRef.current !== undefined) return
    urlCategoryRef.current = readShopCategoryFromLocation()
  }, [])

  // Reflect the active category in the URL so refresh/share restores it.
  useEffect(() => {
    if (!useSections || !categoryUrlReady) return
    writeShopCategoryToLocation(activeCategory)
  }, [activeCategory, useSections, categoryUrlReady])

  // Scroll after a jump loads the target section
  useEffect(() => {
    if (!pendingScrollCategory) return
    const ok = scrollToCategory(pendingScrollCategory)
    if (ok) {
      setActiveCategory(pendingScrollCategory, 1200)
      clearPendingScrollCategory()
    }
  }, [
    pendingScrollCategory,
    sellableCatalogItems,
    scrollToCategory,
    setActiveCategory,
    clearPendingScrollCategory,
  ])

  const { failedCategories, retry } = useShopCatalogViewport({
    sections, categoryOffsets, useSections, ready: categoryUrlReady, isSearching,
    busy: isLoading || isJumping || isLoadingMore, hasMoreBelow,
    sentinelRef, jumpToCategory, loadMoreBelow,
  })

  const handleChipSelect = (cat: string) => {
    if (isSearching) return
    retry()

    if (!categoryUrlReady) setCategoryUrlReady(true)
    writeShopCategoryToLocation(cat)

    if (cat === "all") {
      scrollToCategory("all")
      return
    }

    const offsetEntry = categoryOffsets.find((o) => o.name === cat)
    const expected = offsetEntry?.count ?? 0
    const loadedInCategory = (rawCatalogItems || sellableCatalogItems).filter(
      (item) => (item._shop?.categoryName || SHOP_UNCATEGORIZED_NAME) === cat
    ).length
    const sectionComplete =
      !!document.getElementById(categoryDomId(cat)) &&
      (expected === 0 || loadedInCategory >= expected)

    // Only scroll if this category is already fully loaded; otherwise a partial
    // section (e.g. 2 of 12 teas) would hide the rest forever.
    if (sectionComplete) {
      scrollToCategory(cat)
      return
    }

    if (!offsetEntry) return

    setActiveCategory(cat, 1500)
    jumpToCategory(offsetEntry.offset, cat, offsetEntry.count)
  }

  // Restore category from ?category= on first load
  useEffect(() => {
    if (categoryUrlReady || !useSections || isLoading) return
    if (urlCategoryRef.current === undefined) {
      urlCategoryRef.current = readShopCategoryFromLocation()
    }

    const frame = requestAnimationFrame(() => {
      const matched = matchShopCategory(urlCategoryRef.current, chipCategories)
      if (matched) {
        const offsetEntry = categoryOffsets.find((o) => o.name === matched)
        const expected = offsetEntry?.count ?? 0
        const loadedInCategory = (rawCatalogItems || sellableCatalogItems).filter(
          (item) => (item._shop?.categoryName || SHOP_UNCATEGORIZED_NAME) === matched
        ).length
        const sectionComplete =
          !!document.getElementById(categoryDomId(matched)) &&
          (expected === 0 || loadedInCategory >= expected)

        if (sectionComplete) {
          scrollToCategory(matched)
        } else if (offsetEntry) {
          setActiveCategory(matched, 1500)
          jumpToCategory(offsetEntry.offset, matched, offsetEntry.count)
        }
      }
      setCategoryUrlReady(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [
    categoryUrlReady,
    useSections,
    isLoading,
    chipCategories,
    categoryOffsets,
    rawCatalogItems,
    sellableCatalogItems,
    scrollToCategory,
    setActiveCategory,
    jumpToCategory,
  ])

  // Card theme follows total catalog quantity (same as before category sections):
  // >10 → compact 2-col mobile; <3 → featured posters; else standard grid.
  const catalogCount = layoutCount || 0
  const compactMobile = shouldUseCompactMobileListing(catalogCount)

  const resultsTitle = isSearching
    ? t("shop.results") || "Results"
    : t("shop.trendingNow") || "Trending Now"

  const useFeaturedOwned =
    !isLoading && ownedItems.length > 0 && ownedItems.length < FEATURED_LISTING_THRESHOLD
  const useFeaturedSellable =
    !isLoading &&
    !useSections &&
    !compactMobile &&
    sellableCatalogItems.length > 0 &&
    sellableCatalogItems.length < FEATURED_LISTING_THRESHOLD

  const renderFeaturedRail = (items: CatalogItem[]) => (
    <FeaturedListingsRail
      items={items}
      getHref={(item) => `/shop/${siteSlug}/${item.id}`}
      onPrimaryAction={addToCart}
      disabledLabel={t("shop.soldOut") || "Sold Out"}
      getPrimaryDisabled={(item) =>
        !item._shop?.sellable && item._shop?.availableQty === 0
      }
      getLocationAvailable={resolveLocationAvailable}
      getPromoBadge={(item) => promoBadgesByItemId[item.id] || null}
      getIsOwned={(item) => ownedAccessMap.has(item.id)}
      getCanBook={(item) => Boolean(ownedAccessMap.get(item.id))}
    />
  )

  const renderCard = (item: CatalogItem) => (
    <CatalogListingCard
      key={item.id}
      item={item}
      href={`/shop/${siteSlug}/${item.id}`}
      onPrimaryAction={addToCart}
      showSeller={false}
      descriptionLineClamp="line-clamp-1"
      primaryDisabled={
        !item._shop?.sellable && item._shop?.availableQty === 0
      }
      disabledLabel={t("shop.soldOut") || "Sold Out"}
      isOwned={ownedAccessMap.has(item.id)}
      canBook={ownedAccessMap.get(item.id)}
      compactMobile={compactMobile}
      stableLayout={useSections}
      locationAvailable={resolveLocationAvailable(item)}
      promoBadge={promoBadgesByItemId[item.id] || null}
    />
  )

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 pt-5 pb-8 md:pt-8 md:pb-12 w-full">
      {!isSearching && generalPromos.length > 0 && (
        <PromoCarousel
          promos={generalPromos}
          hrefFor={(id) => `/shop/${siteSlug}/promo/${id}`}
          catalogCount={catalogCount}
          surface="shop"
          siteSlug={String(siteSlug)}
        />
      )}

      {(!isSearching || leadingChip) && (
        <ShopCategoryChips
          categories={isSearching ? [] : chipCategories}
          activeCategory={activeCategory}
          onSelect={handleChipSelect}
          disabled={isJumping}
          leadingChip={leadingChip}
        />
      )}

      <div id="shop-catalog-top" />

      <ShopDeviceOrders
        orders={deviceOrders}
        siteId={siteId || ""}
        onOrdersHydrated={onDeviceOrdersHydrated}
      />

      {ownedItems.length === 0 && deviceOrders.length === 0 && !useSections && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {resultsTitle}
          </h2>
        </div>
      )}

      {ownedItems.length > 0 && (
        <div className="mb-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                {t("shop.yourAccess") || "Your access"}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm md:text-base">
                {t("shop.yourAccessHint") || "Book with your active plans"}
              </p>
            </div>
            <span className="text-gray-500 font-medium whitespace-nowrap">
              {ownedItems.length}{" "}
              {ownedItems.length === 1
                ? t("shop.product") || "product"
                : t("shop.products") || "products"}
            </span>
          </div>

          {useFeaturedOwned ? (
            <FeaturedListingsRail
              items={ownedItems}
              getHref={(item) => `/shop/${siteSlug}/${item.id}`}
              onPrimaryAction={addToCart}
              disabledLabel={t("shop.soldOut") || "Sold Out"}
              getPrimaryDisabled={(item) =>
                  !item._shop?.sellable && item._shop?.availableQty === 0
              }
              isOwned
              getCanBook={(item) => Boolean(ownedAccessMap.get(item.id))}
            />
          ) : (
            <CommerceProductGrid totalCount={ownedItems.length}>
              {ownedItems.map((item) => (
                <CatalogListingCard
                  key={item.id}
                  item={item}
                  href={`/shop/${siteSlug}/${item.id}`}
                  onPrimaryAction={addToCart}
                  showSeller={false}
                  descriptionLineClamp="line-clamp-1"
                  primaryDisabled={
                    !item._shop?.sellable && item._shop?.availableQty === 0
                  }
                  disabledLabel={t("shop.soldOut") || "Sold Out"}
                  isOwned={true}
                  canBook={ownedAccessMap.get(item.id)}
                  compactMobile={shouldUseCompactMobileListing(ownedItems.length)}
                />
              ))}
            </CommerceProductGrid>
          )}
        </div>
      )}

      {(sections.length > 0 || sellableCatalogItems.length > 0 || ownedItems.length === 0 || isLoading) && (
        <div>
          {(ownedItems.length > 0 || deviceOrders.length > 0) && !useSections && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                {resultsTitle}
              </h2>
              <span className="text-gray-500 font-medium whitespace-nowrap">
                {sellableCatalogItems.length}{" "}
                {sellableCatalogItems.length === 1
                  ? t("shop.product") || "product"
                  : t("shop.products") || "products"}
              </span>
            </div>
          )}

          {sellableCatalogItems.length === 0 && sections.length === 0 && !isLoading && !isJumping ? (
            <div className="py-24 text-center">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {t("shop.noProductsFound") || "No products found"}
              </h3>
              <p className="text-gray-500">
                {t("shop.tryAdjustingSearch") || "Try adjusting your search query."}
              </p>
            </div>
          ) : useSections ? (
            <ShopCatalogSections
              sections={sections}
              catalogCount={catalogCount}
              siteSlug={String(siteSlug)}
              categoryPromosByName={categoryPromosByName}
              renderCard={renderCard}
              renderFeaturedRail={renderFeaturedRail}
            />
          ) : useFeaturedSellable ? (
            renderFeaturedRail(sellableCatalogItems)
          ) : (
            <CommerceProductGrid
              totalCount={catalogCount}
              isLoading={isLoading || isJumping}
              skeletonCount={compactMobile ? 6 : 4}
            >
              {sellableCatalogItems.map(renderCard)}
            </CommerceProductGrid>
          )}

          <div ref={sentinelRef} className="h-8 w-full" aria-hidden />
          {failedCategories.length > 0 && (
            <div role="status" className="mt-4 flex items-center gap-3 text-sm">
              <span>Some products could not be loaded.</span>
              <Button variant="outline" size="sm" onClick={retry}>Retry loading products</Button>
            </div>
          )}

          {isLoadingMore && !isJumping && !useSections && (
            <div className="mt-8">
              <CommerceProductGrid
                totalCount={catalogCount}
                isLoading
                skeletonCount={compactMobile ? 4 : 2}
              >
                {[]}
              </CommerceProductGrid>
            </div>
          )}
        </div>
      )}
    </main>
  )
})
