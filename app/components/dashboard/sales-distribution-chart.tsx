"use client"

import React from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useTheme } from "@/app/context/ThemeContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { PieChart as PieChartIcon } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { formatSalesMoney } from "@/lib/sales/report-format"
import { ReportChartFrame } from "./report-chart-frame"

interface SalesDistribution {
  category: string;
  percentage: number;
  amount: number;
}

interface SalesDistributionChartProps {
  data: SalesDistribution[];
  isLoading: boolean;
  dataReady: boolean;
  currency?: string;
}

export function SalesDistributionChart({ data, isLoading, dataReady, currency = "UNSPECIFIED" }: SalesDistributionChartProps) {
  const { isDarkMode } = useTheme()
  
  // Check if data is available
  const hasData = data && data.some((item) => item.amount > 0) && data.every((item) => item.amount >= 0) && dataReady;
  
  // Calculate total
  const total = data?.reduce((sum, item) => sum + item.amount, 0) || 0;
  
  // Format currency
  const formatCurrency = (value: number) => {
    return formatSalesMoney(value, currency);
  };
  
  // Theme-adaptive colors
  const COLORS = isDarkMode 
    ? ['#818CF8', '#A5B4FC', '#C7D2FE', '#DDD6FE', '#F5D0FE', '#FBCFE8'] 
    : ['#6366F1', '#8B5CF6', '#EC4899', '#F97316', '#14B8A6', '#06B6D4'];

  // Lighter versions of colors for gradients
  const LIGHT_COLORS = isDarkMode
    ? ['#A5B4FC', '#C7D2FE', '#DDD6FE', '#F5D0FE', '#FBCFE8', '#FDE68A']
    : ['#818CF8', '#A78BFA', '#F472B6', '#FB923C', '#2DD4BF', '#3B82F6'];

  const loading = isLoading || !dataReady
  return (
    <Card className="flex h-full min-w-0 flex-col" data-report-panel="sales-distribution">
      <CardHeader className="space-y-2 p-4 pb-3 sm:p-5 sm:pb-3">
        <CardTitle className="text-base">Sales Distribution</CardTitle>
        <CardDescription className="text-xs">
          Share of active sale amounts by channel, not cash received{!loading && hasData ? ` - ${formatCurrency(total)}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 flex-1 px-3 pb-4 sm:px-5">
        <ReportChartFrame className="h-[300px] min-w-0 w-full sm:h-[340px]" aria-busy={loading}
          role={loading || !hasData ? "status" : "img"}
          aria-label={loading ? "Loading sales distribution" : "Sales distribution by channel"}>
          {loading ? <Skeleton className="h-full w-full" /> : !hasData ? <div className="flex h-full items-center justify-center">
            <EmptyCard icon={<PieChartIcon className="h-8 w-8 text-muted-foreground" />}
              title="No sales distribution data"
              description="A channel share chart requires a positive total with no negative channel amounts. See channel totals above."
              showShadow={false} variant="simple" contentClassName="min-h-0 py-6" />
          </div> : <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              {/* Gradient definitions */}
              <defs>
                {COLORS.map((color, index) => (
                  <radialGradient
                    key={`gradient-${index}`}
                    id={`salesDistributionGradient-${index}`}
                    cx="50%"
                    cy="50%"
                    r="70%"
                    fx="50%"
                    fy="50%"
                  >
                    <stop offset="0%" stopColor={LIGHT_COLORS[index]} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={color} stopOpacity={1} />
                  </radialGradient>
                ))}
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="45%"
                outerRadius="70%"
                paddingAngle={2}
                dataKey="amount"
                nameKey="category"
                labelLine={false}
                isAnimationActive={false}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#salesDistributionGradient-${index % COLORS.length})`}
                    stroke={isDarkMode ? '#1E293B' : '#fff'}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={({ active, payload }) => {
                const item = payload?.[0]?.payload as SalesDistribution | undefined
                if (!active || !item) return null
                return <div className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-sm">
                  <p className="font-medium">{item.category}</p>
                  <p className="text-sm">{formatCurrency(item.amount)}</p>
                  <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}% of total</p>
                </div>
              }} />
            </PieChart>
          </ResponsiveContainer>}
        </ReportChartFrame>
        {!loading && hasData && <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Sales distribution legend">
          {data.map((item, index) => <li key={item.category} className="inline-flex min-w-0 items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
            <span className="break-words [overflow-wrap:anywhere]">{item.category}</span>
          </li>)}
        </ul>}
      </CardContent>
    </Card>
  );
} 