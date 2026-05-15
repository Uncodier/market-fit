import React from 'react'
import { Skeleton } from '@/app/components/ui/skeleton'

export default function ChatLoading() {
  return (
    <div className="flex h-full relative overflow-visible w-full bg-background flex-row">
      {/* Sidebar skeleton */}
      <div className="h-full transition-all duration-300 ease-in-out z-20 bg-background flex-shrink-0 hidden md:block md:w-[319px] border-r" style={{ overflow: 'hidden' }}>
        <div className="p-4">
          <Skeleton className="h-10 w-full rounded-md mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-1/2 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Main chat content skeleton */}
      <div className="flex flex-col h-full transition-[padding] duration-300 ease-in-out flex-1 min-w-0 min-h-0 relative bg-background">
        
        {/* Header skeleton (fixed) */}
        <div className="w-full z-[50]">
          <div className="border-b flex-none h-[71px] flex items-center z-[50] bg-background/80 py-2 fixed top-[64px] right-0 w-[calc(100%-319px)] max-md:w-full">
            <div className="px-6 py-3 flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-3 w-20 mt-1.5 rounded-md" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-9 w-9 rounded-md" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Chat messages area skeleton (scrollable) */}
        <div className="flex-1 overflow-y-auto min-w-0 w-full relative pt-[71px] pb-[180px]">
          <div className="max-w-3xl mx-auto space-y-8 px-4 md:px-6 py-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                {i % 2 === 0 ? (
                  <div className="flex items-start gap-3 max-w-[calc(100%-100px)]">
                    <Skeleton className="h-8 w-8 rounded-full mt-1" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-24 rounded-md" />
                      <div className="rounded-lg p-4 bg-muted/50 border">
                        <Skeleton className="h-4 w-[250px] rounded-md" />
                        <Skeleton className="h-4 w-[200px] mt-2 rounded-md" />
                        <Skeleton className="h-4 w-[150px] mt-2 rounded-md" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-end gap-3 max-w-[calc(100%-100px)]">
                    <div className="space-y-2 items-end flex flex-col">
                      <Skeleton className="h-3 w-24 rounded-md" />
                      <div className="rounded-lg p-4 bg-primary/10 border border-primary/20">
                        <Skeleton className="h-4 w-[220px] rounded-md" />
                        <Skeleton className="h-4 w-[180px] mt-2 rounded-md" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full mt-1" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Input area skeleton (fixed bottom) */}
        <div className="fixed bottom-0 flex-none chat-input-container transition-all duration-300 ease-in-out bg-background/95 z-10 w-[calc(100%-319px)] max-md:w-full right-0">
          <div className="w-full">
            <div className="max-w-3xl mx-auto relative pb-[20px] px-4 md:px-6 pt-4">
              <Skeleton className="h-[121.5px] w-full rounded-2xl" />
              <div className="absolute bottom-[35px] right-[15px] flex gap-2">
                <Skeleton className="h-[35.1px] w-[35.1px] rounded-[9999px]" />
              </div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  )
} 