import React from "react"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Card, CardContent } from "@/app/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"

export function LeadDetailSkeleton() {
  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="journey">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="journey">Customer Journey</TabsTrigger>
                  <TabsTrigger value="summary">Journey Summary</TabsTrigger>
                </TabsList>
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="px-16" style={{ paddingTop: "32px" }}>
          <div className="flex flex-row space-x-6">
            {/* Tab Content - Left Side (60%) */}
            <div className="w-[60%]">
              {/* Journey Timeline Skeleton - Match real structure */}
              <div className="space-y-6">
                {/* Stage Groups */}
                {Array.from({ length: 3 }).map((_, stageIndex) => (
                  <div key={stageIndex} className="mb-8 last:mb-0">
                    {/* Stage Header Card */}
                    <Card className="mb-4 border border-border hover:border-foreground/20 transition-colors overflow-hidden">
                      <CardContent className="p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="bg-primary/10 rounded-md w-10 h-10 flex items-center justify-center mr-3">
                              <Skeleton className="h-5 w-5" />
                            </div>
                            <div>
                              <Skeleton className="h-5 w-24 mb-1" />
                              <Skeleton className="h-3 w-40" />
                            </div>
                          </div>
                          <div className="flex items-center">
                            <Skeleton className="h-8 w-8 rounded mr-2" />
                            <Skeleton className="h-4 w-4" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Tasks for this stage */}
                    <div className="space-y-4 ml-8 relative">
                      {/* Timeline vertical connecting line */}
                      <div className="absolute left-[0px] top-0 bottom-0 w-[2px] bg-border/40"></div>
                      
                      {Array.from({ length: 2 }).map((_, taskIndex) => (
                        <div key={taskIndex} className="relative pl-8">
                          {/* Status indicator skeleton */}
                          <div className="absolute left-[-10px] top-3 bg-background rounded-full p-[2px]">
                            <Skeleton className="h-5 w-5 rounded-full" />
                          </div>
                          
                          {/* Task content skeleton */}
                          <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-2 flex-1">
                                {/* Task title */}
                                <Skeleton className="h-4 w-32" />
                                {/* Amount placeholder */}
                                <Skeleton className="h-5 w-16 rounded" />
                                {/* Date with clock icon */}
                                <div className="flex items-center gap-1 ml-2">
                                  <Skeleton className="h-2.5 w-2.5 rounded" />
                                  <Skeleton className="h-3 w-20" />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Serial ID */}
                                <Skeleton className="h-3 w-8" />
                                {/* Status badge */}
                                <Skeleton className="h-6 w-16 rounded-full" />
                                {/* Closed badge placeholder */}
                                <Skeleton className="h-6 w-14 rounded-full" />
                                {/* Menu button */}
                                <Skeleton className="h-6 w-6 rounded" />
                              </div>
                            </div>
                            {/* Description */}
                            <Skeleton className="h-3 w-full mb-2" />
                            {/* Comments section placeholder */}
                            <div className="mt-3">
                              <Skeleton className="h-3 w-16" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Lead Details - Right Side (40%) */}
            <div className="w-[40%]">
              <Card>
                <CardContent className="p-6">
                  {/* Lead Header */}
                  <div className="pb-6">
                    <div className="flex items-center justify-between mt-4">
                      <Skeleton className="h-8 w-48" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </div>
                  
                  {/* Lead Information */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-5">
                      {/* Contact Information */}
                      <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                        <Skeleton className="h-4 w-36 mb-4" />
                        
                        <div className="grid gap-4">
                          {/* Email */}
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-md" />
                            <div className="flex-1">
                              <Skeleton className="h-3 w-12 mb-2" />
                              <div className="flex items-center justify-between">
                                <Skeleton className="h-5 w-36" />
                                <Skeleton className="h-8 w-8 rounded-md" />
                              </div>
                            </div>
                          </div>
                          
                          {/* Phone */}
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-md" />
                            <div className="flex-1">
                              <Skeleton className="h-3 w-12 mb-2" />
                              <div className="flex items-center justify-between">
                                <Skeleton className="h-5 w-32" />
                                <div className="flex space-x-1">
                                  <Skeleton className="h-8 w-8 rounded-md" />
                                  <Skeleton className="h-8 w-8 rounded-md" />
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Company */}
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-md" />
                            <div className="flex-1">
                              <Skeleton className="h-3 w-12 mb-2" />
                              <Skeleton className="h-5 w-40" />
                            </div>
                          </div>
                          
                          {/* Campaign */}
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-md" />
                            <div className="flex-1">
                              <Skeleton className="h-3 w-12 mb-2" />
                              <Skeleton className="h-5 w-36" />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Lead Status */}
                      <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                        <Skeleton className="h-4 w-24 mb-4" />
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-md" />
                            <div className="flex-1">
                              <Skeleton className="h-3 w-12 mb-2" />
                              <Skeleton className="h-5 w-24" />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-md" />
                            <div className="flex-1">
                              <Skeleton className="h-3 w-12 mb-2" />
                              <Skeleton className="h-5 w-36" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  )
} 