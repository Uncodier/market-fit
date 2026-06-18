"use client"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { FinancialCostsReport } from "@/app/components/dashboard/financial-costs-report"
import { useSite } from "@/app/context/SiteContext"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { PieChart, BarChart } from "@/app/components/ui/icons"
import { CostCategoryChart } from "@/app/components/dashboard/cost-category-chart"
import { MonthlyCostChart } from "@/app/components/dashboard/monthly-cost-chart"
import { 
  TotalCostsWidget,
  MarketingCostsWidget,
  EfficiencyWidget,
  OverheadWidget
} from "@/app/components/dashboard/costs"
import { CostDistributionChart } from "@/app/components/dashboard/cost-distribution-chart"
import { MonthlyCostEvolutionChart } from "@/app/components/dashboard/monthly-cost-evolution-chart"
import { CostBreakdownReport } from "@/app/components/dashboard/cost-breakdown-report"
import { subDays } from "date-fns"

interface CostData {
  totalCosts: {
    actual: number;
    previous: number;
    percentChange: number;
    formattedActual: string;
    formattedPrevious: string;
  };
  costCategories: Array<{
    name: string;
    amount: number;
    prevAmount: number;
    percentChange: number;
  }>;
  monthlyData: Array<{
    month: string;
    fixedCosts: number;
    variableCosts: number;
  }>;
  costDistribution: Array<{
    category: string;
    percentage: number;
    amount: number;
  }>;
  noData?: boolean;
}

// Definimos la estructura inicial vacía para evitar datos dummy
const emptyData: CostData = {
  totalCosts: {
    actual: 0,
    previous: 0,
    percentChange: 0,
    formattedActual: "0",
    formattedPrevious: "0"
  },
  costCategories: [],
  monthlyData: [],
  costDistribution: [],
  noData: true
};

interface CostReportsProps {
  startDate?: Date;
  endDate?: Date;
  segmentId?: string;
}

export function CostReports({ 
  startDate: propStartDate, 
  endDate: propEndDate,
  segmentId = "all" 
}: CostReportsProps) {
  const { currentSite } = useSite()
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30))
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date())
  
  // Update local state when props change
  useEffect(() => {
    if (propStartDate) {
      setStartDate(propStartDate);
    }
    if (propEndDate) {
      setEndDate(propEndDate);
    }
  }, [propStartDate, propEndDate]);

  const siteId = currentSite?.id === "default" ? null : currentSite?.id
  const url = siteId 
    ? `/api/costs?siteId=${siteId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}${segmentId !== "all" ? `&segmentId=${segmentId}` : ''}`
    : null

  const { data: fetchedCostData, isLoading: isLoadingCosts } = useSWR(
    url,
    async (fetchUrl) => {
      const response = await fetch(fetchUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch cost data')
      }
      return await response.json()
    },
    {}
  )

  const isLoading = isLoadingCosts
  const dataReady = !!fetchedCostData || !siteId
  const costData = fetchedCostData || emptyData
  const hasData = fetchedCostData ? !fetchedCostData.noData : false

  // Check if we have data to display
  const hasDistributionData = hasData && costData.costDistribution && costData.costDistribution.length > 0
  const hasMonthlyData = hasData && costData.monthlyData && costData.monthlyData.length > 0
  const hasCategoriesData = hasData && costData.costCategories && costData.costCategories.length > 0

  return (
    <div className="space-y-6">
      {/* KPI Widgets Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <TotalCostsWidget
          startDate={startDate}
          endDate={endDate}
        />
        <MarketingCostsWidget
          startDate={startDate}
          endDate={endDate}
        />
        <EfficiencyWidget
          startDate={startDate}
          endDate={endDate}
        />
        <OverheadWidget
          startDate={startDate}
          endDate={endDate}
        />
      </div>
      
      {/* Charts Section - Pie and Bar side by side */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <CostDistributionChart 
          data={costData.costDistribution}
          isLoading={isLoading}
          dataReady={dataReady}
        />
        <MonthlyCostEvolutionChart
          data={costData.monthlyData}
          isLoading={isLoading}
          dataReady={dataReady}
        />
      </div>
      
      {/* Financial Cost Report Section */}
      {isLoading || !dataReady ? (
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
      ) : hasCategoriesData ? (
        <CostBreakdownReport
          data={costData.costCategories}
          isLoading={isLoading}
          dataReady={dataReady}
        />
      ) : (
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
      )}
    </div>
  )
} 