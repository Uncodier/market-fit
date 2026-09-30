"use client"


import { Skeleton } from "@/app/components/ui/skeleton"

// Loading state skeleton component
export const RequirementSkeleton = () => {
  return (
    <div className="flex h-[calc(100dvh-var(--topbar-height,64px))]">
      {/* Main Content Area Skeleton */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-none border-b pl-[20px] pr-4 py-2 h-[71px]">
          <div className="flex gap-2 h-full items-center">
            <Skeleton className="h-9 w-24 rounded" />
            <Skeleton className="h-9 w-24 rounded" />
            <div className="w-px h-6 bg-muted mx-1"></div>
            <div className="flex space-x-1">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="p-4 space-y-6 max-w-4xl mx-auto">
            <div className="space-y-4">
              <div className="flex">
                <Skeleton className="h-7 w-60 mb-4" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-5/6" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-4/5" />
              </div>
              <div className="space-y-1 mt-6">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel Skeleton */}
      <div className="w-80 border-l bg-muted/30 flex flex-col h-full">
        {/* Tabs Header */}
        <div className="flex-none h-[71px] border-b flex items-center justify-center px-4">
          <div className="grid grid-cols-2 w-full gap-2 h-10">
            <Skeleton className="h-full rounded" />
            <Skeleton className="h-full rounded" />
          </div>
        </div>
        
        {/* Tabs Content */}
        <div className="flex-1 p-5 overflow-auto">
          {/* Outsource Tab Content */}
          <div className="bg-muted/40 rounded-lg p-4 border border-border/30 mb-5">
            <Skeleton className="h-4 w-40 mb-3" />
            
            <div className="space-y-3">
              {/* Budget Section */}
              <div className="bg-primary/10 p-3 rounded-md border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-6 w-1/2 mx-auto" />
              </div>
              
              {/* Instructions Section */}
              <div className="space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-[150px] w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
              
              {/* Other Sections */}
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Fixed footer */}
        <div className="border-t p-4 bg-background">
          <Skeleton className="h-10 w-full rounded" />
        </div>
      </div>
    </div>
  )
}

