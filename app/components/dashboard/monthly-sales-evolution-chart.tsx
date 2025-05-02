"use client"

import React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useTheme } from "@/app/context/ThemeContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { BarChart as BarChartIcon } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"

interface MonthlySalesData {
  month: string;
  onlineSales: number;
  retailSales: number;
}

interface MonthlySalesEvolutionChartProps {
  data: MonthlySalesData[];
  isLoading: boolean;
  dataReady: boolean;
}

export function MonthlySalesEvolutionChart({ data, isLoading, dataReady }: MonthlySalesEvolutionChartProps) {
  const { isDarkMode } = useTheme()
  
  // Check if data is available
  const hasData = data && data.length > 0 && dataReady;
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Custom tooltip formatter
  const tooltipFormatter = (value: number) => {
    return formatCurrency(value);
  };
  
  // Theme-adaptive colors
  const colors = {
    text: isDarkMode ? "#CBD5E1" : "#9CA3AF",
    grid: isDarkMode ? "rgba(203, 213, 225, 0.1)" : "#f0f0f0",
    tooltipBackground: isDarkMode ? "#1E293B" : "white",
    tooltipBorder: isDarkMode ? "#475569" : "#e5e7eb",
    tooltipText: isDarkMode ? "#F8FAFC" : "#111827",
    online: isDarkMode ? "#34D399" : "#10B981", // Green
    retail: isDarkMode ? "#60A5FA" : "#3B82F6", // Blue
    barHover: isDarkMode ? "rgba(52, 211, 153, 0.2)" : "rgba(16, 185, 129, 0.1)",
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Sales Evolution</CardTitle>
          <CardDescription>
            Online vs retail sales over the last 6 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-2">
            <Skeleton className="h-[300px] w-full" />
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
          <CardTitle>Monthly Sales Evolution</CardTitle>
          <CardDescription>
            Online vs retail sales over the last 6 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyCard 
            icon={<BarChartIcon className="h-8 w-8 text-muted-foreground" />}
            title="No monthly sales data"
            description="There is no monthly sales data available for the selected period."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Sales Evolution</CardTitle>
        <CardDescription>
          Online vs retail sales over the last 6 months
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
              barGap={5}
              barCategoryGap={20}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                vertical={false} 
                stroke={colors.grid} 
                opacity={isDarkMode ? 0.3 : 1}
              />
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: colors.text }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false} 
                tick={{ fontSize: 12, fill: colors.text }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={tooltipFormatter}
                labelStyle={{ fontWeight: 'bold', color: colors.tooltipText }}
                contentStyle={{ 
                  backgroundColor: colors.tooltipBackground, 
                  border: `1px solid ${colors.tooltipBorder}`,
                  borderRadius: '0.375rem', 
                  boxShadow: isDarkMode 
                    ? '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.3)' 
                    : '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                }}
                itemStyle={{ color: colors.tooltipText }}
              />
              <Legend
                formatter={(value) => (
                  <span className={isDarkMode ? 'text-slate-300' : 'text-gray-700'}>
                    {value === 'onlineSales' ? 'Online Sales' : 'Retail Sales'}
                  </span>
                )}
              />
              <Bar 
                dataKey="onlineSales" 
                fill={colors.online} 
                radius={[4, 4, 0, 0]} 
                barSize={20}
                name="onlineSales"
                isAnimationActive={false}
              />
              <Bar 
                dataKey="retailSales" 
                fill={colors.retail} 
                radius={[4, 4, 0, 0]} 
                barSize={20}
                name="retailSales"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
} 