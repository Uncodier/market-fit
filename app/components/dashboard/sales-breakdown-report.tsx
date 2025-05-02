"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { BarChart } from "@/app/components/ui/icons"
import { FinancialSalesBreakdown } from "@/app/components/dashboard/financial-sales-breakdown"

interface SalesBreakdownReportProps {
  data: Array<{
    name: string;
    amount: number;
    prevAmount: number;
    percentChange: number;
  }>;
  isLoading: boolean;
  dataReady: boolean;
}

export function SalesBreakdownReport({ data, isLoading, dataReady }: SalesBreakdownReportProps) {
  const hasData = data && data.length > 0;

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Breakdown</CardTitle>
          <CardDescription>Detailed analysis of sales by product category.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-[400px] w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Breakdown</CardTitle>
          <CardDescription>Detailed analysis of sales by product category.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyCard 
            icon={<BarChart className="h-8 w-8 text-muted-foreground" />}
            title="No sales categories data"
            description="There is no sales breakdown data available for the selected period."
          />
        </CardContent>
      </Card>
    );
  }

  return <FinancialSalesBreakdown categories={data} />;
} 