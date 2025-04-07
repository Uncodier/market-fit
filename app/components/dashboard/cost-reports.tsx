"use client"

import React, { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import dynamic from "next/dynamic"
import { FinancialCostsReport } from "./financial-costs-report"

// Importar los gráficos dinámicamente para evitar problemas de hidratación
const CostCategoryChart = dynamic(() => import("./cost-category-chart").then(mod => ({ default: mod.CostCategoryChart })), {
  ssr: false,
  loading: () => <div className="w-full h-[300px] flex items-center justify-center">Loading chart...</div>
})

const MonthlyCostChart = dynamic(() => import("./monthly-cost-chart").then(mod => ({ default: mod.MonthlyCostChart })), {
  ssr: false,
  loading: () => <div className="w-full h-[300px] flex items-center justify-center">Loading chart...</div>
})

export function CostReports() {
  return (
    <div className="space-y-6">
      {/* Charts Section - Pie and Bar side by side */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cost Distribution by Category</CardTitle>
            <CardDescription>
              Breakdown of costs across major expense categories.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="w-full h-[300px] flex items-center justify-center">Loading chart...</div>}>
              <CostCategoryChart />
            </Suspense>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Monthly Cost Evolution</CardTitle>
            <CardDescription>
              Fixed vs variable costs over the last 6 months.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="w-full h-[300px] flex items-center justify-center">Loading chart...</div>}>
              <MonthlyCostChart />
            </Suspense>
          </CardContent>
        </Card>
      </div>
      
      {/* Financial Cost Report Section */}
      <FinancialCostsReport />
    </div>
  )
} 