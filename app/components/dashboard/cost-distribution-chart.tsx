"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { PieChart } from "@/app/components/ui/icons"
import { CostCategoryChart } from "@/app/components/dashboard/cost-category-chart"

interface CostDistributionChartProps {
  data: Array<{
    category: string;
    percentage: number;
    amount: number;
  }>;
  isLoading: boolean;
  dataReady: boolean;
}

export function CostDistributionChart({ data, isLoading, dataReady }: CostDistributionChartProps) {
  const hasData = data && data.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Distribution by Category</CardTitle>
        <CardDescription>
          Breakdown of costs across major expense categories.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative min-h-[300px]">
        {isLoading || !dataReady ? (
          <div className="flex items-center justify-center w-full h-[300px]">
            <div className="w-full max-w-md space-y-4">
              <div className="flex justify-center">
                <Skeleton className="h-40 w-40 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </div>
        ) : hasData ? (
          <div className="w-full h-[300px]">
            <CostCategoryChart data={data} />
          </div>
        ) : (
          <div className="w-full h-[300px]">
            <EmptyCard 
              icon={<PieChart className="h-8 w-8 text-muted-foreground" />}
              title="No cost distribution data"
              description="There is no cost distribution data available for the selected period."
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
} 