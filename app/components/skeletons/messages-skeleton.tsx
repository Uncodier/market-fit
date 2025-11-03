import { Skeleton } from "@/app/components/ui/skeleton"

export function MessagesSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Messages list skeleton */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6 pb-[175px]">
        <div className="max-w-[calc(100%-240px)] mx-auto min-w-0">
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
      </div>

      {/* Message input skeleton */}
      <div className="absolute bottom-4 left-0 right-0 flex-none">
        <div className="max-w-[calc(100%-240px)] mx-auto px-[30px]">
          <div className="relative">
            <Skeleton className="h-[135px] w-full rounded-2xl" />
            <Skeleton className="absolute bottom-[15px] right-[15px] h-[39px] w-[39px] rounded-xl" />
            <Skeleton className="absolute bottom-[15px] left-[15px] h-[39px] w-[39px] rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}