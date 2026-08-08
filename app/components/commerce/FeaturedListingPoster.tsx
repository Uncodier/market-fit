"use client"

import Link from "next/link"
import { CatalogItem } from "@/app/types"
import { resolveItemImage } from "@/app/lib/image-utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import {
  getListingTypeLabel,
  getListingMetaChips,
  getListingCtaLabel,
  getListingPriceSuffix,
} from "@/app/catalog/product-details"

type FeaturedItem = CatalogItem & {
  site?: { id: string; name: string; logo_url?: string | null }
  _shop?: { availableQty?: number; sellable?: boolean; categoryName?: string }
}

function formatListingPrice(
  item: FeaturedItem,
  formatPrice: (amount: number, currency?: string) => string,
  t: (key: string) => string
) {
  if (item.is_dynamic_price) {
    const min = item.metadata?.dynamic_pricing?.min_price ?? item.lowest_sale_price
    if (min != null) {
      return `${t("catalog.dynamicPricing.from") || "From"} ${formatPrice(Number(min), item.currency || "USD")}`
    }
    return t("catalog.dynamicPricing.quote") || "Quote"
  }
  return formatPrice(item.target_sale_price || 0, item.currency || "USD")
}

interface FeaturedListingPosterProps {
  item: FeaturedItem
  href: string
  onPrimaryAction: (item: FeaturedItem) => void
  showSeller?: boolean
  primaryDisabled?: boolean
  disabledLabel?: string
  isOwned?: boolean
  canBook?: boolean
  /** Single hero vs compact tile in a 2-up / carousel rail */
  size?: "hero" | "tile"
  isOpen?: boolean
  locationAvailable?: boolean
}

/**
 * Ecommerce-style featured poster: full-bleed image, bottom gradient,
 * title / price / CTA layered without clipping.
 */
