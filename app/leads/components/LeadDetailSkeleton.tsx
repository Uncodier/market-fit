import React from "react"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Card, CardContent } from "@/app/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"

export function LeadDetailSkeleton() {
  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="journey">
        <StickyHeader>
          <div className="px-16 pt-0 flex-1">
            <div className="flex items-center justify-between w-full">
              <TabsList>
                <TabsTrigger value="journey">Customer Journey</TabsTrigger>
                <TabsTrigger value="conversations">Conversations</TabsTrigger>
                <TabsTrigger value="sales">Sales</TabsTrigger>
                <TabsTrigger value="digital-behavior">Digital Behavior</TabsTrigger>
              </TabsList>
              
              {/* Status Segment Bar Skeleton */}
              <div className="flex items-center">
                <div className="flex items-center space-x-1 bg-muted/50 rounded-lg p-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-16 rounded" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="px-16" style={{ paddingTop: "32px" }}>
          <div className="flex flex-row space-x-6">
            {/* Tab Content - Left Side (60%) */}
            <div className="w-[60%]">
              <TabsContent value="journey" className="mt-0 pt-0">
                {/* Journey Timeline Skeleton */}
                <div className="space-y-6">
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
                        <div className="absolute left-[0px] top-0 bottom-0 w-[2px] bg-border/40"></div>
                        {Array.from({ length: 2 }).map((_, taskIndex) => (
                          <div key={taskIndex} className="relative pl-8">
                            <div className="absolute left-[-10px] top-3 bg-background rounded-full p-[2px]">
                              <Skeleton className="h-5 w-5 rounded-full" />
                            </div>
                            <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                              <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2 flex-1">
                                  <Skeleton className="h-4 w-32" />
                                  <Skeleton className="h-5 w-16 rounded" />
                                  <div className="flex items-center gap-1 ml-2">
                                    <Skeleton className="h-2.5 w-2.5 rounded" />
                                    <Skeleton className="h-3 w-20" />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Skeleton className="h-3 w-8" />
                                  <Skeleton className="h-6 w-16 rounded-full" />
                                  <Skeleton className="h-6 w-14 rounded-full" />
                                  <Skeleton className="h-6 w-6 rounded" />
                                </div>
                              </div>
                              <Skeleton className="h-3 w-full mb-2" />
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
              </TabsContent>

              <TabsContent value="conversations" className="mt-0 pt-0">
                {/* Conversations Table Skeleton */}
                <Card className="p-6">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Channel</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Skeleton className="h-4 w-4" />
                                <Skeleton className="h-4 w-16" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-48" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-16 rounded" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="sales" className="mt-0 pt-0">
                {/* Sales Table Skeleton */}
                <Card className="p-6">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from({ length: 4 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <div className="space-y-1">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-24" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-16 rounded" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="digital-behavior" className="mt-0 pt-0">
                {/* Digital Behavior Skeleton */}
                <div className="space-y-6">
                  {/* Summary Card Skeleton */}
                  <Card className="p-6">
                    <div className="space-y-4">
                      <Skeleton className="h-6 w-48" />
                      
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Metric</TableHead>
                              <TableHead className="text-right">Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Array.from({ length: 7 }).map((_, i) => (
                              <TableRow key={i}>
                                <TableCell className="flex items-center space-x-2">
                                  <Skeleton className="h-4 w-4 rounded" />
                                  <Skeleton className="h-4 w-20" />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Skeleton className="h-4 w-12 ml-auto" />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </Card>

                  {/* Events Table Skeleton */}
                  <Card className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-8 w-44" />
                      </div>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Details</TableHead>
                              <TableHead>Date</TableHead>
                            </TableRow>
                          </TableHeader>
                                                       <TableBody>
                               {Array.from({ length: 5 }).map((_, i) => (
                                 <TableRow key={i}>
                                   <TableCell>
                                     <div className="flex items-center space-x-2">
                                       <Skeleton className="h-4 w-4 rounded" />
                                       <Skeleton className="h-5 w-16" />
                                     </div>
                                   </TableCell>
                                   <TableCell>
                                     <Skeleton className="h-4 w-64" />
                                   </TableCell>
                                   <TableCell>
                                     <Skeleton className="h-4 w-24" />
                                   </TableCell>
                                 </TableRow>
                               ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>
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