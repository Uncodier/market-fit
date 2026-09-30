import { Skeleton } from "@/app/components/ui/skeleton"

export function RecentActivityLoading({ limit = 6 }: { limit?: number }) {
  return <div role="status" aria-label="Loading recent activity" aria-busy="true" className="grid min-w-0 gap-2">
    <span className="sr-only">Loading recent activity…</span>
    {Array.from({ length: limit }, (_, index) => <div key={index} aria-hidden="true" className="-mx-2 flex min-w-0 items-center gap-4 rounded-lg p-2">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex h-5 items-center"><Skeleton className="h-4 w-[250px] max-w-full" /></div>
        <div className="relative text-xs leading-relaxed">
          <span className="invisible">Activity detail</span>
          <Skeleton className="absolute left-0 top-1/2 h-3 w-[200px] max-w-full -translate-y-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-12 shrink-0" />
    </div>)}
  </div>
}