"use client"

import { Skeleton } from "@/app/components/ui/skeleton"
import { Card } from "@/app/components/ui/card"
import { cn } from "@/lib/utils"

interface ControlCenterSkeletonProps {
  isLayoutCollapsed?: boolean
  isSidebarCollapsed?: boolean
}

export function ControlCenterSkeleton({ 
  isLayoutCollapsed = false, 
  isSidebarCollapsed = false 
}: ControlCenterSkeletonProps = {}) {
  return (
    <div className="flex h-full relative overflow-hidden">
      {/* Sidebar Skeleton */}
      <div className={cn(
        "fixed h-[calc(100vh-64px)] transition-all duration-300 ease-in-out z-[9999]",
        isSidebarCollapsed ? "w-0 opacity-0" : "w-[319px]",
        !isSidebarCollapsed && (isLayoutCollapsed ? "left-[64px]" : "left-[256px]")
      )} style={{ top: "64px" }}>
        <div className="h-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-r">
          {/* Sidebar Header with Search */}
          <div className="flex items-center justify-center h-[71px] border-b px-4">
            <div className="w-full relative">
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
          
          {/* Sidebar Content */}
          <div className="h-[calc(100%-71px)] overflow-hidden" style={{ paddingTop: '71px' }}>
            <div className="h-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60" style={{ minHeight: 'calc(100vh - 71px - 56px)' }}>
              <div className="w-[319px]">
                {/* Status Filter Skeleton */}
                <div className="px-4 py-3 border-b border-border/30 flex items-center justify-center min-h-[56px]">
                  <div className="flex items-center justify-center w-full gap-3">
                    {/* Tabs skeleton */}
                    <div className="flex items-center justify-center">
                      <div className="flex h-8 p-0.5 bg-muted/30 rounded-md">
                        <Skeleton className="h-7 w-12 rounded-sm" />
                        <Skeleton className="h-7 w-12 rounded-sm ml-1" />
                        <Skeleton className="h-7 w-16 rounded-sm ml-1" />
                      </div>
                    </div>
                    {/* Filter button skeleton */}
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </div>

                <div className="p-4 space-y-6">
                  {/* Task Types */}
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-24" />
                    <div className="space-y-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full rounded-md" />
                      ))}
                    </div>
                  </div>
                  
                  {/* Categories */}
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-20" />
                    <div className="space-y-1">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full rounded-md" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={cn(
        "flex flex-col h-full flex-1 transition-all duration-300 ease-in-out",
        isSidebarCollapsed 
          ? "pl-0"
          : isLayoutCollapsed 
            ? "pl-[319px]" 
            : "pl-[319px]"
      )}>
        {/* Header */}
        <div className="relative">
          <div className="border-b flex-none h-[71px] flex items-center fixed right-0 z-[999] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80"
               style={{ 
                 left: isSidebarCollapsed 
                   ? (isLayoutCollapsed ? "64px" : "256px")
                   : (isLayoutCollapsed ? "383px" : "575px")
               }}>
            <div className="h-full px-4 flex items-center justify-between w-full">
              {/* Left side - Sidebar toggle and status buttons */}
              <div className="flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex gap-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-16 rounded-md" />
                  ))}
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
              
              {/* Right side - View selector */}
              <div className="flex gap-0">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded-md" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-muted/30 transition-colors duration-300 ease-in-out pt-[71px]">
          <div className="p-8 h-full">
            {/* Kanban Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-full">
              {/* Status Columns */}
              {['Pending', 'In Progress', 'Completed', 'Failed'].map((status, columnIndex) => (
                <div key={status} className="flex flex-col">
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-6 rounded-full" />
                    </div>
                  </div>
                  
                  {/* Task Cards */}
                  <div className="space-y-3 flex-1">
                    {Array.from({ length: Math.max(1, 3 - columnIndex) }).map((_, i) => (
                      <Card key={i} className="p-4 cursor-pointer hover:shadow-sm transition-shadow">
                        <div className="space-y-3">
                          {/* Task Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-full" />
                            </div>
                            <Skeleton className="h-6 w-12 rounded-full ml-2" />
                          </div>
                          
                          {/* Task Meta */}
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-6 w-6 rounded-full" />
                              <Skeleton className="h-3 w-16" />
                            </div>
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-4 w-4" />
                              <Skeleton className="h-3 w-8" />
                            </div>
                          </div>
                          
                          {/* Task Footer */}
                          <div className="flex items-center justify-between">
                            <Skeleton className="h-3 w-20" />
                            <div className="flex items-center gap-1">
                              <Skeleton className="h-4 w-4" />
                              <Skeleton className="h-3 w-4" />
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 