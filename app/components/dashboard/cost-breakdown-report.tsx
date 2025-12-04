"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { BarChart } from "@/app/components/ui/icons"
import { FinancialCostsReport } from "@/app/components/dashboard/financial-costs-report"

interface CostBreakdownReportProps {
  data: Array<{
    name: string;
    amount: number;
    prevAmount: number;
    percentChange: number;
  }>;
  isLoading: boolean;
  dataReady: boolean;
}

export function CostBreakdownReport({ data, isLoading, dataReady }: CostBreakdownReportProps) {
  const hasData = data && data.length > 0

  if (isLoading || !dataReady) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
          <CardDescription>Detailed analysis of costs by category.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full space-y-6">
            <div className="flex justify-between items-center mb-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="space-y-4">
              {Array(3).fill(0).map((_, i) => (
                <div key={`row-${i}`} className="grid grid-cols-7 gap-4 items-center py-3 border-b">
                  <div className="col-span-3">
                    <Skeleton className="h-5 w-32" />
                  </div>
                  <div className="col-span-1 text-right">
                    <Skeleton className="h-5 w-20 ml-auto" />
                  </div>
                  <div className="col-span-1 text-right">
                    <Skeleton className="h-5 w-20 ml-auto" />
                  </div>
                  <div className="col-span-1 text-center">
                    <Skeleton className="h-5 w-16 mx-auto" />
                  </div>
                  <div className="col-span-1 text-right">
                    <Skeleton className="h-8 w-8 ml-auto rounded-md" />
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-4/5 mt-2" />
              <Skeleton className="h-6 w-2/3 mt-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
          <CardDescription>Detailed analysis of costs by category.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyCard 
            icon={<BarChart className="h-8 w-8 text-muted-foreground" />}
            title="No cost categories data"
            description="There is no cost breakdown data available for the selected period."
          />
        </CardContent>
      </Card>
    )
  }

  return <FinancialCostsReport categories={data} />
} 
