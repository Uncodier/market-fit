"use client"

import React from "react"
import Link from "next/link"
import { Plus } from "@/app/components/ui/icons"
import { CatalogItem } from "@/app/types"
import type { PromoBadge } from "@/app/promotions/promotion-merchandising"
import { promoBadgeLabel } from "@/app/promotions/promotion-merchandising"
import { resolveItemImage } from "@/app/lib/image-utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import {
  getListingTypeLabel,
  getListingCtaLabel,
  getListingPriceSuffix
} from "@/app/catalog/product-details"

interface CatalogListingCardProps {
  item: CatalogItem & { 
    site?: { id: string; name: string; logo_url?: string | null };
    _shop?: {
      availableQty?: number
      sellable?: boolean
      categoryName?: string
      hasVariants?: boolean
      variantLabels?: string[]
    };
  }
  href: string
  onPrimaryAction: (item: any) => void
  showSeller?: boolean
  primaryDisabled?: boolean
  disabledLabel?: string
  descriptionLineClamp?: "line-clamp-1" | "line-clamp-2" | "none"
  isOwned?: boolean
  canBook?: boolean
  /** Dense 2-col tile on mobile (square image); slightly taller media from md up */
  compactMobile?: boolean
  locationAvailable?: boolean
  /** Item-specific promotion flag (does not replace PDP navigation). */
  promoBadge?: PromoBadge | null
}

function formatListingPrice(
  item: CatalogListingCardProps["item"],
  formatPrice: (amount: number, currency?: string) => string,
  t: (key: string) => string
) {
  if (item.is_dynamic_price) {
    const min = item.metadata?.dynamic_pricing?.min_price ?? item.lowest_sale_price
    if (min != null) {
      return `${t('catalog.dynamicPricing.from') || 'From'} ${formatPrice(Number(min), item.currency || 'USD')}`
    }
    return t('catalog.dynamicPricing.quote') || 'Quote'
  }
  return formatPrice(item.target_sale_price || 0, item.currency || 'USD')
}

export function CatalogListingCard({
  item,
  href,
  onPrimaryAction,
  showSeller = false,
  primaryDisabled = false,
  disabledLabel = "Sold Out",
  descriptionLineClamp = "line-clamp-2",
  isOwned = false,
  canBook = false,
  compactMobile = false,
  locationAvailable = true,
  promoBadge = null,
}: CatalogListingCardProps) {
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()

  const typeLabelKey = getListingTypeLabel(item)
  const ctaLabelKey = getListingCtaLabel(item, { isOwned, canBook })
  const priceSuffixKey = getListingPriceSuffix(item)
  const priceLabel = formatListingPrice(item, formatPrice, t)
  const isSoldOut = !item._shop?.sellable && item._shop?.availableQty === 0
  const actionDisabled = isSoldOut || primaryDisabled
  const showTypeBadge = typeLabelKey !== 'marketplace.listing.badge.product'
  const descClamp =
    descriptionLineClamp === "none" ? "" : descriptionLineClamp

  const isLocationRestricted = !locationAvailable;
  const finalActionDisabled = isLocationRestricted || actionDisabled;
  const finalDisabledLabel = isLocationRestricted
    ? (t('shop.locationRestricted') || 'Location')
    : disabledLabel;

  const handlePrimary = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!finalActionDisabled) onPrimaryAction(item)
  }

  return (
    <div className="group min-w-0 w-full flex flex-col">
      <div
        className={`relative w-full overflow-hidden rounded-2xl bg-muted shrink-0 ${
          compactMobile ? "aspect-square md:aspect-[4/3]" : "aspect-[4/3]"
        }`}
      >
        <Link href={href} className="absolute inset-0 z-0" aria-label={item.name}>
          <img
            src={resolveItemImage(item)}
            alt=""
            onError={(e) => { e.currentTarget.style.opacity = '0' }}
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          />
        </Link>

        {/* Soft bottom scrim so the CTA stays readable on light photos */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 via-black/20 to-transparent"
          aria-hidden
        />

        {/* Status badges */}
        <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-1">
          {promoBadge && (
            <Link
              href={promoBadge.href}
              onClick={(e) => e.stopPropagation()}
              className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white shadow-sm uppercase tracking-wider hover:bg-emerald-700"
            >
              {promoBadge.discount_type
                ? promoBadgeLabel(promoBadge, t)
                : promoBadge.label}
            </Link>
          )}
          {showTypeBadge && (
            <span className="rounded-md bg-white/95 px-2 py-1 text-[11px] font-bold text-black shadow-sm uppercase tracking-wider">
              {t(typeLabelKey) || typeLabelKey.split('.').pop()}
            </span>
          )}
          {!locationAvailable && (
            <span className="rounded-md bg-red-600/95 backdrop-blur-sm px-2 py-1 text-[11px] font-bold text-white shadow-sm uppercase tracking-wider">
              {t('shop.locationRestricted') || 'Location'}
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={finalActionDisabled}
          onClick={handlePrimary}
          aria-label={finalActionDisabled ? finalDisabledLabel : (t(ctaLabelKey) || 'Add')}
          className="absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center gap-1.5 rounded-full bg-white text-black shadow-[0_4px_14px_rgba(0,0,0,0.28)] ring-1 ring-black/10 transition-colors duration-200 hover:bg-black hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-black active:scale-95 md:h-10 md:w-auto md:max-w-[min(14rem,calc(100%-1.5rem))] md:px-3.5"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="hidden md:inline text-sm font-bold truncate">
            {finalActionDisabled ? finalDisabledLabel : (t(ctaLabelKey) || 'Add')}
          </span>
        </button>
      </div>

      <Link href={href} className="pt-3 flex flex-col min-w-0">
        {showSeller && item.site && (
          <span className="text-[11px] text-muted-foreground mb-0.5 truncate">
            {item.site.name}
          </span>
        )}

        {!showSeller && item._shop?.categoryName && (
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 truncate">
            {item._shop.categoryName}
          </span>
        )}

        <h3
          className={`font-bold leading-snug text-foreground ${
            compactMobile
              ? "text-[15px] md:text-base line-clamp-2"
              : "text-base md:text-lg line-clamp-2"
          }`}
        >
          {item.name}
        </h3>

        <div className="mt-1 text-sm md:text-[15px] font-medium text-foreground">
          {priceLabel}
          {priceSuffixKey && (
            <span className="text-xs text-muted-foreground ml-1 font-normal">
              {t(priceSuffixKey) || '/mo'}
            </span>
          )}
        </div>

        {!!item._shop?.variantLabels?.length && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {item._shop.variantLabels.slice(0, 3).map((label) => (
              <span
                key={label}
                className="inline-flex max-w-[7.5rem] truncate rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-muted-foreground"
              >
                {label}
              </span>
            ))}
            {item._shop.variantLabels.length > 3 && (
              <span className="text-[10px] font-semibold text-muted-foreground">
                +{item._shop.variantLabels.length - 3}
              </span>
            )}
          </div>
        )}

        {item.description && descriptionLineClamp !== "none" && (
          <p className={`text-xs text-muted-foreground mt-1 ${descClamp || "line-clamp-1"}`}>
            {item.description}
          </p>
        )}

        {!showSeller &&
          item._shop?.availableQty !== undefined &&
          item._shop.availableQty <= 5 &&
          item._shop.availableQty > 0 && (
            <span className="mt-1.5 text-xs font-medium text-destructive">
              {t('shop.onlyLeft', { count: item._shop.availableQty }) ||
                `Only ${item._shop.availableQty} left`}
            </span>
          )}
      </Link>
    </div>
  )
}
