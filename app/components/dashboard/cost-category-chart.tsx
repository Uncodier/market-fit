"use client"

import React, { useState, useEffect } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { useTheme } from "@/app/context/ThemeContext"

interface CostCategoryItem {
  category: string;
  percentage: number;
  amount: number;
}

interface CostCategoryChartProps {
  data?: CostCategoryItem[];
}

// Default data if none is provided
const defaultData = [
  { category: "Marketing", percentage: 50, amount: 15000 },
  { category: "Operations", percentage: 30, amount: 10000 },
  { category: "Administration", percentage: 20, amount: 8000 },
]

export function CostCategoryChart({ data = defaultData }: CostCategoryChartProps) {
  const { isDarkMode } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Mount effect
  useEffect(() => {
    setMounted(true)
  }, [])
  
  if (!mounted) {
    return <div className="w-full h-[300px] flex items-center justify-center">Loading chart...</div>
  }
  
  // Process data for Recharts
  const chartData = data.map(item => ({
    name: item.category,
    value: item.amount
  }))
  
  // Calculate total
  const total = chartData.reduce((sum, item) => sum + item.value, 0)
  
  // Theme-adaptive colors
  const COLORS = isDarkMode 
    ? ['#818CF8', '#A5B4FC', '#C7D2FE', '#DDD6FE', '#F5D0FE'] 
    : ['#6366F1', '#8B5CF6', '#EC4899', '#F97316', '#14B8A6']

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const percentage = ((data.value / total) * 100).toFixed(1)
      
      return (
        <div className="p-3 rounded-lg border bg-card shadow-md">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            ${data.value.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            {percentage}% of total
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            labelLine={false}
            isAnimationActive={false}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]} 
                stroke={isDarkMode ? '#1E293B' : '#fff'}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
} 