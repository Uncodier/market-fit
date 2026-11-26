"use client"

import { CommerceShellHeader } from "@/app/components/commerce/CommerceShellHeader"
import { MakinariHeaderIsotype } from "@/app/components/commerce/MakinariHeaderIsotype"
import { CatalogListingCardSkeleton } from "@/app/components/commerce/CatalogListingCardSkeleton"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ShopHeroSlide, shopHeroFrameClass } from "../ShopHeroSlide"

export function SelfServiceShopSkeleton() {
  const { t } = useLocalization()
  return <div role="status" aria-label={t("shop.selfService.loading")} aria-busy="true" className="flex min-h-screen flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
    <div aria-hidden="true">
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader hideCenterOnMobile
        brand={<><MakinariHeaderIsotype alt="" /><Skeleton className="hidden md:block h-8 w-28 rounded-full" /></>}
        center={<div className="absolute left-1/2 top-1/2 hidden w-2/5 -translate-x-1/2 -translate-y-1/2 md:block"><Skeleton className="h-9 w-full rounded-full" /></div>}
        actions={<div className="flex items-center gap-4">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-9 w-9 rounded-full" />)}</div>} />
      <div data-testid="self-service-skeleton-hero" className={shopHeroFrameClass}>
        <ShopHeroSlide background={<Skeleton className="absolute inset-0 h-full w-full rounded-none" />}>
          <Skeleton className="mb-3 h-10 w-3/4 max-w-2xl bg-white/20 md:mb-6 md:h-16" />
          <Skeleton className="mb-6 h-5 w-1/2 max-w-xl bg-white/20 md:mb-10 md:h-7" />
          <Skeleton className="h-14 w-40 rounded-full bg-white/20" />
        </ShopHeroSlide>
      </div>
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 pt-5 md:px-8">
        <Skeleton className="h-5 w-48" /><Skeleton className="h-10 w-48 rounded-full" />
      </div>
      <main className="mx-auto w-full max-w-7xl px-4 pb-8 pt-5 md:px-8 md:pb-12 md:pt-8">
        <div className="mb-6 flex gap-3 overflow-hidden py-2">{["w-28", "w-24", "w-32", "w-28"].map((width, index) => <Skeleton key={index} className={`h-9 shrink-0 rounded-full ${width}`} />)}</div>
        <Skeleton className="mb-6 h-8 w-40" />
        <div data-testid="self-service-skeleton-products" className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <CatalogListingCardSkeleton key={index} />)}
        </div>
      </main>
    </div>
  </div>
}