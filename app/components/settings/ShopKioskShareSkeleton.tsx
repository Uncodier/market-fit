import { Skeleton } from "../ui/skeleton"

export function ShopKioskShareSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <span className="sr-only">Loading locations…</span>
      <div aria-hidden="true" className="space-y-4 [&_.animate-pulse]:motion-reduce:animate-none">
        <div className="flex flex-wrap gap-0.5 rounded-md bg-muted p-0.5">
          <Skeleton className="h-7 w-28 max-w-full bg-background/70" />
          <Skeleton className="h-7 w-32 max-w-full bg-background/70" />
          <Skeleton className="h-7 w-24 max-w-full bg-background/70" />
        </div>
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <div className="flex items-center gap-4 w-full md:w-auto shrink-0 justify-center">
            <div className="shrink-0 bg-white p-1.5 rounded-lg border shadow-sm">
              <Skeleton className="h-[72px] w-[72px]" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
          </div>
          <div className="hidden md:block w-px h-16 bg-border shrink-0" />
          <div className="flex-1 min-w-0 space-y-2 w-full">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-1.5 pl-3">
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-8 w-8 shrink-0" />
              <Skeleton className="h-8 w-8 shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}