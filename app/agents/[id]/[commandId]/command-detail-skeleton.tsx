"use client"

import React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Card, CardContent } from "@/app/components/ui/card"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { ChevronLeft } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { PageTransition } from "@/app/components/ui/page-transition"

export function CommandDetailSkeleton() {
  return (
    <PageTransition>
      <div className="flex min-h-screen flex-col">
        <StickyHeader showAIButton={false}>
          <div className="container py-2 max-w-screen-2xl">
            <div className="flex items-center">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 mr-4"
                disabled
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <div className="flex-1 min-w-0">
                <Skeleton className="h-6 w-52" />
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="container flex-1 items-start py-6 max-w-screen-2xl">
          <div className="flex flex-col space-y-6 lg:flex-row lg:space-x-6 lg:space-y-0">
            {/* Left Column: Command Details */}
            <div className="space-y-6 lg:flex-1">
              <Tabs defaultValue="details">
                <TabsList className="mb-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="context">Context</TabsTrigger>
                  <TabsTrigger value="targets">Targets</TabsTrigger>
                  <TabsTrigger value="toolCalls">Tool Calls</TabsTrigger>
                  <TabsTrigger value="results">Results</TabsTrigger>
                </TabsList>

                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {/* Loading skeletons for command details */}
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-muted/40 rounded-lg p-4 border border-border/30">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-md" />
                            <div className="flex-1">
                              <Skeleton className="h-4 w-24 mb-2" />
                              <Skeleton className="h-5 w-48" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Tabs>
            </div>

            {/* Right Column: Overview Card */}
            <div className="lg:w-1/3">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {/* Command Information skeleton */}
                    <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                      <Skeleton className="h-4 w-36 mb-3" />
                      
                      <div className="grid gap-4">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-md" />
                            <div className="flex-1">
                              <Skeleton className="h-3 w-16 mb-1" />
                              <Skeleton className="h-4 w-full" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Status skeleton */}
                    <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-md" />
                        <div className="flex-1">
                          <Skeleton className="h-3 w-24 mb-1" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Timestamps & Metrics skeleton */}
                    <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                      <Skeleton className="h-4 w-36 mb-3" />
                      
                      <div className="grid gap-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-md" />
                            <div>
                              <Skeleton className="h-3 w-16 mb-1" />
                              <Skeleton className="h-4 w-32" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
} 