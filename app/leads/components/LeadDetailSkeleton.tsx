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
              <Card className="p-6">
                {/* Journey Timeline Skeleton */}
                <div className="space-y-8">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <div className="flex items-center gap-2 mt-2">
                          <Skeleton className="h-8 w-16 rounded-md" />
                          <Skeleton className="h-8 w-16 rounded-md" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
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