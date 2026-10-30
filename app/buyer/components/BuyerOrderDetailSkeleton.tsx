import { Card, CardContent, CardHeader } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"

export function BuyerOrderDetailSkeleton() {
  return (
      <div className="flex-1 flex flex-col min-h-full" role="status" aria-label="Loading" aria-busy="true">
        <div className="w-full px-4 md:px-8 mt-8 md:mt-12 mb-4">
          <Skeleton className="h-10 md:h-12 lg:h-14 w-3/4 max-w-sm mb-4" />
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>

        <div className="p-4 md:px-8 flex-1 w-full space-y-6 pb-16">
          <Card className="overflow-hidden border border-border bg-card">
            <div className="hidden md:flex items-center gap-4 border-b border-border bg-muted/30 px-6 py-3">
              <div className="flex-1"><Skeleton className="h-4 w-16" /></div>
              {[1, 2, 3].map(i => <div key={i} className="w-[120px] flex justify-end">
                <Skeleton className="h-4 w-12" />
              </div>)}
            </div>
            <CardContent className="p-0">
              <div className="divide-y">
                {[1, 2].map((i) => (
                   <div key={i} className="p-4 md:px-6 flex flex-col md:flex-row gap-4">
                    <Skeleton className="h-16 w-16 rounded-md flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="hidden md:flex items-center shrink-0">
                      {[1, 2, 3].map(j => <div key={j} className="w-[120px] flex justify-end">
                        <Skeleton className="h-5 w-20" />
                      </div>)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-muted/30 border-t space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <div className="flex justify-between pt-2 border-t mt-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Skeleton className="w-5 h-5 rounded-full" />
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Skeleton className="w-5 h-5 rounded-full" />
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-6 w-24 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <div className="flex justify-between pt-2 border-t mt-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
  )
}
