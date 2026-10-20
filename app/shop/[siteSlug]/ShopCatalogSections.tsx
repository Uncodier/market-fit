"use client"

import type { ReactNode } from "react"
import { CommerceProductGrid, shouldUseCompactMobileListing } from "@/app/components/commerce/CommerceProductGrid"
import {
  FeaturedListingsRailSkeleton,
} from "@/app/components/commerce/CatalogListingCardSkeleton"
import { FEATURED_LISTING_THRESHOLD } from "@/app/components/commerce/FeaturedListingPoster"
import { PromoListingCard } from "@/app/components/commerce/PromoListingCard"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { StorefrontPromoCard } from "@/app/promotions/promotion-merchandising"
import type { CatalogItem } from "@/app/types"
import { categoryDomId, SHOP_UNCATEGORIZED_NAME } from "./shop-catalog-shared"
import { ShopPendingGrid } from "./ShopPendingGrid"
import styles from "./shop-pending-grid.module.css"

export function ShopCatalogSections({
  sections,
  catalogCount,
  siteSlug,
  categoryPromosByName,
  renderCard,
  renderFeaturedRail,
}: {
  sections: { name: string; items: CatalogItem[]; pendingCount: number }[]
  catalogCount: number
  siteSlug: string
  categoryPromosByName: Record<string, StorefrontPromoCard[]>
  renderCard: (item: CatalogItem) => ReactNode
  renderFeaturedRail: (items: CatalogItem[]) => ReactNode
}) {
  const { t } = useLocalization()
  const compactMobile = shouldUseCompactMobileListing(catalogCount)

  return (
    <div className="space-y-12">
      {sections.map((section) => {
        const promos = categoryPromosByName[section.name] || []
        const useFeatured = !compactMobile && catalogCount > 0 &&
          catalogCount < FEATURED_LISTING_THRESHOLD && promos.length === 0

        return (
          <section
            key={section.name}
            id={categoryDomId(section.name)}
            data-shop-category={section.name}
            data-shop-pending-count={section.pendingCount}
            aria-busy={section.pendingCount > 0}
            className="scroll-mt-[140px]"
          >
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-6">
              {section.name === SHOP_UNCATEGORIZED_NAME ? t("shop.other") || "Other" : section.name}
            </h2>
            {useFeatured ? (
              section.pendingCount > 0 ? (
                <FeaturedListingsRailSkeleton count={section.items.length + section.pendingCount > 1 ? 2 : 1} />
              ) : renderFeaturedRail(section.items)
            ) : (
              <div className={`${styles.container} ${compactMobile ? styles.compact : ""}`} data-shop-category-grid>
                <CommerceProductGrid totalCount={catalogCount}>
                  {promos.map((promo) => (
                    <PromoListingCard
                      key={`promo-${promo.id}`}
                      promo={promo}
                      href={`/shop/${siteSlug}/promo/${promo.id}`}
                      compactMobile={compactMobile}
                      surface="shop"
                      siteSlug={siteSlug}
                    />
                  ))}
                  {section.items.map(renderCard)}
                  {section.pendingCount > 0 && (
                    <ShopPendingGrid
                      loadedCount={promos.length + section.items.length}
                      pendingCount={section.pendingCount}
                      compactMobile={compactMobile}
                    />
                  )}
                </CommerceProductGrid>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}