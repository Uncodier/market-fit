import React from "react"
import { Skeleton } from "@/app/components/ui/skeleton"

/** Borderless listing tile — matches CatalogListingCard (image + text below). */
export function CatalogListingCardSkeleton({
  showSeller = false,
  compactMobile = false,
}: {
  showSeller?: boolean
  compactMobile?: boolean
}) {
  return (
    <div className="min-w-0 w-full flex flex-col">
      <div
        className={`relative w-full overflow-hidden rounded-2xl shrink-0 ${
          compactMobile ? "aspect-square md:aspect-[4/3]" : "aspect-[4/3]"
        }`}
      >
        <Skeleton className="absolute inset-0 h-full w-full rounded-2xl" />
        {/* CTA pill hint (desktop) / circle (mobile) */}
        <Skeleton className="absolute bottom-3 right-3 z-10 h-9 w-9 rounded-full md:h-10 md:w-28" />
      </div>
      <div className="pt-3 space-y-1.5">
        {showSeller ? (
          <Skeleton className="h-3 w-20" />
        ) : (
          <Skeleton className="h-3 w-14" />
        )}
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-[15px] w-2/5" />
        <Skeleton className="h-3 w-full max-w-[90%]" />
      </div>
    </div>
  )
}

/** Poster / featured showcase skeleton — matches FeaturedListingPoster. */
export function FeaturedListingPosterSkeleton({
  size = "hero",
  showSeller = false,
}: {
  size?: "hero" | "tile"
  showSeller?: boolean
}) {
  const isHero = size === "hero"

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border bg-muted ${
        isHero ? "aspect-[5/4] sm:aspect-[21/9]" : "aspect-[4/5] sm:aspect-[4/3]"
      }`}
    >
      <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

      <Skeleton className="absolute top-4 left-4 z-10 h-6 w-20 rounded-md" />

      <div
        className={`absolute inset-x-0 bottom-0 z-10 flex flex-col ${
          isHero ? "p-5 sm:p-7 lg:p-8" : "p-5 sm:p-6"
        }`}
      >
        <div className={`max-w-xl space-y-2 ${isHero ? "sm:max-w-2xl" : ""}`}>
          {showSeller && <Skeleton className="h-3 w-24 bg-white/25" />}
          <Skeleton
            className={`bg-white/25 ${isHero ? "h-8 sm:h-10 w-2/3" : "h-7 w-3/4"}`}
          />
          <Skeleton className="h-4 w-full max-w-md bg-white/20" />
          <Skeleton className="h-4 w-4/5 max-w-sm bg-white/20" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-6 w-16 rounded-md bg-white/20" />
            <Skeleton className="h-6 w-14 rounded-md bg-white/20" />
          </div>
        </div>

        <div className="mt-5 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton
            className={`bg-white/30 ${isHero ? "h-8 sm:h-9 w-40" : "h-7 w-32"}`}
          />
          <Skeleton
            className={`rounded-xl bg-white/90 ${
              isHero ? "h-12 w-full sm:w-36" : "h-11 w-full sm:w-32"
            }`}
          />
        </div>
      </div>
    </div>
  )
}

/** 1 hero or 2 side-by-side tiles — matches FeaturedListingsRail. */
export function FeaturedListingsRailSkeleton({
  count = 1,
  showSeller = false,
}: {
  count?: 1 | 2
  showSeller?: boolean
}) {
  if (count === 1) {
    return <FeaturedListingPosterSkeleton size="hero" showSeller={showSeller} />
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
      <FeaturedListingPosterSkeleton size="tile" showSeller={showSeller} />
      <FeaturedListingPosterSkeleton size="tile" showSeller={showSeller} />
    </div>
  )
}
