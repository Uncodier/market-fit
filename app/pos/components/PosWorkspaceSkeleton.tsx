import { Skeleton } from "@/app/components/ui/skeleton";
import { PosCartPanelSkeleton } from "./PosOrderSkeleton";

/** Presentation only: no private cache, cart, catalog, or synchronization hooks. */
export function PosWorkspaceSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading point of sale"
      aria-busy="true"
      className="flex min-h-[calc(100dvh-var(--topbar-height,64px))] flex-col bg-muted/30 md:flex-row md:items-start"
    >
      <span className="sr-only">Loading point of sale</span>
      <div aria-hidden="true" className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-[71px] items-center gap-3 border-b bg-background/80 px-4">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="hidden h-9 w-28 sm:block" />
          <Skeleton className="hidden h-9 w-24 sm:block" />
          <Skeleton className="ml-auto h-9 w-9 rounded-full" />
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-4">
          {Array.from({ length: 15 }, (_, index) => (
            <div key={index} className="relative flex h-40 min-w-[180px] flex-col overflow-hidden rounded-lg border">
              <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
              <div className="relative mt-auto space-y-2 p-3">
                <Skeleton className="h-4 w-3/4 bg-white/30" />
                <Skeleton className="h-3 w-1/2 bg-white/20" />
                <Skeleton className="h-5 w-1/3 bg-white/40" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="sticky top-[var(--topbar-height,64px)] hidden h-[calc(100dvh-var(--topbar-height,64px))] w-96 flex-none flex-col overflow-hidden border-l bg-card md:flex">
        <PosCartPanelSkeleton />
      </div>
    </div>
  );
}