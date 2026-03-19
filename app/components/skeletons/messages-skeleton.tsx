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
        {/* System/Agent message */}
        <div className="flex justify-start">
          <div className="flex flex-col max-w-[calc(100%-240px)] min-w-0 px-4 md:px-0 w-full md:w-[60%]">
            <div className="flex items-center mb-1 gap-2">
              <div className="relative">
                <Skeleton className="h-7 w-7 rounded-full bg-primary/10" />
              </div>
              <Skeleton className="h-4 w-24 bg-primary/10" />
            </div>
            <div className="ml-9 rounded-lg p-4 bg-muted/50 dark:bg-muted/20">
              <Skeleton className="h-4 w-[90%] mb-3" />
              <Skeleton className="h-4 w-[75%] mb-3" />
              <Skeleton className="h-4 w-[85%] mb-3" />
              <div className="flex justify-between items-center mt-3">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </div>
        </div>

        {/* User message */}
        <div className="flex justify-end">
          <div className="flex flex-col max-w-[calc(100%-240px)] min-w-0 items-end px-4 md:px-0 w-full md:w-[60%]">
            <div className="flex items-center mb-1 gap-2 flex-row-reverse">
              <Skeleton className="h-7 w-7 rounded-full bg-amber-500/10" />
              <Skeleton className="h-4 w-20 bg-amber-500/10" />
            </div>
            <div className="rounded-lg p-4 mr-9 w-full bg-muted/30 dark:bg-muted/10">
              <Skeleton className="h-4 w-[95%] mb-3" />
              <Skeleton className="h-4 w-[80%] mb-3" />
              <div className="flex justify-between items-center mt-3">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </div>
        </div>

        {/* Agent message with details */}
        <div className="flex justify-start">
          <div className="flex flex-col max-w-[calc(100%-240px)] min-w-0 px-4 md:px-0 w-full md:w-[60%]">
            <div className="flex items-center mb-1 gap-2">
              <div className="relative">
                <Skeleton className="h-7 w-7 rounded-full bg-primary/10" />
              </div>
              <Skeleton className="h-4 w-28 bg-primary/10" />
            </div>
            <div className="ml-9 rounded-lg p-4 bg-muted/50 dark:bg-muted/20">
              <Skeleton className="h-4 w-[95%] mb-3" />
              <Skeleton className="h-4 w-[85%] mb-3" />
              <div className="bg-muted p-3 rounded-md mb-3 space-y-2">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/5" />
              </div>
              <div className="flex justify-between items-center mt-3">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </div>
        </div>

        {/* Tool result message */}
        <div className="flex justify-start">
          <div className="flex flex-col max-w-[calc(100%-240px)] min-w-0 px-4 md:px-0 w-full md:w-[60%]">
            <div className="flex items-center mb-1 gap-2">
              <div className="relative">
                <Skeleton className="h-7 w-7 rounded-full bg-primary/10" />
              </div>
              <Skeleton className="h-4 w-24 bg-primary/10" />
            </div>
            <div className="ml-9 rounded-lg p-4 bg-muted/50 dark:bg-muted/20">
              <Skeleton className="h-4 w-[80%] mb-3" />
              <div className="bg-muted p-2 rounded-md space-y-1">
                <Skeleton className="h-3 w-32 mb-2" />
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