import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Skeleton } from "@/app/components/ui/skeleton"

export function PageHeaderSkeleton({ showActions = true }: { showActions?: boolean }) {
  return (
    <StickyHeader>
      <div aria-hidden="true" className="flex w-full min-w-0 items-center justify-between gap-4 py-2">
        <div className="flex min-w-0 items-center gap-1 overflow-hidden rounded-full bg-muted/30 p-0.5">
          <Skeleton className="h-7 w-20 shrink-0 rounded-full motion-reduce:animate-none" />
          <Skeleton className="h-7 w-24 shrink-0 rounded-full motion-reduce:animate-none" />
          <Skeleton className="hidden h-7 w-20 shrink-0 rounded-full motion-reduce:animate-none sm:block" />
        </div>
        {showActions && (
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="hidden h-9 w-40 rounded-full motion-reduce:animate-none md:block" />
            <Skeleton className="h-9 w-9 rounded-md motion-reduce:animate-none md:w-32 md:rounded-full" />
          </div>
        )}
      </div>
    </StickyHeader>
  )
}