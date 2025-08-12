import { Skeleton } from "@/app/components/ui/skeleton"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"

export function RobotsPageSkeleton() {
  return (
    <div className="flex-1 p-0">
      {/* Header Skeleton */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="px-16 pt-0">
          <div className="flex items-center gap-4 py-4">
            {/* Tab navigation skeleton */}
            <div className="flex items-center space-x-1 bg-muted/50 p-1 rounded-lg">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-md" />
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex h-[calc(100vh-136px)]">
        {/* Web View - 2/3 of available space */}
        <div className="w-2/3 h-full border-r border-border">
          <div className="h-full flex flex-col m-0 bg-card">
            <div className="flex-1 p-0 overflow-hidden relative">
              {/* Browser-like header */}
              <div className="border-b border-border p-3 bg-muted/50">
                <div className="flex items-center gap-2">
                  {/* Browser controls */}
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-3 w-3 rounded-full" />
                  </div>
                  {/* Address bar */}
                  <div className="flex-1 ml-4">
                    <Skeleton className="h-8 w-full rounded-md" />
                  </div>
                  {/* Browser actions */}
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-6 w-6 rounded" />
                  </div>
                </div>
              </div>

              {/* Main browser content area */}
              <div className="p-6 space-y-6 h-full bg-background">
                {/* Website header simulation */}
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full rounded-lg bg-muted/60" />
                  <div className="flex gap-4">
                    <Skeleton className="h-10 w-32 rounded-md" />
                    <Skeleton className="h-10 w-24 rounded-md" />
                    <Skeleton className="h-10 w-28 rounded-md" />
                    <div className="flex-1" />
                    <Skeleton className="h-10 w-20 rounded-md" />
                  </div>
                </div>

                {/* Content grid simulation */}
                <div className="grid grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="h-40 w-full rounded-lg bg-muted/40" />
                      <Skeleton className="h-4 w-full rounded" />
                      <Skeleton className="h-3 w-3/4 rounded" />
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-16 rounded" />
                        <Skeleton className="h-8 w-20 rounded" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Article/content simulation */}
                <div className="space-y-4 max-w-4xl">
                  <Skeleton className="h-8 w-2/3 rounded" />
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-5/6 rounded" />
                    <Skeleton className="h-4 w-4/5 rounded" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <Skeleton className="h-48 w-full rounded-lg bg-muted/40" />
                    <div className="space-y-3">
                      <Skeleton className="h-6 w-3/4 rounded" />
                      <Skeleton className="h-4 w-full rounded" />
                      <Skeleton className="h-4 w-full rounded" />
                      <Skeleton className="h-4 w-2/3 rounded" />
                      <div className="flex gap-2 mt-4">
                        <Skeleton className="h-10 w-24 rounded" />
                        <Skeleton className="h-10 w-20 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Loading status overlay */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    
                    <div className="flex-1">
                      <Skeleton className="h-4 w-48 rounded mb-1" />
                      <Skeleton className="h-3 w-64 rounded" />
                    </div>
                    
                    <div className="w-32">
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <Skeleton className="h-1.5 w-2/3 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shimmer overlay effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none opacity-30" />
            </div>
          </div>
        </div>

        {/* Messages View - 1/3 of available space */}
        <div className="w-1/3 h-full">
          <div className="h-full flex flex-col m-0 bg-card">
            {/* Chat header */}
            <div className="border-b border-border p-4 bg-muted/30">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 rounded mb-1" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
                <Skeleton className="h-6 w-6 rounded" />
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 p-4 space-y-4 overflow-hidden">
              {/* Robot messages */}
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-6 w-6 rounded-full flex-shrink-0 mt-1" />
                  <div className="flex-1 space-y-2">
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <Skeleton className="h-3 w-full rounded" />
                      <Skeleton className="h-3 w-4/5 rounded" />
                      <Skeleton className="h-3 w-3/4 rounded" />
                    </div>
                    <Skeleton className="h-3 w-16 rounded" />
                  </div>
                </div>
              ))}

              {/* User message */}
              <div className="flex gap-3 justify-end">
                <div className="flex-1 space-y-2 max-w-[80%]">
                  <div className="bg-primary/10 rounded-lg p-3 ml-auto space-y-2">
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-3 w-2/3 rounded" />
                  </div>
                  <Skeleton className="h-3 w-16 rounded ml-auto" />
                </div>
                <Skeleton className="h-6 w-6 rounded-full flex-shrink-0 mt-1" />
              </div>

              {/* More robot messages */}
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={`robot-${i}`} className="flex gap-3">
                  <Skeleton className="h-6 w-6 rounded-full flex-shrink-0 mt-1" />
                  <div className="flex-1 space-y-2">
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <Skeleton className="h-3 w-full rounded" />
                      <Skeleton className="h-3 w-5/6 rounded" />
                    </div>
                    <Skeleton className="h-3 w-16 rounded" />
                  </div>
                </div>
              ))}
            </div>

            {/* Chat input area */}
            <div className="border-t border-border p-4 bg-muted/20">
              <div className="relative">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="absolute bottom-2 right-2 h-8 w-8 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
