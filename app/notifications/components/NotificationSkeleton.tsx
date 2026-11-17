import { Card, CardContent } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"

export function NotificationSkeleton() {
  return (
    <Card className="w-full rounded-xl shadow-none" aria-hidden="true">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-32 sm:ml-auto" />
            </div>
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full max-w-prose" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2 border-t border-border/60 pt-3">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
} 