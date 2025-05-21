import React from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { SkeletonCard } from "@/app/components/ui/skeleton-card"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Skeleton } from "@/app/components/ui/skeleton"

export function TaskDetailSkeleton() {
  return (
    <div className="flex-1 p-0 bg-background text-foreground">
      <Tabs defaultValue="summary">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="summary">Campaign Summary</TabsTrigger>
                <TabsTrigger value="financials">Finances</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
              <Skeleton className="h-9 w-32 rounded-md" />
            </div>
          </div>
        </StickyHeader>
        
        <div className="px-16 py-8">
          <div className="grid grid-cols-5 gap-8">
            {/* Left side: Requirements, Leads, Clients - 60% */}
            <div className="col-span-3 space-y-8">
              {/* Requirements Card */}
              <SkeletonCard 
                className="mb-6"
                headerClassName="flex justify-between items-center mb-4"
                contentClassName="space-y-4"
                titleSize="lg"
                showContent={true}
                contentLines={2}
              />
              
              {/* Generated Leads Card */}
              <SkeletonCard 
                className="mb-6"
                headerClassName="flex justify-between items-center mb-4"
                titleSize="lg"
                showContent={true}
                contentHeight="h-32"
              />
              
              {/* Converted Clients Card */}
              <SkeletonCard 
                className="mb-6"
                titleSize="lg"
                showContent={true}
                contentHeight="h-32"
              />
            </div>
            
            {/* Right side: Campaign Overview - 40% */}
            <div className="col-span-2">
              <Card>
                <CardContent className="p-6">
                  {/* Title and Priority */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                  </div>

                  {/* Campaign Type */}
                  <div className="mt-2">
                    <Skeleton className="h-4 w-32" />
                  </div>

                  {/* Description */}
                  <div className="mt-6">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>

                  {/* Target Segments */}
                  <div className="mt-6">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-6 w-24 rounded-full" />
                      <Skeleton className="h-6 w-28 rounded-full" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  </div>

                  {/* Outsource Section */}
                  <div className="mt-8">
                    <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                      <Skeleton className="h-4 w-40 mb-4" />
                      <div className="space-y-4">
                        <div className="bg-primary/10 p-3 rounded-md border border-primary/20">
                          <Skeleton className="h-4 w-24 mb-2" />
                          <Skeleton className="h-6 w-32 mx-auto" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-[150px] w-full rounded-md" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-16 w-full rounded-md" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Skeleton className="h-9 w-full rounded-md" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
} 