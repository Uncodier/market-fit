"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import type { StorefrontPromoCard } from "@/app/promotions/promotion-merchandising"
import { PromoListingCard } from "@/app/components/commerce/PromoListingCard"
import { shouldUseCompactMobileListing } from "@/app/components/commerce/CommerceProductGrid"
import { cn } from "@/lib/utils"

type PromoCarouselProps = {
  promos: StorefrontPromoCard[]
  hrefFor: (promotionId: string) => string
  /** Same total used for catalog grid compact/size logic. */
  catalogCount?: number
  maxCols?: 3 | 4
  surface: "shop" | "marketplace"
  siteSlug?: string
}

/**
 * Slide widths mirror CommerceProductGrid column widths so offer cards
 * match product listing card size at each breakpoint.
 */
function promoCarouselSlideClassName(
  compactMobile: boolean,
  maxCols: 3 | 4 = 4,
) {
  // Gaps: compact mobile gap-x-3 (0.75rem); md:gap-6 (1.5rem); lg+:gap-8 (2rem)
  const xl =
    maxCols === 3
      ? "xl:w-[calc((100%-4rem)/3)]"
      : "xl:w-[calc((100%-6rem)/4)]"

  if (compactMobile) {
    return cn(
      "w-[calc((100%-0.75rem)/2)]",
      "md:w-[calc((100%-1.5rem)/2)]",
      "lg:w-[calc((100%-4rem)/3)]",
      xl,
    )
  }

  return cn(
    "w-full",
    "sm:w-[calc((100%-1.5rem)/2)]",
    "lg:w-[calc((100%-4rem)/3)]",
    xl,
  )
}

export function PromoCarousel({
  promos,
  hrefFor,
  catalogCount = 0,
  maxCols = 4,
  surface,
  siteSlug,
}: PromoCarouselProps) {
  const { t } = useLocalization()
  if (!promos.length) return null

  const compactMobile = shouldUseCompactMobileListing(catalogCount)
  const slideWidth = promoCarouselSlideClassName(compactMobile, maxCols)

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {t("shop.promo.carouselTitle") || "Offers"}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            {t("shop.promo.carouselSubtitle") || "Available promotions right now"}
          </p>
        </div>
      </div>
      <div
        className={cn(
          "flex overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar",
          compactMobile ? "gap-x-3 md:gap-6 lg:gap-8" : "gap-6 md:gap-8",
        )}
      >
        {promos.map((promo) => (
          <div
            key={promo.id}
            className={cn("snap-start shrink-0", slideWidth)}
          >
            <PromoListingCard
              promo={promo}
              href={hrefFor(promo.id)}
              compactMobile={compactMobile}
              surface={surface}
              siteSlug={siteSlug}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
