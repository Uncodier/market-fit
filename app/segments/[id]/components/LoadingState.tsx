import React from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"

export function LoadingState() {
  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="analysis" className="h-full flex flex-col">
        <StickyHeader>
          <div className="px-8 md:px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="analysis">Analysis</TabsTrigger>
                  <TabsTrigger value="themes">Themes</TabsTrigger>
                  <TabsTrigger value="icp">ICP</TabsTrigger>
                </TabsList>
              </div>
              <div className="ml-auto">
                {/* Any other buttons would go here */}
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="flex-1 overflow-auto">
          <div className="p-6 md:p-8 space-y-6">
            <div className="px-0 md:px-8">
              {/* Performance Metrics Cards Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="border-none shadow-sm rounded-lg bg-card">
                    <div className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="h-4 w-24 bg-muted rounded animate-pulse"></div>
                          <div className="h-7 w-20 bg-muted rounded animate-pulse"></div>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-muted/50 animate-pulse"></div>
                      </div>
                      <div className="mt-2 flex items-center">
                        <div className="h-4 w-16 bg-muted rounded animate-pulse"></div>
                        <div className="h-3 w-24 bg-muted rounded animate-pulse ml-2"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Demographics and Behavior Cards Skeleton */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Demographics Card Skeleton */}
                <div className="border-none shadow-sm rounded-lg bg-card">
                  <div className="px-6 py-4 border-b border-border">
                    <div className="flex flex-col gap-2">
                      <div className="h-5 w-32 bg-muted rounded animate-pulse"></div>
                      <div className="h-4 w-64 bg-muted rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Age Range Skeleton */}
                        <div className="bg-muted/30 p-4 rounded-lg">
                          <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2"></div>
                          <div className="h-5 w-32 bg-muted rounded animate-pulse mb-4"></div>
                          
                          <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className="space-y-1">
                                <div className="flex justify-between">
                                  <div className="h-3 w-16 bg-muted rounded animate-pulse"></div>
                                  <div className="h-3 w-8 bg-muted rounded animate-pulse"></div>
                                </div>
                                <div className="h-2 w-full bg-muted rounded animate-pulse"></div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Gender Skeleton */}
                        <div className="bg-muted/30 p-4 rounded-lg">
                          <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2"></div>
                          <div className="h-5 w-32 bg-muted rounded animate-pulse mb-4"></div>
                          
                          <div className="space-y-3">
                            <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
                            <div className="flex justify-between">
                              {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex items-center">
                                  <div className="h-3 w-3 rounded-full bg-muted animate-pulse mr-1"></div>
                                  <div className="h-3 w-16 bg-muted rounded animate-pulse"></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Interests Skeleton */}
                      <div className="bg-muted/30 p-4 rounded-lg">
                        <div className="h-4 w-24 bg-muted rounded animate-pulse mb-3"></div>
                        <div className="flex flex-wrap gap-2">
                          {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-6 w-24 bg-muted rounded-full animate-pulse"></div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Behavior Card Skeleton */}
                <div className="border-none shadow-sm rounded-lg bg-card">
                  <div className="px-6 py-4 border-b border-border">
                    <div className="flex flex-col gap-2">
                      <div className="h-5 w-32 bg-muted rounded animate-pulse"></div>
                      <div className="h-4 w-64 bg-muted rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="space-y-6">
                      {/* Behavior Item 1 Skeleton */}
                      <div className="bg-muted/30 p-4 rounded-lg">
                        <div className="h-4 w-40 bg-muted rounded animate-pulse mb-3"></div>
                        <div className="space-y-2">
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-muted animate-pulse"></div>
                              <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Behavior Item 2 Skeleton */}
                      <div className="bg-muted/30 p-4 rounded-lg">
                        <div className="h-4 w-40 bg-muted rounded animate-pulse mb-3"></div>
                        <div className="flex flex-wrap gap-2">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-6 w-16 bg-muted rounded-full animate-pulse"></div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Keywords and Regional Data Skeleton */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Keywords Card Skeleton */}
                <div className="border-none shadow-sm rounded-lg bg-card">
                  <div className="px-6 py-4 border-b border-border">
                    <div className="flex justify-between items-center">
                      <div className="h-5 w-40 bg-muted rounded animate-pulse"></div>
                      <div className="h-8 w-32 bg-muted rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {/* Keywords List Skeleton */}
                      <div className="bg-muted/30 p-4 rounded-lg">
                        <div className="h-5 w-48 bg-muted rounded animate-pulse mb-3"></div>
                        <div className="flex flex-wrap gap-2">
                          {[...Array(12)].map((_, i) => (
                            <div key={i} className="h-6 w-24 bg-muted rounded-full animate-pulse"></div>
                          ))}
                        </div>
                      </div>
                      
                      {/* SAM Skeleton */}
                      <div className="bg-muted/30 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                          <div className="h-5 w-56 bg-muted rounded animate-pulse"></div>
                          <div className="h-5 w-16 bg-muted rounded animate-pulse"></div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="h-8 w-24 bg-muted rounded animate-pulse"></div>
                            <div className="h-4 w-32 bg-muted rounded animate-pulse mt-1"></div>
                          </div>
                          <div className="space-y-2">
                            <div className="h-4 w-20 bg-muted rounded animate-pulse"></div>
                            <div className="h-4 w-20 bg-muted rounded animate-pulse"></div>
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <div className="h-2.5 w-full bg-muted rounded animate-pulse"></div>
                          <div className="flex justify-between mt-2">
                            <div className="h-3 w-32 bg-muted rounded animate-pulse"></div>
                            <div className="h-3 w-8 bg-muted rounded animate-pulse"></div>
                          </div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="h-4 w-24 bg-muted rounded animate-pulse"></div>
                              <div className="h-3 w-40 bg-muted rounded animate-pulse mt-1"></div>
                            </div>
                            <div className="text-right">
                              <div className="h-4 w-16 bg-muted rounded animate-pulse"></div>
                              <div className="h-3 w-32 bg-muted rounded animate-pulse mt-1"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Regional Data Skeleton */}
                <div className="border-none shadow-sm rounded-lg bg-card">
                  <div className="px-6 py-4 border-b border-border">
                    <div className="flex flex-col gap-2">
                      <div className="h-5 w-48 bg-muted rounded animate-pulse"></div>
                      <div className="h-4 w-64 bg-muted rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="h-[450px] w-full bg-muted/30 rounded animate-pulse"></div>
                    <div className="mt-4 flex flex-wrap gap-3 justify-center">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="h-3 w-3 rounded-full bg-muted animate-pulse"></div>
                          <div className="h-3 w-24 bg-muted rounded animate-pulse"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  )
} 