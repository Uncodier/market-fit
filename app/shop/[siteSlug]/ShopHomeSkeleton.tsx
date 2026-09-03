"use client"

import { Skeleton } from "@/app/components/ui/skeleton"
import {
  Search,
  ShoppingCart,
  User,
  CreditCard,
  Moon,
  Share,
} from "@/app/components/ui/icons"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import { CatalogListingCardSkeleton } from "@/app/components/commerce/CatalogListingCardSkeleton"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  resolveShopHomeSkeletonLayout,
  type ShopHomeSkeletonSite,
} from "./shop-home-skeleton-layout"

function ShopSkeletonHeader({
  logoUrl,
  siteName,
}: {
  logoUrl: string | null
  siteName: string
}) {
  const { t } = useLocalization()
  return (
    <>
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        hideCenterOnMobile
        brand={
          logoUrl ? (
            <span className="shrink-0 flex items-center">
              <img
                src={logoUrl}
                alt={siteName || ""}
                className="w-8 h-8 min-w-8 rounded-full object-cover border border-border shadow-sm shrink-0"
              />
            </span>
          ) : siteName ? (
            <span className="text-xl font-black tracking-tight text-gray-900 dark:text-gray-100 truncate max-w-[150px] md:max-w-none">
              {siteName}
            </span>
          ) : (
            <Skeleton className="w-8 h-8 min-w-8 rounded-full shrink-0" />
          )
        }
        center={
          <div className="hidden md:block absolute left-1/2 top-1/2 z-[15] w-2/5 -translate-x-1/2 -translate-y-1/2">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Skeleton className="w-full h-9 rounded-full" />
            </div>
          </div>
        }
        actions={
          <div className="flex items-center justify-end gap-1 md:gap-3 min-w-0">
            <div className="md:hidden">
              <button
                type="button"
                className={shellClasses.iconButton}
                disabled
                aria-hidden
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
            <div
              data-commerce-shell-actions-core
              className="flex items-center justify-end gap-4 min-w-0"
            >
              <div className="hidden md:contents">
                <button
                  type="button"
                  className={`relative ${shellClasses.iconButton}`}
                  disabled
                  aria-hidden
                >
                  <Share className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                className={`relative ${shellClasses.iconButton}`}
                disabled
              >
                <ShoppingCart className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={`md:hidden ${shellClasses.iconButton}`}
                disabled
                aria-hidden
              >
                <User className="h-4 w-4" />
              </button>
              <span className={`hidden md:inline-flex ${shellClasses.primaryCta} ml-1`}>
                {t("shop.signIn") || "Sign In"}
              </span>
            </div>
          </div>
        }
      />
    </>
  )
}

