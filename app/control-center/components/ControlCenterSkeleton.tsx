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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 h-full">
          {['Pending', 'In Progress', 'Completed', 'Failed'].map((status, columnIndex) => (
            <div key={status} className="flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-6 rounded-full" />
              </div>
              <div className="space-y-3 flex-1">
                {Array.from({ length: Math.max(1, 3 - columnIndex) }).map((_, i) => (
                  <TaskCardSkeleton key={i} />
                ))}
              </div>
            </div>
          ))}
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
      {/* Sidebar Skeleton - desktop only, matches hidden md:block on actual page */}
      <div 
        className={cn(
          "hidden md:block fixed h-screen transition-all duration-200 ease-in-out z-10",
          isSidebarCollapsed ? "w-0 opacity-0" : "w-[319px] opacity-100"
        )}
        style={{ 
          left: isLayoutCollapsed ? '64px' : '256px',
          top: '64px'
        }}
      >
        <div className="h-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-r">
          {/* Sidebar search header */}
          <div className="flex items-center justify-center h-[71px] border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80 w-[319px]">
            <div className="relative w-[80%]">
              <Skeleton className="h-12 w-full rounded-md" />
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Skeleton className="h-4 w-4 rounded" />
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Skeleton className="h-5 w-8 rounded" />
              </div>
            </div>
          </div>

          {/* Sidebar content */}
          <div className="pt-[71px]">
            {/* Status filter tabs */}
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-center min-h-[56px]">
              <div className="flex items-center gap-3">
                <div className="flex h-8 p-0.5 bg-muted/30 rounded-full">
                  <Skeleton className="h-7 w-8 rounded-sm" />
                  <Skeleton className="h-7 w-10 rounded-sm" />
                  <Skeleton className="h-7 w-14 rounded-sm" />
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>

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

      {/* Main content */}
      <div 
        className={cn(
          "flex flex-col h-full w-full transition-[padding] duration-200 ease-in-out",
          !isSidebarCollapsed && "md:ml-[319px]"
        )}
      >
        {/* Header - matches ControlCenterHeader */}
        <div className="border-b flex-none h-[71px] flex items-center fixed w-[-webkit-fill-available] z-[999] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {/* Sidebar toggle - desktop only */}
          <div className="hidden md:flex absolute top-0 left-0 h-[71px] items-center pl-4">
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>

          {/* Header content */}
          <div className="w-full flex items-center justify-between ml-4 md:ml-[120px] mr-4 md:mr-16">
            {/* Mobile: title placeholder */}
            <Skeleton className="h-5 w-32 md:hidden" />
            <div className="hidden md:block" />

            {/* View selector */}
            <div className="flex gap-0">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-8 rounded-md" />
              ))}
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