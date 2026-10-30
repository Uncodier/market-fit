import type { ReactNode } from "react"
import { Skeleton } from "@/app/components/ui/skeleton"
import { QuotesTableSkeleton } from "@/app/components/documents/quotes-table"
import { AccountSubheader } from "./AccountSearch"

type BuyerListKind = "orders" | "subscriptions" | "library" | "quotes"

export function BuyerListContentSkeleton({ kind }: { kind: BuyerListKind }) {
  return (
    <div role="status" aria-label="Loading" aria-busy="true" data-buyer-list-skeleton={kind}>
      <div aria-hidden="true">
        {kind === "quotes" ? <QuotesTableSkeleton /> : kind === "orders" ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="overflow-hidden rounded-xl border border-border/70 bg-card">
                <div className="flex flex-col gap-2 border-b border-border/50 px-5 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
                <div className="p-5 flex flex-col md:flex-row gap-5">
                  <Skeleton className="h-20 w-20 rounded-md shrink-0" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-3/4 max-w-xs" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex flex-col gap-2 md:w-56">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className={kind === "library"
                ? "bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col"
                : "overflow-hidden rounded-xl border border-border/70 bg-card flex flex-col"}>
                <div className="aspect-video bg-muted relative">
                  <Skeleton className="h-full w-full rounded-none" />
                  {kind === "library" && <Skeleton className="absolute top-3 left-3 h-6 w-20" />}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <Skeleton className="h-3 w-24" />
                    {kind === "subscriptions" && <Skeleton className="h-3 w-16" />}
                  </div>
                  <Skeleton className={kind === "library" ? "h-7 w-3/4 mb-4" : "h-6 w-3/4 mb-1"} />
                  {kind === "subscriptions" && <Skeleton className="h-3 w-1/2 mb-4" />}
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                    {kind === "library" ? <>
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-9 w-24 rounded-full" />
                    </> : <>
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-3 w-8" />
                      </div>
                    </>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function BuyerListSkeleton({ kind, scope = "personal", navigation }: {
  kind: BuyerListKind
  scope?: "personal" | "site"
  navigation?: ReactNode
}) {
  return (
    <div className={kind === "orders" ? "flex-1 flex flex-col min-h-0 min-w-0" : "flex-1 flex flex-col min-h-full"}>
      <AccountSubheader scope={scope}>
        <div className="flex items-center gap-4 w-full overflow-x-auto no-scrollbar">
          {navigation && <div className="shrink-0">{navigation}</div>}
          <Skeleton aria-hidden="true" className={`${kind === "library" ? "w-[360px]" : "w-[240px]"} h-8 rounded-full shrink-0`} />
          {scope === "site" && <Skeleton aria-hidden="true" className="h-9 w-48 shrink-0 hidden md:block" />}
        </div>
      </AccountSubheader>
      <div className={`flex-1 overflow-auto ${scope === "site" ? "p-4 md:p-6 lg:p-8" : kind === "orders" ? "py-4 md:py-6 px-4 md:px-0" : "py-4 md:py-6"}`}>
        <BuyerListContentSkeleton kind={kind} />
      </div>
    </div>
  )
}