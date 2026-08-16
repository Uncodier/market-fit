"use client"

import React, { ReactNode } from "react"
import { CatalogListingCardSkeleton } from "@/app/components/commerce/CatalogListingCardSkeleton"

const COMPACT_THRESHOLD = 10

export function shouldUseCompactMobileListing(totalCount: number) {
  return totalCount > COMPACT_THRESHOLD
}

export function commerceProductGridClassName(
  compactMobile: boolean,
  maxCols: 3 | 4 = 4
) {
  const desktopCols =
    maxCols === 3
      ? "md:grid-cols-2 lg:grid-cols-3"
      : "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

  if (compactMobile) {
    // Uber Eats–style dense 2-col tiles on mobile; restore desktop card grid from md up
    return `grid grid-cols-2 gap-x-3 gap-y-6 items-start md:grid ${desktopCols} md:gap-6 lg:gap-8`
  }
  return `grid grid-cols-1 sm:grid-cols-2 ${maxCols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-3 xl:grid-cols-4"} gap-6 md:gap-8`
}

interface CommerceProductGridProps {
  totalCount: number
  isLoading?: boolean
  skeletonCount?: number
  showSeller?: boolean
  maxCols?: 3 | 4
  children: ReactNode
  emptyState?: ReactNode
  isEmpty?: boolean
}

export const CommerceProductGrid = React.memo(function CommerceProductGrid({
  totalCount,
  isLoading = false,
  skeletonCount = 8,
  showSeller = false,
  maxCols = 4,
  children,
  emptyState,
  isEmpty = false,
}: CommerceProductGridProps) {
  const compactMobile = shouldUseCompactMobileListing(totalCount)

  return (
    <div className={commerceProductGridClassName(compactMobile, maxCols)}>
      {isLoading ? (
        Array.from({ length: skeletonCount }).map((_, i) => (
          <CatalogListingCardSkeleton
            key={i}
            showSeller={showSeller}
            compactMobile={compactMobile}
          />
        ))
      ) : isEmpty ? (
        emptyState
      ) : (
        children
      )}
    </div>
  )
})

export { COMPACT_THRESHOLD }
