import React from 'react'
import { Skeleton } from '@/app/components/ui/skeleton'

export default function ChatLoading() {
  return (
    <div className="flex h-full relative overflow-visible w-full bg-background flex-row">
      {/* Sidebar skeleton */}
      <div className="h-full transition-all duration-300 ease-in-out z-[55] bg-background flex-shrink-0 border-r dark:border-white/5 border-black/5 absolute md:relative left-0 hidden md:block md:w-[319px] md:min-w-[319px]" style={{ overflow: 'hidden' }}>
        <div className="flex flex-col h-full w-full bg-transparent overflow-hidden">
          {/* Top bar with search input skeleton */}
          <div className="flex items-center justify-center h-[71px] max-h-[71px] min-h-[71px] border-b transition-colors duration-300 flex-shrink-0 bg-background w-full">
            <div className="relative w-full px-4 flex items-center justify-center min-w-0">
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
          
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-auto flex flex-col pt-0">
              <div className="w-full min-w-0 flex flex-col flex-1">
                {/* Channel filter skeleton */}
                <div className="px-4 py-3 border-b dark:border-white/5 border-black/5 flex justify-center flex-shrink-0 h-[56px] max-h-[56px] min-h-[56px] overflow-hidden sticky top-0 z-[20] bg-background">
                  <div className="h-8 w-full max-w-[240px] bg-muted/30 rounded-full flex items-center p-0.5 justify-between px-1">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <Skeleton key={i} className="h-7 w-7 rounded-full" />
                    ))}
                  </div>
                </div>
                
                {/* Conversations skeleton */}
                <div className="pb-[200px]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="w-full text-left py-3 px-4 rounded-none border-b dark:border-white/5 border-black/5" style={{ boxSizing: 'border-box' }}>
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Skeleton className="h-4 w-[60%]" />
                          <Skeleton className="h-4 w-16 rounded-full" />
                        </div>
                      </div>
                      <div className="mt-1">
                        <Skeleton className="h-3 w-[85%]" />
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-1">
                          <Skeleton className="h-3 w-3 rounded-full" />
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-1" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-3 w-10" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main chat content skeleton */}
      <div className="flex flex-col h-full transition-all duration-300 ease-in-out flex-1 min-w-0 min-h-0 relative bg-background">
        
        {/* Header skeleton (fixed) */}
        <div className="w-full z-[50]">
          <div className="border-b dark:border-white/5 border-black/5 flex-none h-[71px] flex items-center z-[50] bg-background/80 py-2 fixed top-[var(--topbar-height,64px)] right-0 w-full md:w-[calc(100%-256px-319px)] max-md:w-full pl-4 pr-4">
            
            {/* Toggle area skeleton */}
            <div className="hidden md:flex shrink-0 items-center gap-2 h-full">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>

            {/* Visitor/Lead info skeleton (Right aligned) */}
            <div className="flex-1 min-w-0 flex items-center justify-end gap-3 transition-opacity duration-300 ease-in-out">
              <div className="flex flex-col items-end gap-1 min-w-0 flex-1 py-1">
                <div className="flex items-center gap-2 justify-end w-full">
                  <Skeleton className="h-5 w-32 rounded-md" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
                <div className="flex items-center gap-2 justify-end w-full mt-1">
                  <Skeleton className="h-3 w-40 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-12 w-12 rounded-full border-2 border-primary/10 flex-shrink-0" />
            </div>
          </div>
        </div>
        
        {/* Chat messages area skeleton (scrollable) */}
        <div className="flex-1 overflow-y-auto min-w-0 w-full relative pt-[71px] pb-[180px]">
          <div className="w-full mx-auto space-y-6 px-4 md:px-8 lg:px-12 xl:px-24 py-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                {i % 2 === 0 ? (
                  <div className="flex flex-col max-w-[85%] md:max-w-[75%] min-w-0 px-4 md:px-0 w-full md:w-[60%]">
                    <div className="flex items-center mb-1 gap-2">
                      <Skeleton className="h-7 w-7 rounded-full" />
                      <Skeleton className="h-4 w-24 rounded" />
                    </div>
                    <div className="ml-9 rounded-lg p-4 bg-muted/50 dark:bg-muted/20 border">
                      <Skeleton className="h-4 w-[90%] rounded" />
                      <Skeleton className="h-4 w-[75%] mt-3 rounded" />
                      <Skeleton className="h-4 w-[85%] mt-3 rounded" />
                      <div className="flex justify-between items-center mt-3">
                        <Skeleton className="h-3 w-1/3 rounded" />
                        <Skeleton className="h-3 w-12 rounded" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col max-w-[85%] md:max-w-[75%] min-w-0 items-end px-4 md:px-0 w-full md:w-[60%]">
                    <div className="flex flex-col min-w-0 items-end group w-full">
                      <div className="flex items-center mb-1 gap-2 justify-end w-full">
                        <Skeleton className="h-4 w-24 rounded" />
                        <Skeleton className="h-7 w-7 rounded-full" />
                      </div>
                      <div className="mr-9 rounded-lg p-4 bg-primary/10 border border-primary/20 w-full">
                        <Skeleton className="h-4 w-[90%] rounded ml-auto" />
                        <Skeleton className="h-4 w-[80%] mt-3 rounded ml-auto" />
                        <div className="flex justify-between items-center mt-3">
                          <Skeleton className="h-3 w-1/4 rounded" />
                          <Skeleton className="h-3 w-16 rounded" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Input area skeleton (fixed bottom) */}
        <div className="fixed bottom-0 flex-none chat-input-container transition-all duration-300 ease-in-out bg-background/95 z-10 w-full md:w-[calc(100%-256px-319px)] right-0">
          <div className="w-full">
            <div className="w-full mx-auto relative pb-[20px] px-4 md:px-8 lg:px-12 xl:px-24 pt-0">
              <div className="relative w-full">
                <Skeleton className="h-[121.5px] w-full rounded-2xl" />
                <div className="absolute bottom-[15px] right-[15px] z-50">
                  <Skeleton className="h-[35.1px] w-[35.1px] rounded-[9999px]" />
                </div>
                <div className="absolute bottom-[15px] left-1/2 -translate-x-1/2 z-50">
                  <Skeleton className="h-[35.1px] w-[140px] rounded-[9999px]" />
                </div>
              </div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  )
} 