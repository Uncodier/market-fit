"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { FinancialCostsReport } from "./financial-costs-report"
import { useSite } from "@/app/context/SiteContext"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { PieChart, BarChart } from "@/app/components/ui/icons"
import { CostCategoryChart } from "./cost-category-chart"
import { MonthlyCostChart } from "./monthly-cost-chart"
import { TotalCostsWidget } from "./costs/total-costs-widget"
import { MarketingCostsWidget } from "./costs/marketing-costs-widget"
import { EfficiencyWidget } from "./costs/efficiency-widget"
import { OverheadWidget } from "./costs/overhead-widget"

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
}

// Static default data
const defaultData: CostData = {
  totalCosts: {
    actual: 5000,
    previous: 4500,
    percentChange: 11.1,
    formattedActual: "5,000",
    formattedPrevious: "4,500"
  },
  costCategories: [
    { name: "Marketing", amount: 2500, prevAmount: 2300, percentChange: 8.7 },
    { name: "Operations", amount: 1500, prevAmount: 1400, percentChange: 7.1 },
    { name: "Administration", amount: 1000, prevAmount: 800, percentChange: 25 }
  ],
  monthlyData: [
    { month: "Jan", fixedCosts: 12000, variableCosts: 8500 },
    { month: "Feb", fixedCosts: 12000, variableCosts: 9200 },
    { month: "Mar", fixedCosts: 12000, variableCosts: 10500 },
    { month: "Apr", fixedCosts: 13500, variableCosts: 11200 },
    { month: "May", fixedCosts: 13500, variableCosts: 14000 },
    { month: "Jun", fixedCosts: 13500, variableCosts: 13200 }
  ],
  costDistribution: [
    { category: "Marketing", percentage: 50, amount: 2500 },
    { category: "Operations", percentage: 30, amount: 1500 },
    { category: "Administration", percentage: 20, amount: 1000 }
  ]
};

export function CostReports() {
  const { currentSite } = useSite()
  const [isLoading, setIsLoading] = useState(true)
  const [costData, setCostData] = useState<CostData>(defaultData)
  const [dataReady, setDataReady] = useState(false)

  // Inicializar fechas
  const [startDate, setStartDate] = useState<Date>(() => {
    const start = new Date()
    start.setMonth(start.getMonth() - 1)
    return start
  })
  
  const [endDate, setEndDate] = useState<Date>(new Date())

  useEffect(() => {
    if (!currentSite || currentSite.id === "default") {
      // Usar datos por defecto pero sin mostrar loader
      setIsLoading(false)
      setDataReady(true)
      return
    }
    
    // Fetch cost data from API
    const fetchCostData = async () => {
      try {
        setIsLoading(true)
        setDataReady(false)
        
        const response = await fetch(`/api/costs?siteId=${currentSite.id}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        
        if (!response.ok) {
          throw new Error("Failed to fetch cost data")
        }
        
        const data = await response.json()
        setCostData(data)
        
        // Marcar datos como listos después de cargarlos y actualizar el estado
        setDataReady(true)
      } catch (error) {
        console.error("Error fetching cost data:", error)
        // Usar datos por defecto en caso de error
        setCostData(defaultData)
        setDataReady(true)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchCostData()
  }, [currentSite, startDate, endDate])

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  // Check if distribution data is empty
  const hasDistributionData = costData.costDistribution && costData.costDistribution.length > 0
  
  // Check if monthly data is empty
  const hasMonthlyData = costData.monthlyData && costData.monthlyData.length > 0
  
  // Check if categories data is empty
  const hasCategoriesData = costData.costCategories && costData.costCategories.length > 0

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
            ) : hasDistributionData ? (
              <div className="w-full h-[300px]">
                <CostCategoryChart data={costData.costDistribution} />
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
            ) : hasMonthlyData ? (
              <div className="w-full h-[300px]">
                <MonthlyCostChart data={costData.monthlyData} />
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
        <FinancialCostsReport categories={costData.costCategories} />
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