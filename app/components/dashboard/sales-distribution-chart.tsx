"use client"

import React from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { useTheme } from "@/app/context/ThemeContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { PieChart as PieChartIcon } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"

interface SalesDistribution {
  category: string;
  percentage: number;
  amount: number;
}

interface SalesDistributionChartProps {
  data: SalesDistribution[];
  isLoading: boolean;
  dataReady: boolean;
}

export function SalesDistributionChart({ data, isLoading, dataReady }: SalesDistributionChartProps) {
  const { isDarkMode } = useTheme()
  
  // Check if data is available
  const hasData = data && data.length > 0 && dataReady;
  
  // Calculate total
  const total = data?.reduce((sum, item) => sum + item.amount, 0) || 0;
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Theme-adaptive colors
  const COLORS = isDarkMode 
    ? ['#818CF8', '#A5B4FC', '#C7D2FE', '#DDD6FE', '#F5D0FE', '#FBCFE8'] 
    : ['#6366F1', '#8B5CF6', '#EC4899', '#F97316', '#14B8A6', '#06B6D4'];

  // Lighter versions of colors for gradients
  const LIGHT_COLORS = isDarkMode
    ? ['#A5B4FC', '#C7D2FE', '#DDD6FE', '#F5D0FE', '#FBCFE8', '#FDE68A']
    : ['#818CF8', '#A78BFA', '#F472B6', '#FB923C', '#2DD4BF', '#3B82F6'];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <p className="font-medium">{data.category}</p>
          <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
            {formatCurrency(data.amount)}
          </p>
          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
            {data.percentage}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Distribution</CardTitle>
          <CardDescription>
            Breakdown of sales across product categories
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
          <CardTitle>Sales Distribution</CardTitle>
          <CardDescription>
            Breakdown of sales across product categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyCard 
            icon={<PieChartIcon className="h-8 w-8 text-muted-foreground" />}
            title="No sales distribution data"
            description="There is no sales data available for the selected period."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Distribution</CardTitle>
        <CardDescription>
          Breakdown of sales across product categories - {formatCurrency(total)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[300px] pie-chart-container">
          <ResponsiveContainer width="100%" height="100%">
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
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="amount"
                nameKey="category"
                labelLine={false}
                isAnimationActive={true}
                animationBegin={0}
                animationDuration={400}
                animationEasing="ease-out"
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
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                layout="horizontal" 
                verticalAlign="bottom" 
                align="center"
                formatter={(value) => (
                  <span className={isDarkMode ? 'text-slate-300' : 'text-gray-700'}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* CSS Animations */}
        <style jsx>{`
          @keyframes pie-chart-fade-in {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          
          .pie-chart-container {
            animation: pie-chart-fade-in 0.3s ease-out forwards;
          }
        `}</style>
      </CardContent>
    </Card>
  );
} 