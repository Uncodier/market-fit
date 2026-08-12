"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Tag } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { promoBadgeLabel } from "@/app/promotions/promotion-merchandising"
import type { StorefrontPromoCard } from "@/app/promotions/promotion-merchandising"
import { resolvePromotionImage } from "@/app/lib/image-utils"
import { quickApplyStorefrontPromo } from "@/app/components/commerce/quick-apply-storefront-promo"
import { cn } from "@/lib/utils"

type PromoListingCardProps = {
  promo: StorefrontPromoCard
  href: string
  compactMobile?: boolean
  className?: string
  surface: "shop" | "marketplace"
  siteSlug?: string
}

/** Listing card aligned with CatalogListingCard: media tile + text below. */
export function PromoListingCard({
  promo,
  href,
  compactMobile = false,
  className,
  surface,
  siteSlug,
}: PromoListingCardProps) {
  const { t } = useLocalization()
  const router = useRouter()
  const [applying, setApplying] = useState(false)
  const label = promoBadgeLabel(promo, t)
  const imageSrc = resolvePromotionImage(promo)

  const handleApply = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (applying) return
    if (!promo.site_id && !promo.id) return

    setApplying(true)
    try {
      const result = await quickApplyStorefrontPromo({
        promotionId: promo.id,
        siteId: promo.site_id || "",
        surface,
        siteSlug,
        detailHref: href,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      if ("needsDetail" in result) {
        toast.message(
          t("shop.promo.pickRequired") ||
            "Choose products for this offer to continue",
        )
        router.push(result.href)
        return
      }
      toast.success(t("shop.promo.applied") || "Offer added to cart")
      router.push(result.redirectTo)
    } catch (err: any) {
      toast.error(err?.message || "Failed to apply promotion")
    } finally {
      setApplying(false)
    }
  }

  const applyLabel = applying
    ? t("shop.promo.applying") || "Applying..."
    : t("shop.promo.apply") || "Apply"

  return (
    <div className={cn("group min-w-0 w-full flex flex-col", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl bg-muted shrink-0",
          compactMobile ? "aspect-square md:aspect-[4/3]" : "aspect-[4/3]",
        )}
      >
        <Link href={href} className="absolute inset-0 z-0" aria-label={promo.name || "Promotion"}>
          <img
            src={imageSrc}
            alt=""
            onError={(e) => {
              e.currentTarget.style.opacity = "0"
            }}
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          />
        </Link>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 via-black/20 to-transparent"
          aria-hidden
        />

        <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-1">
          <span className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white shadow-sm uppercase tracking-wider">
            {label}
          </span>
        </div>

        <button
          type="button"
          disabled={applying}
          onClick={(e) => void handleApply(e)}
          aria-label={applyLabel}
          className="absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center gap-1.5 rounded-full bg-white text-black shadow-[0_4px_14px_rgba(0,0,0,0.28)] ring-1 ring-black/10 transition-colors duration-200 hover:bg-black hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-black active:scale-95 md:h-10 md:w-auto md:max-w-[min(14rem,calc(100%-1.5rem))] md:px-3.5"
        >
          <Tag className="h-4 w-4 shrink-0" />
          <span className="hidden md:inline text-sm font-bold truncate">
            {applyLabel}
          </span>
        </button>
      </div>

      <Link href={href} className="pt-3 flex flex-col min-w-0">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 truncate">
          {t("shop.promo.offerBadge") || "Offer"}
        </span>
        <h3
          className={cn(
            "font-bold leading-snug text-foreground",
            compactMobile
              ? "text-[15px] md:text-base line-clamp-2"
              : "text-base md:text-lg line-clamp-2",
          )}
        >
          {promo.name || t("promotions.untitled") || "Promotion"}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
          {t("shop.promo.viewOffer") || "View offer"}
        </p>
      </Link>
    </div>
  )
}
