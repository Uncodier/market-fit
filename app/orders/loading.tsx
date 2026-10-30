import { Skeleton } from "@/app/components/ui/skeleton"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { OrdersKanbanSkeleton } from "./components/OrdersKanban"

export default function OrdersLoading() {
  return (
    <div role="status" aria-label="Loading orders" aria-busy="true" className="flex-1 min-w-0 w-full bg-muted/30 min-h-[calc(100vh-var(--topbar-height,64px))] flex flex-col">
      <StickyHeader>
        <div aria-hidden="true" className="flex w-full min-w-0 items-center justify-between gap-3 py-3">
          <Skeleton className="h-8 w-24 rounded-full md:w-80" />
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="hidden h-9 w-40 rounded-full md:block" />
            <Skeleton className="hidden h-9 w-52 rounded-full lg:block" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>
      </StickyHeader>
      <div aria-hidden="true" className="flex-1 min-h-0 min-w-0 overflow-y-auto py-4 md:py-8">
        <OrdersKanbanSkeleton />
      </div>
    </div>
  )
}