export function FeaturedListingPoster({
  item,
  href,
  onPrimaryAction,
  showSeller = false,
  primaryDisabled = false,
  disabledLabel = "Sold Out",
  isOwned = false,
  canBook = false,
  size = "hero",
  isOpen = true,
  locationAvailable = true,
}: FeaturedListingPosterProps) {
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()

  const typeLabelKey = getListingTypeLabel(item)
  const metaChips = getListingMetaChips(item).slice(0, 3)
  const ctaLabelKey = getListingCtaLabel(item, { isOwned, canBook })
  const priceSuffixKey = getListingPriceSuffix(item)
  const priceLabel = formatListingPrice(item, formatPrice, t)
  const isSoldOut = !item._shop?.sellable && item._shop?.availableQty === 0
  const isLocationRestricted = !locationAvailable
  const actionDisabled = isSoldOut || primaryDisabled || isLocationRestricted
  const finalDisabledLabel = isLocationRestricted ? (t("shop.unavailable") || "Unavailable") : disabledLabel
  const isHero = size === "hero"

  const handlePrimary = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!actionDisabled) onPrimaryAction(item)
  }

  return (
    <article
      className={`relative w-full overflow-hidden rounded-2xl border bg-muted shadow-sm group ${
        isHero ? "aspect-[5/4] sm:aspect-[21/9]" : "aspect-[4/5] sm:aspect-[4/3]"
      }`}
    >
      <Link href={href} className="absolute inset-0 z-0" aria-label={item.name}>
        <img
          src={resolveItemImage(item)}
          alt=""
          onError={(e) => {
            e.currentTarget.style.opacity = "0"
          }}
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        {/* Readability scrim — bottom-heavy so text never sits on busy mid-image */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/15"
          aria-hidden
        />
      </Link>

      <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1">
        {typeLabelKey !== "marketplace.listing.badge.product" && (
          <span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold text-black shadow-sm uppercase tracking-wider">
            {t(typeLabelKey) || typeLabelKey.split(".").pop()}
          </span>
        )}
        {!isOpen && (
          <span className="rounded-full bg-red-500/90 backdrop-blur-sm px-2.5 py-1 text-xs font-bold text-white shadow-sm uppercase tracking-wider">
            Closed
          </span>
        )}
        {!locationAvailable && (
          <span className="rounded-md bg-orange-500/90 backdrop-blur-sm px-2.5 py-1 text-xs font-bold text-white shadow-sm uppercase tracking-wider">
            Unavailable
          </span>
        )}
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 z-10 flex flex-col pointer-events-none ${
          isHero ? "p-5 sm:p-7 lg:p-8" : "p-5 sm:p-6"
        }`}
      >
        <div className={`max-w-xl ${isHero ? "sm:max-w-2xl" : ""}`}>
          {showSeller && item.site && (
            <div className="mb-2 flex items-center gap-2">
              {item.site.logo_url ? (
                <img
                  src={item.site.logo_url}
                  alt=""
                  className="h-5 w-5 shrink-0 rounded-full object-cover object-center bg-white/10"
                />
              ) : null}
              <span className="truncate text-xs font-medium text-white/80">{item.site.name}</span>
            </div>
          )}

          {!showSeller && item._shop?.categoryName && (
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/70">
              {item._shop.categoryName}
            </span>
          )}

          <h3
            className={`font-bold leading-tight text-white drop-shadow-sm ${
              isHero ? "text-2xl sm:text-3xl lg:text-4xl" : "text-xl sm:text-2xl"
            }`}
          >
            {item.name}
          </h3>

          {item.description && (
            <p
              className={`mt-2 text-white/85 ${
                isHero ? "text-sm sm:text-base line-clamp-2 sm:line-clamp-3" : "text-sm line-clamp-2"
              }`}
            >
              {item.description}
            </p>
          )}

          {metaChips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {metaChips.map((chip, idx) => (
                <span
                  key={idx}
                  className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm"
                >
                  {chip.value}
                  {chip.labelKey ? ` ${t(chip.labelKey) || chip.labelKey.split(".").pop()}` : ""}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <div
              className={`font-black text-white ${
                isHero ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
              }`}
            >
              {priceLabel}
              {priceSuffixKey && (
                <span className="ml-1.5 text-sm font-normal text-white/70">
                  {t(priceSuffixKey) || "/mo"}
                </span>
              )}
            </div>
            {!showSeller &&
              item._shop?.availableQty !== undefined &&
              item._shop.availableQty <= 5 &&
              item._shop.availableQty > 0 && (
                <span className="mt-1.5 inline-block rounded-md bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-100">
                  {t("shop.onlyLeft", { count: item._shop.availableQty }) ||
                    `Only ${item._shop.availableQty} left`}
                </span>
              )}
          </div>

          <div className="pointer-events-auto relative z-20 flex w-full shrink-0 justify-stretch sm:w-auto sm:justify-end">
            <button
              type="button"
              disabled={actionDisabled}
              onClick={handlePrimary}
              className={`inline-flex w-full items-center justify-center rounded-xl bg-white px-6 font-bold text-black shadow-[0_4px_18px_rgba(0,0,0,0.35)] transition-colors duration-200 hover:bg-black hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-black/40 disabled:shadow-none sm:w-auto ${
                isHero ? "h-12 text-base" : "h-11 text-sm"
              }`}
            >
              {actionDisabled
                ? finalDisabledLabel
                : t(ctaLabelKey) || ctaLabelKey.split(".").pop()}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

interface FeaturedListingsRailProps {
  items: FeaturedItem[]
  getHref: (item: FeaturedItem) => string
  onPrimaryAction: (item: FeaturedItem) => void
  showSeller?: boolean
  getPrimaryDisabled?: (item: FeaturedItem) => boolean
  disabledLabel?: string
  isOwned?: boolean
  getCanBook?: (item: FeaturedItem) => boolean
  isOpen?: boolean
  locationAvailable?: boolean
  getIsOpen?: (item: FeaturedItem) => boolean
  getLocationAvailable?: (item: FeaturedItem) => boolean
}

/** 1 item → hero poster; 2 items → side-by-side posters (ecommerce focus rail). */
export function FeaturedListingsRail({
  items,
  getHref,
  onPrimaryAction,
  showSeller = false,
  getPrimaryDisabled,
  disabledLabel,
  isOwned = false,
  getCanBook,
  isOpen = true,
  locationAvailable = true,
  getIsOpen,
  getLocationAvailable,
}: FeaturedListingsRailProps) {
  if (items.length === 0) return null

  if (items.length === 1) {
    const item = items[0]
    return (
      <FeaturedListingPoster
        item={item}
        href={getHref(item)}
        onPrimaryAction={onPrimaryAction}
        showSeller={showSeller}
        primaryDisabled={getPrimaryDisabled?.(item)}
        disabledLabel={disabledLabel}
        isOwned={isOwned}
        canBook={getCanBook?.(item)}
        size="hero"
        isOpen={getIsOpen ? getIsOpen(item) : isOpen}
        locationAvailable={getLocationAvailable ? getLocationAvailable(item) : locationAvailable}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
      {items.slice(0, 2).map((item) => (
        <FeaturedListingPoster
          key={item.id}
          item={item}
          href={getHref(item)}
          onPrimaryAction={onPrimaryAction}
          showSeller={showSeller}
          primaryDisabled={getPrimaryDisabled?.(item)}
          disabledLabel={disabledLabel}
          isOwned={isOwned}
          canBook={getCanBook?.(item)}
          size="tile"
          isOpen={getIsOpen ? getIsOpen(item) : isOpen}
          locationAvailable={getLocationAvailable ? getLocationAvailable(item) : locationAvailable}
        />
      ))}
    </div>
  )
}

export const FEATURED_LISTING_THRESHOLD = 3
