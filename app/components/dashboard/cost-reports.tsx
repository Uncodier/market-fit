"use client"

import React, { useState, useEffect } from "react"
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
  const [isLoading, setIsLoading] = useState(true)
  const [costData, setCostData] = useState<CostData>(emptyData)
  const [dataReady, setDataReady] = useState(false)
  const [hasData, setHasData] = useState(false)

  // Usar fechas proporcionadas por props o valores por defecto
  const startDate = propStartDate || (() => {
    const start = new Date()
    start.setMonth(start.getMonth() - 1)
    return start
  })()
  
  const endDate = propEndDate || new Date()

  useEffect(() => {
    if (!currentSite || currentSite.id === "default") {
      // Usar datos vacíos para el sitio por defecto
      setCostData(emptyData)
      setIsLoading(false)
      setDataReady(true)
      setHasData(false)
      return
    }
    
    // Fetch cost data from API
    const fetchCostData = async () => {
      try {
        setIsLoading(true)
        setDataReady(false)
        
        console.log(`Fetching cost data with: startDate=${startDate.toISOString()}, endDate=${endDate.toISOString()}, segmentId=${segmentId}`)
        
        const url = `/api/costs?siteId=${currentSite.id}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}${segmentId !== "all" ? `&segmentId=${segmentId}` : ''}`
        const response = await fetch(url)
        
        if (!response.ok) {
          throw new Error("Failed to fetch cost data")
        }
        
        const data = await response.json()
        console.log("Cost data received:", data)
        
        setCostData(data)
        
        // Check if the API returned the noData flag
        setHasData(!data.noData)
        
        // Marcar datos como listos después de cargarlos y actualizar el estado
        setDataReady(true)
      } catch (error) {
        console.error("Error fetching cost data:", error)
        // Usar datos vacíos en caso de error
        setCostData(emptyData)
        setHasData(false)
        setDataReady(true)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchCostData()
  }, [currentSite, startDate, endDate, segmentId])

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