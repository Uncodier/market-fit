import React from "react"
import { Skeleton } from "@/app/components/ui/skeleton"

export function CatalogListingCardSkeleton({ showSeller = false }: { showSeller?: boolean }) {
  return (
    <div className="bg-card rounded-2xl border overflow-hidden shadow-sm flex flex-col relative h-full">
      {/* Media Skeleton */}
      <Skeleton className="aspect-[4/3] w-full shrink-0 rounded-none" />

      {/* Content Skeleton */}
      <div className="p-5 flex flex-col flex-1">
        {showSeller && (
          <div className="flex items-center gap-2 mb-2 shrink-0">
            <Skeleton className="w-5 h-5 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        )}

        {!showSeller && (
          <Skeleton className="h-3 w-16 mb-2 shrink-0" />
        )}

        <Skeleton className="h-6 w-3/4 mb-2" />
        
        {/* Description lines */}
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-5/6 mb-4" />

        <div className="mt-auto flex items-end justify-between pt-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>
    </div>
  )
}
