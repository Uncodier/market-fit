import { Skeleton } from "@/app/components/ui/skeleton"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { ReservationsTableSkeleton } from "./components/reservation-table"

export default function ReservationsLoading() {
  return (
    <div role="status" aria-label="Loading reservations" aria-busy="true" className="flex-1 flex flex-col min-h-0 min-w-0 h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div aria-hidden="true" className="flex w-full min-w-0 items-center justify-between gap-3 py-3">
          <Skeleton className="h-8 w-24 rounded-full md:w-64" />
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="hidden h-9 w-40 rounded-full md:block" />
            <Skeleton className="hidden h-8 w-16 rounded-full sm:block" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
      </StickyHeader>
      <div aria-hidden="true" className="flex flex-wrap items-center gap-2 px-4 py-2 border-b">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div aria-hidden="true" className="p-4 md:p-6 lg:p-8 flex-1 min-h-0 min-w-0 overflow-auto">
        <ReservationsTableSkeleton />
      </div>
    </div>
  )
}
