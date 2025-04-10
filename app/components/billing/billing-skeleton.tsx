"use client"

import { Skeleton } from "@/app/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"

export function BillingInfoSkeleton() {
  return (
    <div className="space-y-8">
      <Card className="border border-border shadow-sm">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">
            <Skeleton className="h-6 w-40" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Skeleton className="h-10 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Card className="border border-border shadow-sm">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">
            <Skeleton className="h-6 w-40" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
          
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export function PaymentHistorySkeleton() {
  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold">
          <Skeleton className="h-6 w-40" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 px-8 pb-8">
        <Skeleton className="h-4 w-full max-w-md mb-8" />
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
          
          {[...Array(3)].map((_, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function BillingPageSkeleton() {
  return (
    <div className="flex-1">
      <div className="border-b border-border backdrop-blur-sm bg-background/60 sticky top-16 z-10">
        <div className="flex items-center justify-between px-16 w-full py-4">
          <Tabs value="loading" className="w-auto">
            <TabsList>
              <TabsTrigger value="billing_info">Billing Info</TabsTrigger>
              <TabsTrigger value="payment_history">Payment History</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <BillingInfoSkeleton />
      </div>
    </div>
  )
} 