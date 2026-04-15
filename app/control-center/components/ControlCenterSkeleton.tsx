"use client"

import { Skeleton } from "@/app/components/ui/skeleton"
import { Card } from "@/app/components/ui/card"
import { cn } from "@/lib/utils"

interface ControlCenterSkeletonProps {
  isLayoutCollapsed?: boolean
  isSidebarCollapsed?: boolean
}

function TaskCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
          <Skeleton className="h-6 w-12 rounded-full ml-2 shrink-0" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-3 w-4" />
          </div>
        </div>
      </div>
    </Card>
  )
}

function MobileKanbanSkeleton() {
  return (
    <div className="flex-1 overflow-auto bg-muted/30 pt-[71px]">
      {/* Mobile status tabs */}
      <div className="flex gap-2 px-4 py-3 border-b overflow-x-auto">
        {['Pending', 'In Progress', 'Done', 'Failed'].map((label) => (
          <Skeleton key={label} className="h-7 w-20 rounded-full shrink-0" />
        ))}
      </div>

      {/* Mobile filter row */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      {/* Single column task list */}
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <TaskCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

function DesktopKanbanSkeleton({ isSidebarCollapsed }: { isSidebarCollapsed: boolean }) {
  return (
    <div className="flex-1 overflow-auto bg-muted/30 pt-[71px]">
      <div className="p-8 h-full">
        <div className="overflow-x-auto pb-4 -mx-8">
          <div className="flex gap-4 min-w-fit px-16 min-h-[calc(100vh-220px)] items-stretch">
            {['Pending', 'In Progress', 'Completed', 'Failed'].map((status, columnIndex) => (
              <div key={status} className="flex-shrink-0 w-80 flex flex-col">
                <div className="bg-background rounded-t-md p-3 border-b border-x border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-5 w-6 rounded-full" />
                  </div>
                </div>
                <div className="bg-muted/30 rounded-b-md p-2 border-b border-x space-y-2 flex-1 min-h-[150px]">
                  {Array.from({ length: Math.max(1, 3 - columnIndex) }).map((_, i) => (
                    <TaskCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ControlCenterSkeleton({ 
  isLayoutCollapsed = false, 
  isSidebarCollapsed = false 
}: ControlCenterSkeletonProps = {}) {
  return (
    <div className="flex h-full relative overflow-hidden">
      <div 
        className={cn(
          "hidden md:block fixed h-screen transition-[width,opacity,left] duration-300 ease-in-out z-[100]",
          isSidebarCollapsed ? "w-0 opacity-0" : "w-[319px] opacity-100"
        )}
        style={{ 
          left: isLayoutCollapsed ? '64px' : '256px',
          top: '64px'
        }}
      >
        <div className="h-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-r">
          {/* Sidebar content */}
          <div className={cn(
            "transition-all duration-300 ease-in-out py-2",
            isSidebarCollapsed ? "opacity-0" : "opacity-100"
          )}>
            {/* Category items */}
            <div className="p-1 space-y-0.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`cat-${i}`} className="flex items-center justify-between px-3 py-2 rounded-md">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-5 w-6 rounded-full" />
                </div>
              ))}
            </div>

            {/* Task types section */}
            <div className="p-1">
              <div className="px-3 pt-4 pb-2">
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="space-y-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={`type-${i}`} className="flex items-center justify-between px-3 py-2 rounded-md">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className={cn("h-3", i === 0 ? "w-16" : "w-20")} />
                    </div>
                    <Skeleton className="h-5 w-6 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div 
        className={cn(
          "flex flex-col h-full flex-1 min-w-0 transition-[padding] duration-300 ease-in-out",
          !isSidebarCollapsed && "md:pl-[319px]"
        )}
      >
        {/* Header - matches ControlCenterHeader */}
        <div className="border-b flex-none h-[71px] flex items-center fixed w-[-webkit-fill-available] z-[99] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {/* Sidebar toggle - desktop only */}
          <div className="hidden md:flex absolute top-0 left-0 h-[71px] items-center pl-4">
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>

          {/* Header content */}
          <div className="w-full flex items-center justify-between ml-14 md:ml-[72px] px-4 lg:px-8">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-[200px] rounded-full" />
              <Skeleton className="h-9 w-[200px] rounded-full" />
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-9 w-[100px] rounded-full" />
            </div>
            <div className="flex items-center gap-4">
              {/* View selector */}
              <Skeleton className="h-9 w-[116px] rounded-md" />
            </div>
          </div>
        </div>

        {/* Mobile content */}
        <div className="md:hidden flex flex-col h-full">
          <MobileKanbanSkeleton />
        </div>

        {/* Desktop content */}
        <div className="hidden md:flex flex-col h-full">
          <DesktopKanbanSkeleton isSidebarCollapsed={isSidebarCollapsed} />
        </div>
      </div>
    </div>
  )
} 