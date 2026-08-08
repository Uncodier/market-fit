"use client"

import { CatalogItem } from "@/app/types"
import { Search } from "@/app/components/ui/icons"
import { Pagination } from "@/app/components/ui/pagination"
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

interface ShopCatalogMainProps {
  siteSlug: string | string[]
  categories: string[]
  selectedCategory: string
  setSelectedCategory: (cat: string) => void
  searchQuery: string
  ownedItems: CatalogItem[]
  ownedAccessMap: Map<string, boolean>
  sellableCatalogItems: CatalogItem[]
  initialCount: number
  isLoading: boolean
  page: number
  totalPages: number
  setPage: (page: number) => void
  addToCart: (item: CatalogItem) => void
  isOpen?: boolean
  locationAvailable?: boolean
}

export function ShopCatalogMain({
  siteSlug,
  categories,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  ownedItems,
  ownedAccessMap,
  sellableCatalogItems,
  initialCount,
  isLoading,
  page,
  totalPages,
  setPage,
  addToCart,
  isOpen = true,
  locationAvailable = true,
}: ShopCatalogMainProps) {
  const { t } = useLocalization()
  const compactMobile = shouldUseCompactMobileListing(initialCount || 0)
  const resultsTitle =
    searchQuery || selectedCategory !== "all"
      ? t("shop.results") || "Results"
      : t("shop.trendingNow") || "Trending Now"

  const useFeaturedOwned =
    !isLoading && ownedItems.length > 0 && ownedItems.length < FEATURED_LISTING_THRESHOLD
  const useFeaturedSellable =
    !isLoading &&
    sellableCatalogItems.length > 0 &&
    sellableCatalogItems.length < FEATURED_LISTING_THRESHOLD

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 w-full">
      {categories.length > 0 && (
        <div className="sticky top-[72px] z-30 pointer-events-none -mx-4 px-4 md:mx-0 md:px-0 pt-1 pb-3 mb-6">
          <div className="flex overflow-x-auto gap-3 scrollbar-hide w-full items-center pointer-events-auto pb-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                selectedCategory === "all"
                  ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-sm"
                  : "bg-white/90 text-gray-700 border-black/5 hover:bg-white dark:bg-[#030303]/80 dark:text-gray-300 dark:border-white/10 dark:hover:bg-[#030303] backdrop-blur-md shadow-sm"
              }`}
            >
              {t("shop.allCategories") || "All Categories"}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                  selectedCategory === cat
                    ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-sm"
                    : "bg-white/90 text-gray-700 border-black/5 hover:bg-white dark:bg-[#030303]/80 dark:text-gray-300 dark:border-white/10 dark:hover:bg-[#030303] backdrop-blur-md shadow-sm"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {ownedItems.length === 0 && (
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
                !(item as any)._shop?.sellable && (item as any)._shop?.availableQty === 0
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
                    !(item as any)._shop?.sellable && (item as any)._shop?.availableQty === 0
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

      {(sellableCatalogItems.length > 0 || ownedItems.length === 0) && (
        <div>
          {ownedItems.length > 0 && (
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

          {sellableCatalogItems.length === 0 && !isLoading ? (
            <div className="py-24 text-center">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                {t("shop.noProductsFound") || "No products found"}
              </h3>
              <p className="text-gray-500">
                {t("shop.tryAdjustingSearch") || "Try adjusting your search query."}
              </p>
            </div>
          ) : useFeaturedSellable ? (
            <FeaturedListingsRail
              items={sellableCatalogItems}
              getHref={(item) => `/shop/${siteSlug}/${item.id}`}
              onPrimaryAction={addToCart}
              disabledLabel={t("shop.soldOut") || "Sold Out"}
              getPrimaryDisabled={(item) =>
                !(item as any)._shop?.sellable && (item as any)._shop?.availableQty === 0
              }
              isOpen={isOpen}
              locationAvailable={locationAvailable}
            />
          ) : (
            <CommerceProductGrid
              totalCount={initialCount || 0}
              isLoading={isLoading}
              skeletonCount={8}
            >
              {sellableCatalogItems.map((item) => (
                <CatalogListingCard
                  key={item.id}
                  item={item}
                  href={`/shop/${siteSlug}/${item.id}`}
                  onPrimaryAction={addToCart}
                  showSeller={false}
                  descriptionLineClamp="line-clamp-1"
                  primaryDisabled={
                    !(item as any)._shop?.sellable && (item as any)._shop?.availableQty === 0
                  }
                  disabledLabel={t("shop.soldOut") || "Sold Out"}
                  isOwned={false}
                  compactMobile={compactMobile}
                  isOpen={isOpen}
                  locationAvailable={locationAvailable}
                />
              ))}
            </CommerceProductGrid>
          )}

          {totalPages > 1 && (
            <div className="mt-12 flex justify-center border-t border-gray-200 dark:border-gray-800 pt-8">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}
    </main>
  )
}