function ShopSkeletonHero({
  showOrderBar,
  showBadges,
  heroTitle,
  heroSubtitle,
  heroImageUrl,
  heroCtaLabel,
}: {
  showOrderBar: boolean
  showBadges: boolean
  heroTitle: string
  heroSubtitle: string
  heroImageUrl: string | null
  heroCtaLabel: string
}) {
  const cta = heroCtaLabel ? (
    <span className="inline-flex h-14 items-center px-8 text-lg rounded-full font-semibold shadow-lg bg-white text-gray-900">
      {heroCtaLabel}
    </span>
  ) : (
    <Skeleton className="h-14 w-40 rounded-full bg-white/20" />
  )

  return (
    <div
      data-testid="shop-skeleton-hero"
      className="text-white h-[580px] md:h-[550px] -mt-[88px] md:-mt-[104px] relative overflow-hidden flex items-center bg-gray-100 dark:bg-gray-900"
    >
      <div className="absolute inset-0 z-0">
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt=""
            className="object-cover md:object-center object-top w-full h-full"
          />
        ) : (
          <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent md:bg-gradient-to-r md:from-black/80 md:via-black/50 md:to-transparent" />
      </div>
      <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10 text-center md:text-left flex flex-col items-center md:items-start w-full pt-[88px] md:pt-[104px] pb-20">
        {heroTitle ? (
          <h1 className="text-4xl md:text-6xl font-black mb-3 md:mb-6 leading-tight max-w-3xl drop-shadow-md">
            {heroTitle}
          </h1>
        ) : (
          <Skeleton className="h-10 md:h-16 w-3/4 max-w-2xl mb-3 md:mb-6 bg-white/20" />
        )}
        {heroSubtitle ? (
          <p className="text-base md:text-xl text-gray-300 max-w-xl mb-6 md:mb-10 drop-shadow-md">
            {heroSubtitle}
          </p>
        ) : (
          <Skeleton className="h-5 md:h-7 w-1/2 max-w-xl mb-6 md:mb-10 bg-white/20" />
        )}

        {showBadges && (
          <div className="md:hidden w-full max-w-md mb-5 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-start gap-1.5 rounded-2xl bg-white/10 px-2 py-2.5"
              >
                <Skeleton className="h-4 w-4 rounded-full bg-white/20 shrink-0" />
                <div className="w-full flex flex-col items-center gap-1 mt-0.5">
                  <Skeleton className="h-3 w-16 bg-white/20" />
                  <Skeleton className="h-2 w-12 bg-white/20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {showOrderBar ? <div className="lg:hidden">{cta}</div> : cta}
      </div>

      {showOrderBar ? (
        <div
          data-testid="shop-skeleton-fulfillment"
          className="absolute inset-x-0 bottom-3 md:bottom-4 z-10"
        >
          <div className="max-w-7xl mx-auto px-3 md:px-8">
            <div className="shop-fulfillment-bar shop-fulfillment-bar--hero flex items-center justify-between w-full gap-2 min-h-14">
              <div className="flex items-center gap-2 min-w-0 min-h-14 w-[320px] max-w-[calc(100%-3.75rem)] lg:w-auto lg:max-w-none">
                <Skeleton className="h-14 w-full max-w-[320px] lg:w-[320px] rounded-full bg-white/20" />
                <div className="hidden lg:block shrink-0">
                  <Skeleton className="h-14 w-14 rounded-full bg-white/20" />
                </div>
              </div>
              <div className="hidden lg:flex justify-center items-center">{cta}</div>
              <div className="shrink-0 lg:min-w-0">
                <div className="lg:hidden">
                  <Skeleton className="h-14 w-14 rounded-full bg-white/20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function ShopHomeSkeleton({
  site,
  hasCategories,
}: {
  site?: ShopHomeSkeletonSite | null
  hasCategories?: boolean
}) {
  const layout = resolveShopHomeSkeletonLayout(site, hasCategories)

  return (
    <div
      data-testid="shop-home-skeleton"
      className="flex flex-col min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
    >
      <ShopSkeletonHeader logoUrl={layout.logoUrl} siteName={layout.siteName} />

      {layout.showHero ? (
        <ShopSkeletonHero
          showOrderBar={layout.showOrderBar}
          showBadges={layout.showBadges}
          heroTitle={layout.heroTitle}
          heroSubtitle={layout.heroSubtitle}
          heroImageUrl={layout.heroImageUrl}
          heroCtaLabel={layout.heroCtaLabel}
        />
      ) : layout.showOrderBar ? (
        <div
          data-testid="shop-skeleton-fulfillment"
          className="max-w-7xl mx-auto px-4 md:px-8 pt-5 md:pt-8 w-full"
        >
          <div className="flex items-center gap-2 min-h-14 mb-5 md:mb-6">
            <Skeleton className="h-14 w-[320px] max-w-full rounded-full" />
            <Skeleton className="h-14 w-14 rounded-full shrink-0" />
          </div>
        </div>
      ) : null}

      {layout.showBadges && (
        <div
          data-testid="shop-skeleton-trust"
          className={`bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 ${
            layout.showHero ? "hidden md:block" : ""
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              {Array.from({ length: layout.badgeCount }).map((_, i) => (
                <div key={i} className="flex flex-col items-center justify-center gap-2">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex flex-col items-center gap-1.5">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 pt-5 pb-8 md:pt-8 md:pb-12 w-full">
        {layout.hasCategories && (
          <div
            data-testid="shop-skeleton-categories"
            className="sticky top-[72px] z-30 -mx-4 md:mx-0 pt-2 pb-4 mb-6"
          >
            <div className="flex overflow-x-auto gap-3 scrollbar-hide w-full items-center px-4 md:px-0 py-2">
              {[36, 24, 32, 28, 20].map((w, i) => (
                <Skeleton
                  key={i}
                  className="flex-shrink-0 h-9 rounded-full"
                  style={{ width: `${w * 4}px` }}
                />
              ))}
            </div>
          </div>
        )}

        {layout.hasCategories ? (
          <div data-testid="shop-skeleton-section-heading" className="mb-6">
            <Skeleton className="h-8 w-40" />
          </div>
        ) : (
          <div
            data-testid="shop-skeleton-trending"
            className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 justify-between"
          >
            <Skeleton className="h-8 w-40" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <CatalogListingCardSkeleton key={i} />
          ))}
        </div>
      </main>

      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          {layout.siteName ? (
            <div className="text-2xl font-black tracking-tight text-gray-400 dark:text-gray-600">
              {layout.siteName}
            </div>
          ) : (
            <Skeleton className="h-8 w-32" />
          )}
          <Skeleton className="h-4 w-64" />
          <div className="flex items-center gap-2">
            <CreditCard className="h-8 w-8 text-gray-300 dark:text-gray-700" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <button
              type="button"
              disabled
              className="rounded-full h-9 w-9 inline-flex items-center justify-center"
              aria-hidden
            >
              <Moon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
