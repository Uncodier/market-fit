import { Skeleton } from "@/app/components/ui/skeleton"
import { StickyHeader } from "@/app/components/ui/sticky-header"

export function BuyerQuoteDetailSkeleton({ scope = "personal" }: { scope?: "personal" | "site" }) {
  const header = <div aria-hidden="true" className="flex w-full items-center gap-4">
    <Skeleton className="h-10 w-10 rounded-full" />
    <div className="space-y-1">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-3 w-28" />
    </div>
  </div>
  return (
    <div className="flex-1 flex flex-col min-h-full" role="status" aria-label="Loading" aria-busy="true">
      {scope === "site" ? <StickyHeader>{header}</StickyHeader> :
        <div className="bg-transparent min-h-[72px] flex items-center w-full">{header}</div>}
      <div aria-hidden="true" className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-card rounded-lg shadow-lg overflow-hidden border border-border">
            <div className="p-6 border-b border-border bg-muted/50 flex justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" /><Skeleton className="h-8 w-36" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-28" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
            <div className="p-6 border-b grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[1, 2].map(i => <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" /><Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-44" />
              </div>)}
            </div>
            <div className="p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <div className="border rounded-md overflow-hidden">
                {[1, 2, 3].map(i => <div key={i} className="grid grid-cols-[1fr_40px_64px_64px] gap-4 p-4 border-b last:border-0">
                  <Skeleton className="h-4 w-3/4" />
                  {[1, 2, 3].map(j => <Skeleton key={j} className="h-4 w-full" />)}
                </div>)}
              </div>
              <div className="mt-6 ml-auto w-full max-w-[300px] space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="flex justify-between gap-4 last:border-t last:pt-2">
                  <Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-24" />
                </div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}