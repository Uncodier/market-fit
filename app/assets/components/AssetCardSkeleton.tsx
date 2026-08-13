"use client"

import { Card } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"

export function AssetCardSkeleton() {
  return (
    <Card className="group relative overflow-hidden transition-all duration-300">
      <div className="aspect-square w-full relative overflow-hidden bg-gradient-to-br from-muted/50 to-muted/70">
        <div className="w-full h-full animate-pulse">
          <Skeleton className="w-full h-full" />
        </div>
        <div className="absolute top-2 right-2 animate-pulse">
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="p-4">
        <div className="flex flex-col gap-3">
          <div className="animate-pulse">
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="flex flex-wrap gap-1.5 animate-pulse">
            <Skeleton className="h-4 w-12 rounded-full" />
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
        </div>
      </div>
    </Card>
  )
}
