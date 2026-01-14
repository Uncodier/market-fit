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
      {/* Sidebar Skeleton - matches actual TaskSidebar positioning */}
      <div 
        className={cn(
          "fixed h-screen transition-all duration-200 ease-in-out z-10",
          isSidebarCollapsed ? "w-0 opacity-0" : "w-[319px] opacity-100"
        )}
        style={{ 
          left: isLayoutCollapsed ? '64px' : '256px',
          top: '64px'
        }}
      >
        <div className="h-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-r">
          {/* Sidebar Header with Search - matches CategoriesHeader */}
          <div className="flex items-center justify-center h-[71px] border-b fixed z-[999] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80 w-[319px]">
            <div className="relative w-[80%]">
              <Skeleton className="h-12 w-full rounded-md" />
              {/* Search icon placeholder */}
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <Skeleton className="h-4 w-4 rounded" />
              </div>
              {/* ⌘K shortcut placeholder */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Skeleton className="h-5 w-8 rounded" />
              </div>
            </div>
          </div>
          
          {/* Sidebar Content */}
          <div className="h-[calc(100%-71px)] overflow-hidden" style={{ paddingTop: '71px' }}>
            <div className="h-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60" style={{ minHeight: 'calc(100vh - 71px - 56px)' }}>
              <div className="w-[319px]">
                {/* Status Filter Skeleton - matches TaskStatusFilter */}
                <div className="px-4 py-3 border-b border-border/30 flex items-center justify-center min-h-[56px]">
                  <div className="flex items-center justify-center w-full gap-3">
                    {/* Tabs skeleton - matches actual TabsList structure */}
                    <div className="flex items-center justify-center">
                      <div className="flex h-8 p-0.5 bg-muted/30 rounded-full">
                        <Skeleton className="h-7 w-8 rounded-sm" />
                        <Skeleton className="h-7 w-10 rounded-sm" />
                        <Skeleton className="h-7 w-14 rounded-sm" />
                      </div>
                    </div>
                    {/* Filter button skeleton - matches Button with icon */}
                    <div className="relative">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      {/* Active filter indicator placeholder */}
                      <div className="absolute -top-1 -right-1">
                        <Skeleton className="h-4 w-4 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Categories Section - matches actual structure */}
                <div style={{ padding: '3.6px' }}>
                  <div className="space-y-0.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={`category-${i}`} className="rounded-md" style={{ 
                        paddingTop: '7.2px', 
                        paddingBottom: '7.2px', 
                        paddingLeft: '10.8px', 
                        paddingRight: '10.8px'
                      }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center" style={{ gap: '7.2px' }}>
                            {/* Emoji icon placeholder */}
                            <Skeleton className="h-4 w-4 rounded" />
                            {/* Category name */}
                            <Skeleton className="h-3 w-16" />
                          </div>
                          {/* Badge with count */}
                          <Skeleton className="h-5 w-6 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Task Types Section - matches actual structure */}
                <div style={{ padding: '3.6px' }}>
                  {/* Section header */}
                  <div style={{ paddingLeft: '10.8px', paddingRight: '10.8px', paddingTop: '14.4px', paddingBottom: '7.2px' }}>
                    <Skeleton className="h-3 w-20" />
                  </div>
                  
                  <div className="space-y-0.5">
                    {/* All Tasks button */}
                    <div className="rounded-md" style={{ 
                      paddingTop: '7.2px', 
                      paddingBottom: '7.2px', 
                      paddingLeft: '10.8px', 
                      paddingRight: '10.8px'
                    }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center" style={{ gap: '7.2px' }}>
                          {/* Check icon placeholder */}
                          <Skeleton className="h-4 w-4 rounded" style={{ height: '14.4px', width: '14.4px' }} />
                          {/* "All Tasks" text */}
                          <Skeleton className="h-3 w-16" />
                        </div>
                        {/* Total count badge */}
                        <Skeleton className="h-5 w-6 rounded-full" />
                      </div>
                    </div>

                    {/* Individual task types */}
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={`type-${i}`} className="rounded-md" style={{ 
                        paddingTop: '7.2px', 
                        paddingBottom: '7.2px', 
                        paddingLeft: '10.8px', 
                        paddingRight: '10.8px'
                      }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center" style={{ gap: '7.2px' }}>
                            {/* Emoji placeholder */}
                            <Skeleton className="h-4 w-4 rounded" />
                            {/* Type name */}
                            <Skeleton className="h-3 w-20" />
                          </div>
                          {/* Count badge */}
                          <Skeleton className="h-5 w-6 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content - matches actual component responsive behavior */}
      <div 
        className="flex flex-col h-full w-full transition-all duration-200 ease-in-out"
        style={{ 
          marginLeft: isSidebarCollapsed ? '0px' : '319px'
        }}
      >
        {/* Header - matches ControlCenterHeader */}
        <div className="relative">
          <div className="border-b flex-none h-[71px] flex items-center fixed w-[-webkit-fill-available] z-[999] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            {/* SidebarToggle positioned absolutely - matches actual component */}
            <div className="absolute top-0 left-0 h-[71px] flex items-center pl-4">
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
            
            {/* Main header content - matches the ml-[120px] mr-16 spacing */}
            <div className="w-full flex items-center justify-between ml-[120px] mr-16">
              <div className="flex items-center gap-8">
                {/* Left side content placeholder */}
              </div>
              {/* Right side - View selector (rightContent) */}
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