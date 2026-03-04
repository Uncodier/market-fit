import { Skeleton } from "@/app/components/ui/skeleton"
import { useLayout } from "@/app/context/LayoutContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"

export function MessagesSkeleton() {
  const layoutContext = useLayout()
  const isMobile = useIsMobile()
  const isLayoutCollapsed = layoutContext?.isLayoutCollapsed ?? false

  return (
    <div className="flex flex-col h-full w-full relative min-h-0">
      {/* Messages list skeleton */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 w-full min-w-0 pb-[220px] min-h-0">
        <div className="w-full max-w-4xl mx-auto px-4 min-w-0">
        <div className="space-y-6">
        {/* System message */}
        <div className="flex flex-col w-full items-start group">
          <div className="flex items-center mb-1 gap-2">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-12 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="w-full">
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
        <div className="flex flex-col w-full min-w-0 items-end group">
          <div className="flex items-center mb-1 gap-2 justify-end">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-7 rounded-full" />
          </div>
          <div className="w-full min-w-0 overflow-hidden flex justify-end pr-8">
            <Skeleton className="h-12 w-56 rounded-lg mr-12" />
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
          <div className="w-full">
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
          <div className="w-full">
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
      </div>

      {/* Message input skeleton */}
      <div 
        className="fixed right-0 bottom-0 z-20 pointer-events-none flex flex-col items-center justify-end pb-[15px] transition-all duration-500 ease-in-out chat-input-container !bg-transparent !p-0"
        style={{ 
          left: isMobile ? 0 : isLayoutCollapsed ? 64 : 256,
        }}
      >
        <div className="w-full max-w-[800px] px-4 pointer-events-auto relative z-10 !bg-transparent !p-0">
          <div className="relative">
            <Skeleton className="h-[135px] w-full rounded-2xl" />
            <Skeleton className="absolute bottom-[15px] right-[15px] h-[35.1px] w-[35.1px] rounded-[9999px]" />
            <Skeleton className="absolute bottom-[15px] left-[15px] h-8 w-24 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}