"use client"

import { CommerceProductGrid } from "@/app/components/commerce/CommerceProductGrid"
import { PromoListingCard } from "@/app/components/commerce/PromoListingCard"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { StorefrontPromoCard } from "@/app/promotions/promotion-merchandising"

export function MarketplaceDiscountsFeed({
  discountsFeed,
  compactMobile,
}: {
  discountsFeed: StorefrontPromoCard[]
  compactMobile: boolean
}) {
  const { t } = useLocalization()

  if (discountsFeed.length === 0) {
    return (
      <div className="text-center py-20 px-4">
        <h3 className="text-xl font-bold mb-2">
          {t("marketplace.discounts.empty") || "No discounts right now"}
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          {t("marketplace.discounts.emptyDesc") ||
            "Check back later for marketplace promotions."}
        </p>
      </div>
    )
  }

  return (
    <CommerceProductGrid
      totalCount={discountsFeed.length}
      maxCols={3}
      skeletonCount={6}
    >
      {discountsFeed.map((promo) => (
        <PromoListingCard
          key={promo.id}
          promo={promo}
          href={`/marketplace/promo/${promo.id}`}
          compactMobile={compactMobile}
          surface="marketplace"
        />
      ))}
    </CommerceProductGrid>
  )
}
