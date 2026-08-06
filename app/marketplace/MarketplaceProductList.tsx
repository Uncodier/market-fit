"use client"

import { Search } from "@/app/components/ui/icons"
import { Pagination } from "@/app/components/ui/pagination"
import { CatalogListingCard } from "@/app/components/commerce/CatalogListingCard"
import { CommerceProductGrid } from "@/app/components/commerce/CommerceProductGrid"
import {
  FeaturedListingsRail,
  FEATURED_LISTING_THRESHOLD,
} from "@/app/components/commerce/FeaturedListingPoster"
import { useLocalization } from "@/app/context/LocalizationContext"
import { CatalogItem } from "@/app/types"

interface MarketplaceProductListProps {
  items: Array<CatalogItem & { site?: { id: string; name: string; logo_url?: string | null } }>
  initialCount: number
  isLoading: boolean
  compactMobile: boolean
  page: number
  totalPages: number
  setPage: (page: number) => void
  onPrimaryAction: (item: any) => void
}

export function MarketplaceProductList({
  items,
  initialCount,
  isLoading,
  compactMobile,
  page,
  totalPages,
  setPage,
  onPrimaryAction,
}: MarketplaceProductListProps) {
  const { t } = useLocalization()

  if (items.length === 0 && !isLoading) {
    return (
      <div className="text-center py-20 px-4">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Search className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold mb-2">
          {initialCount === 0
            ? t("marketplace.empty.title") || "No marketplace listings yet"
            : t("marketplace.noResults") || "No results found"}
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          {initialCount === 0
            ? t("marketplace.empty.desc") ||
              "Sellers can list catalog items on the marketplace by enabling the Marketplace toggle on each item."
            : t("marketplace.noResultsDesc") ||
              "Try adjusting your search or filters to find what you're looking for."}
        </p>
      </div>
    )
  }

  const useFeatured =
    !isLoading && items.length > 0 && items.length < FEATURED_LISTING_THRESHOLD

  return (
    <>
      {useFeatured ? (
        <FeaturedListingsRail
          items={items}
          getHref={(item) => `/marketplace/${item.id}`}
          onPrimaryAction={onPrimaryAction}
          showSeller
        />
      ) : (
        <CommerceProductGrid
          totalCount={initialCount || 0}
          isLoading={isLoading}
          skeletonCount={8}
          showSeller
          maxCols={3}
        >
          {items.map((item) => (
            <CatalogListingCard
              key={item.id}
              item={item}
              href={`/marketplace/${item.id}`}
              onPrimaryAction={onPrimaryAction}
              showSeller={true}
              descriptionLineClamp="line-clamp-1"
              compactMobile={compactMobile}
            />
          ))}
        </CommerceProductGrid>
      )}

      {totalPages > 1 && (
        <div className="mt-12 flex justify-center border-t border-gray-200 dark:border-gray-800 pt-8">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </>
  )
}
