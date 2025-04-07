"use client"

import React, { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import dynamic from "next/dynamic"
import { FinancialSalesReport } from "./financial-sales-report"

// Importar los gráficos dinámicamente para evitar problemas de hidratación
const SalesCategoryChart = dynamic(() => import("./sales-category-chart").then(mod => ({ default: mod.SalesCategoryChart })), {
  ssr: false,
  loading: () => <div className="w-full h-[300px] flex items-center justify-center">Loading chart...</div>
})

const MonthlySalesChart = dynamic(() => import("./monthly-sales-chart").then(mod => ({ default: mod.MonthlySalesChart })), {
  ssr: false,
  loading: () => <div className="w-full h-[300px] flex items-center justify-center">Loading chart...</div>
})

export function SalesReports() {
  return (
    <div className="space-y-6">
      {/* Charts Section - Pie and Bar side by side */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales Distribution by Product</CardTitle>
            <CardDescription>
              Breakdown of sales across major product categories.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="w-full h-[300px] flex items-center justify-center">Loading chart...</div>}>
              <SalesCategoryChart />
            </Suspense>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales Evolution</CardTitle>
            <CardDescription>
              Online vs retail sales over the last 6 months.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="w-full h-[300px] flex items-center justify-center">Loading chart...</div>}>
              <MonthlySalesChart />
            </Suspense>
          </CardContent>
        </Card>
      </div>
      
      {/* Financial Sales Report Section */}
      <FinancialSalesReport />
    </div>
  )
} 