import { Card, CardContent } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"

export function RecordsCalendarSkeleton() {
  return (
    <Card className="h-full border-none shadow-none flex flex-col bg-transparent">
      {/* Header Skeleton */}
      <div className="flex-none p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-7 w-32" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
        <div className="flex bg-muted p-1 rounded-lg">
          <Skeleton className="h-8 w-16 rounded-md mx-0.5" />
          <Skeleton className="h-8 w-16 rounded-md mx-0.5" />
          <Skeleton className="h-8 w-16 rounded-md mx-0.5" />
          <Skeleton className="h-8 w-16 rounded-md mx-0.5" />
        </div>
      </div>

      {/* Calendar Grid Skeleton (Month view style) */}
      <CardContent className="flex-1 p-0 flex flex-col min-h-0 bg-background rounded-lg border overflow-hidden">
        <div className="flex-none grid grid-cols-7 border-b bg-muted/30">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={`header-${i}`} className="p-2 text-center border-r last:border-r-0">
              <Skeleton className="h-4 w-12 mx-auto" />
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 grid-rows-5">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={`day-${i}`} className="border-r border-b p-2 min-h-[100px] flex flex-col gap-1">
              <Skeleton className="h-4 w-6 mb-1" />
              {i % 5 === 0 && <Skeleton className="h-6 w-full rounded" />}
              {i % 8 === 0 && <Skeleton className="h-6 w-full rounded" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
