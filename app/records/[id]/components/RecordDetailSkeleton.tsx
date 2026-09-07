import { Skeleton } from "@/app/components/ui/skeleton"

export const RecordDetailSkeleton = () => {
  return (
    <div className="flex h-[calc(100vh-64px)] min-h-0 bg-background">
      {/* Left side: Main Content / Form */}
      <div className="flex-1 flex flex-col min-w-0 bg-muted/10 relative">
        {/* Formatting Toolbar Skeleton */}
        <div className="border-b pl-[20px] pr-4 py-2 flex items-center h-[71px] bg-background gap-2 overflow-x-auto">
          <Skeleton className="h-9 w-24 rounded-md" />
          <div className="w-px h-6 bg-border mx-1" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-8 max-w-4xl mx-auto h-full space-y-8">
            <div className="space-y-4">
              <Skeleton className="h-12 w-3/4 mb-4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
            
            <div className="space-y-6 mt-12">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Insights & Relations Skeleton */}
      <div className="w-[400px] flex-none flex flex-col bg-background">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="border-b px-4 h-[71px] flex items-center justify-center gap-2">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          <div className="flex-1 p-4 space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
