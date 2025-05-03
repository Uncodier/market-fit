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
                <TabsTrigger value="financials">Financial Details</TabsTrigger>
              </TabsList>
              <Skeleton className="h-9 w-32 rounded-md" />
            </div>
          </div>
        </StickyHeader>
        
        <div className="px-16 py-8">
          <div className="grid grid-cols-1 md:grid-cols-10 gap-6">
            {/* Left side: Requirements, Leads, Clients - 60% */}
            <div className="md:col-span-6 order-2 md:order-1">
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
            <div className="md:col-span-4 order-1 md:order-2">
              {/* Campaign Overview Card */}
              <SkeletonCard 
                headerClassName="flex justify-between items-center mb-4"
                titleSize="lg"
                contentClassName="space-y-4"
                contentLines={5}
              />
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
} 