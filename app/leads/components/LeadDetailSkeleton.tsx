import React from "react"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"

export function LeadDetailSkeleton() {
  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="journey">
        <StickyHeader>
          <div className="pt-0 flex-1">
            <div className="flex items-center justify-between w-full gap-4">
              <TabsList>
                <TabsTrigger value="journey">Customer Journey</TabsTrigger>
                <TabsTrigger value="conversations">Conversations</TabsTrigger>
                <TabsTrigger value="deals">Deals</TabsTrigger>
                <TabsTrigger value="sales">Sales</TabsTrigger>
                <TabsTrigger value="digital-behavior">Digital Behavior</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2 shrink-0">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-16 rounded-full" />
                ))}
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="px-4 lg:px-8 py-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div>
                  <Skeleton className="h-6 w-44 mb-2" />
                  <Skeleton className="h-4 w-36 mb-1" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col lg:flex-row border-t border-border/50">
            <div className="w-full lg:flex-1 pt-5 lg:pr-8 space-y-1">
              {Array.from({ length: 5 }).map((_, stageIndex) => (
                <div key={stageIndex} className="flex items-center justify-between py-3 border-b border-border/40">
                  <div className="flex items-center">
                    <Skeleton className="h-8 w-8 rounded-md mr-3" />
                    <div>
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-4" />
                </div>
              ))}
            </div>
            <aside className="w-full lg:w-[340px] xl:w-[380px] shrink-0 pt-5 lg:pl-8 lg:border-l border-border/50">
              <Skeleton className="h-3 w-16 mb-3" />
              <Skeleton className="h-8 w-full rounded-full mb-4" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </aside>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
