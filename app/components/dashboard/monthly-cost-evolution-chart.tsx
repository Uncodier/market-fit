"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { BarChart } from "@/app/components/ui/icons"
import { MonthlyCostChart } from "@/app/components/dashboard/monthly-cost-chart"

interface MonthlyCostEvolutionChartProps {
  data: Array<{
    month: string;
    fixedCosts: number;
    variableCosts: number;
  }>;
  isLoading: boolean;
  dataReady: boolean;
}

export function MonthlyCostEvolutionChart({ data, isLoading, dataReady }: MonthlyCostEvolutionChartProps) {
  const hasData = data && data.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Cost Evolution</CardTitle>
        <CardDescription>
          Fixed vs variable costs over the last 6 months.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative min-h-[300px]">
        {isLoading || !dataReady ? (
          <div className="flex items-center justify-center w-full h-[300px]">
            <div className="w-full space-y-4">
              <Skeleton className="h-[200px] w-full rounded-md" />
              <div className="flex justify-center space-x-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
        ) : hasData ? (
          <div className="w-full h-[300px]">
            <MonthlyCostChart data={data} />
          </div>
        ) : (
          <div className="w-full h-[300px]">
            <EmptyCard 
              icon={<BarChart className="h-8 w-8 text-muted-foreground" />}
              title="No monthly cost data"
              description="There is no monthly cost evolution data available for the selected period."
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
} 