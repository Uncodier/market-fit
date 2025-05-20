"use client"

import { Skeleton } from "@/app/components/ui/skeleton"
import { Card } from "@/app/components/ui/card"

export function ControlCenterSkeleton() {
  return (
    <div className="flex h-full relative overflow-hidden">
      {/* Sidebar Skeleton */}
      <div className="fixed h-[calc(100vh-64px)] w-[319px] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-[9999] border-r" style={{ top: "64px" }}>
        {/* Header */}
        <div className="flex items-center justify-center h-[71px] border-b">
          <div className="w-[240px] relative">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
        {/* Categories */}
        <div className="h-[calc(100vh-64px)] overflow-hidden pt-[71px]">
          <div className="p-1 space-y-0.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col h-full flex-1 pl-[319px]">
        {/* Header */}
        <div className="border-b flex-none h-[71px] flex items-center fixed w-[-webkit-fill-available] z-[999] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="absolute top-0 left-0 h-[71px] px-4 flex items-center">
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="max-w-[calc(100%-240px)] mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex gap-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-16 rounded-md" />
                ))}
              </div>
              <Skeleton className="h-10 w-10 rounded-md" />
            </div>
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-muted/30 transition-colors duration-300 ease-in-out pt-[71px]">
          <div className="p-8">
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3 items-start">
                      <Skeleton className="h-[39px] w-[39px] rounded-full" />
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-32" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-3 rounded-full" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 