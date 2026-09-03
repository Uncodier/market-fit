export const ContentSkeleton = () => {
  return (
    <div className="flex h-[calc(100vh-var(--topbar-height,64px))]">
      {/* Main Content Area Skeleton */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-none border-b p-2 h-[71px]">
          <div className="flex gap-1 h-full items-center">
            <div className="h-8 w-36 bg-muted animate-pulse rounded"></div>
            <div className="ml-auto h-8 w-32 bg-muted animate-pulse rounded"></div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-4">
            <div className="h-8 bg-muted animate-pulse rounded w-3/4"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-full"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-5/6"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-4/5"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-full"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
            <div className="h-8 bg-muted animate-pulse rounded w-1/2 mt-8"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-full"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-5/6"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-4/5"></div>
          </div>
        </div>
      </div>

      {/* AI Assistant Panel Skeleton */}
      <div className="w-80 border-l bg-muted/30 flex flex-col h-full">
        <div className="h-[71px] border-b flex items-center justify-center">
          <div className="w-60 h-8 bg-muted animate-pulse rounded"></div>
        </div>
        <div className="p-4 space-y-6">
          <div className="h-10 bg-muted animate-pulse rounded"></div>
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
            <div className="h-8 bg-muted animate-pulse rounded w-full"></div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded w-2/3"></div>
            <div className="h-20 bg-muted animate-pulse rounded w-full"></div>
          </div>
          <div className="space-y-2 mt-6">
            <div className="h-6 bg-muted animate-pulse rounded w-1/3"></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-9 bg-muted animate-pulse rounded"></div>
              <div className="h-9 bg-muted animate-pulse rounded"></div>
              <div className="h-9 bg-muted animate-pulse rounded"></div>
              <div className="h-9 bg-muted animate-pulse rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
