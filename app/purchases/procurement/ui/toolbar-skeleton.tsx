'use client'

import { StickyHeader } from '@/app/components/ui/sticky-header'
import { Skeleton } from '@/app/components/ui/skeleton'

/** Mirrors ProcurementToolbar's mobile filter button and desktop filter/action groups. */
export function ProcurementToolbarSkeleton() {
  return <StickyHeader>
    <div aria-hidden="true" className="flex w-full min-w-0 items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <Skeleton className="h-8 w-8 shrink-0 rounded-full motion-reduce:animate-none md:hidden" />
        <div className="hidden min-w-0 items-center gap-2 overflow-hidden md:flex">
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted/30 p-1">
            {[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-6 w-16 rounded-full motion-reduce:animate-none" />)}
          </div>
          <Skeleton className="h-9 w-52 shrink-0 rounded-full motion-reduce:animate-none" />
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Skeleton className="h-8 w-24 rounded-full motion-reduce:animate-none" />
        <Skeleton className="h-8 w-8 rounded-full motion-reduce:animate-none" />
      </div>
    </div>
  </StickyHeader>
}