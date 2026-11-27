import React from 'react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { ConversationListSkeleton } from '@/app/components/chat/conversation-list-skeleton'

export default function ChatLoading() {
  return (
    <div role="status" aria-label="Loading conversations" aria-busy="true" className="flex h-full relative overflow-hidden w-full min-w-0 bg-background flex-row">
      <span className="sr-only">Loading conversations</span>
      {/* Sidebar skeleton */}
      <div aria-hidden="true" className="h-full transition-all duration-300 ease-in-out z-[55] bg-background flex-shrink-0 border-r dark:border-white/5 border-black/5 absolute md:relative left-0 hidden md:block md:w-[319px] md:min-w-[319px]" style={{ overflow: 'hidden' }}>
        <ConversationListSkeleton label="Loading conversations" withControls />
      </div>
      
      {/* Main chat content skeleton */}
      <div aria-hidden="true" className="flex flex-col h-full transition-all duration-300 ease-in-out flex-1 min-w-0 min-h-0 relative bg-background">
        
        {/* Header skeleton (fixed) */}
        <div className="w-full z-[50]">
          <div className="border-b dark:border-white/5 border-black/5 flex-none h-[71px] flex items-center z-[50] bg-background/80 py-2 absolute top-0 right-0 w-full pl-4 pr-4">
            
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
        <div className="absolute bottom-0 flex-none chat-input-container transition-all duration-300 ease-in-out bg-background/95 z-10 w-full right-0">
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