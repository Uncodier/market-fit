import { Skeleton } from "@/app/components/ui/skeleton"
import { StickyHeader } from "@/app/components/ui/sticky-header"

export default function CatalogLoading() {
  return (
    <div role="status" aria-label="Loading catalog" aria-busy="true" className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] min-h-0">
      <StickyHeader>
        <div aria-hidden="true" className="flex w-full min-w-0 items-center justify-between gap-4 py-3">
          <Skeleton className="h-8 w-24 rounded-full md:w-64" />
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="hidden h-9 w-40 rounded-full md:block" />
            <Skeleton className="hidden h-8 w-20 sm:block" />
            <Skeleton className="hidden h-8 w-28 sm:block" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>
      </StickyHeader>
      <div aria-hidden="true" className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 md:p-6 space-y-4">
        {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
      </div>
    </div>
  )
}
