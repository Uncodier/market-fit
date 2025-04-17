import React from 'react'
import { Skeleton } from '@/app/components/ui/skeleton'

export default function ChatLoading() {
  return (
    <div className="flex h-full relative overflow-hidden">
      {/* Sidebar skeleton */}
      <div className="h-full w-[319px] border-r bg-background">
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
      <div className="flex flex-col h-full flex-1 bg-muted/30">
        {/* Header skeleton */}
        <div className="relative border-b bg-background">
          <div className="px-6 py-3 flex items-center justify-between">
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
        
        {/* Chat messages area skeleton */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-[calc(100%-240px)] mx-auto space-y-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                {i % 2 === 0 ? (
                  <div className="flex items-start gap-3 max-w-[calc(100%-100px)]">
                    <Skeleton className="h-8 w-8 rounded-full mt-1" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-24 rounded-md" />
                      <div className="rounded-lg p-4 bg-background">
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
                      <div className="rounded-lg p-4 bg-muted">
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
        
        {/* Input area skeleton */}
        <div className="p-4 border-t bg-background">
          <div className="relative max-w-[calc(100%-240px)] mx-auto">
            <Skeleton className="h-[56px] w-full rounded-lg" />
            <div className="absolute right-3 top-3 flex gap-2">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 