"use client"

import { Button } from "@/app/components/ui/button"
import { ShieldCheck, Truck, RotateCcw } from "@/app/components/ui/icons"
import { optimizeForPreset, resolveItemImage } from "@/app/lib/image-utils"
import { useLocalization } from "@/app/context/LocalizationContext"

function badgeIcon(icon?: string) {
  if (icon === "Truck") return Truck
  if (icon === "RotateCcw") return RotateCcw
  return ShieldCheck
}

export function ShopHeroTrust({
  site,
  searchQuery,
  isOpen = true,
  nextOpenSlot = null,
  locationAvailable = true,
  deliveryTimeLabel
}: {
  site: any
  searchQuery: string
  isOpen?: boolean
  nextOpenSlot?: { at: Date; label: string } | null
  locationAvailable?: boolean
  deliveryTimeLabel?: string | null
}) {
  const { t } = useLocalization()
  const shop = site?.settings?.shop
  const badges: any[] = shop?.trust_badges?.length ? shop.trust_badges : []
  const showHero = !searchQuery && !!(shop?.hero_title || shop?.hero_image_url)
  const showBadges = !searchQuery && badges.length > 0

  return (
    <>
      {showHero && (
        // Cover bleeds under sticky navbar.
        // Mobile offset ≈ spacer (16) + header (56) + mb (16) = 88px.
        // Desktop offset ≈ spacer (16) + header (56) + mb (32) = 104px.
        <div className="text-white h-[580px] md:h-[550px] -mt-[88px] md:-mt-[104px] relative overflow-hidden flex items-end md:items-center bg-gray-100 dark:bg-gray-900">
          <div className="absolute inset-0 z-0">
            <img
              src={
                shop?.hero_image_url
                  ? optimizeForPreset(shop.hero_image_url, "full")
                  : resolveItemImage(
                      {
                        name: shop?.hero_title || site.name,
                        description:
                          shop?.hero_subtitle || site.description || "store hero",
                        siteDescription: site.description,
                      },
                      "full",
                    )
              }
              alt=""
              decoding="async"
              fetchPriority="high"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent md:bg-gradient-to-r md:from-black/80 md:via-black/50 md:to-transparent" />
          </div>
          <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10 text-center md:text-left flex flex-col items-center md:items-start w-full pb-10 md:pb-0 pt-[88px] md:pt-[104px]">
            {(!isOpen || !locationAvailable || deliveryTimeLabel) && (
              <div className="mb-4 flex flex-wrap gap-2 justify-center md:justify-start">
                {!isOpen && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white shadow-sm">
                    <span className="relative flex h-2 w-2" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                    {nextOpenSlot
                      ? (t("shop.closedOpens", { time: nextOpenSlot.label }) || `Closed · Opens ${nextOpenSlot.label}`)
                      : (t("shop.closed") || "Closed")}
                  </span>
                )}
                {!locationAvailable && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white shadow-sm">
                    <span className="relative flex h-2 w-2" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                    {t("shop.unavailableInYourArea") || "Unavailable in your area"}
                  </span>
                )}
                {deliveryTimeLabel && isOpen && locationAvailable && (
                  <span className="flex items-center gap-2 text-lg md:text-xl font-bold text-white drop-shadow-md">
                    <Truck className="w-5 h-5 md:w-6 md:h-6" />
                    {deliveryTimeLabel}
                  </span>
                )}
              </div>
            )}
            {shop?.hero_title && (
              <h1 className="text-4xl md:text-6xl font-black mb-3 md:mb-6 leading-tight max-w-3xl drop-shadow-md">
                {shop.hero_title}
              </h1>
            )}
            {shop?.hero_subtitle && (
              <p className="text-base md:text-xl text-gray-300 max-w-xl mb-6 md:mb-10 drop-shadow-md">
                {shop.hero_subtitle}
              </p>
            )}

            {/* Mobile metrics — compact row inside the hero, above the CTA */}
            {showBadges && (
              <div className="md:hidden w-full max-w-md mb-5 grid grid-cols-3 gap-2">
                {badges.slice(0, 3).map((badge: any, i: number) => {
                  const IconComponent = badgeIcon(badge.icon)
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center justify-start gap-1.5 rounded-2xl bg-white/10 backdrop-blur-md px-2 py-2.5 border border-white/10"
                    >
                      <IconComponent className="h-4 w-4 text-white shrink-0" />
                      <div className="min-w-0 w-full text-center">
                        <div className="text-[11px] font-bold text-white leading-tight truncate">
                          {badge.title}
                        </div>
                        {badge.subtitle ? (
                          <div className="text-[10px] text-white/70 leading-tight truncate mt-0.5">
                            {badge.subtitle}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              className="h-14 px-8 text-lg rounded-full !bg-white !text-black hover:!bg-black hover:!text-white font-semibold !shadow-lg transition-colors"
              onClick={() =>
                window.scrollBy({ top: window.innerHeight * 0.7, behavior: "smooth" })
              }
            >
              {shop?.hero_cta_label || t("shop.shopNow") || "Shop Now"}
            </Button>
          </div>
        </div>
      )}

      {/* Desktop trust strip — or mobile fallback when there is no hero */}
      {showBadges && (
        <div
          className={`bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 ${
            showHero ? "hidden md:block" : ""
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              {badges.map((badge: any, i: number) => {
                const IconComponent = badgeIcon(badge.icon)
                return (
                  <div key={i} className="flex flex-col items-center justify-center gap-2">
                    <div className="bg-white dark:bg-gray-950 p-3 rounded-full shadow-sm">
                      <IconComponent className="h-6 w-6 text-black dark:text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100">{badge.title}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{badge.subtitle}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
