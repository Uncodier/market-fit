import { Skeleton } from "@/app/components/ui/skeleton"

export function MessagesSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Instance Plan Skeleton */}
      <div className="flex-none border-b border-border p-4">
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </div>
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-3 w-8" />
          </div>
          
          {/* Progress bar */}
          <Skeleton className="h-1.5 w-full rounded-full" />
          
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          
          {/* Instructions */}
          <div className="p-2 bg-background/50 rounded">
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      </div>

      {/* Messages list skeleton */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* System message */}
        <div className="flex flex-col w-full items-start group">
          <div className="flex items-center mb-1 gap-2">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-12 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="mr-8">
            <div className="space-y-2">
              <Skeleton className="h-4 w-80" />
              <Skeleton className="h-4 w-64" />
              <div className="bg-muted p-2 rounded space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        </div>

        {/* User message */}
        <div className="flex flex-col w-full items-end group">
          <div className="flex items-center mb-1 gap-2 flex-row-reverse">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="bg-muted rounded-lg p-4 ml-8">
            <Skeleton className="h-4 w-56" />
          </div>
        </div>

        {/* Agent message with details */}
        <div className="flex flex-col w-full items-start group">
          <div className="flex items-center mb-1 gap-2">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-10 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="mr-8">
            <div className="space-y-2">
              <Skeleton className="h-4 w-96" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-4 w-80" />
              <div className="bg-muted p-2 rounded space-y-1">
                <Skeleton className="h-3 w-20" />
                <div className="space-y-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tool result message */}
        <div className="flex flex-col w-full items-start group">
          <div className="flex items-center mb-1 gap-2">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-12 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="mr-8">
            <div className="space-y-2">
              <Skeleton className="h-4 w-64" />
              <div className="bg-muted p-2 rounded space-y-1">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message input skeleton */}
      <div className="flex-none p-4">
        <div className="relative">
          <Skeleton className="h-[135px] w-full rounded-2xl" />
          <Skeleton className="absolute bottom-[15px] right-[15px] h-[39px] w-[39px] rounded-xl" />
        </div>
      </div>
    </div>
  )
}