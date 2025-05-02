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
  data: CostCategoryItem[];
}

// Eliminados los datos predeterminados para evitar mostrar dummy data

export function CostCategoryChart({ data }: CostCategoryChartProps) {
  const { isDarkMode } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Mount effect
  useEffect(() => {
    setMounted(true)
  }, [])
  
  if (!mounted) {
    return <div className="w-full h-[300px] flex items-center justify-center">Loading chart...</div>
  }
  
  // Verificar si hay datos disponibles
  if (!data || data.length === 0) {
    return null
  }
  
  // Process data for Recharts
  const chartData = data.map(item => ({
    name: item.category,
    value: item.amount
  }))
  
  // Calculate total
  const total = chartData.reduce((sum, item) => sum + item.value, 0)
  
  // Theme-adaptive colors
  const BASE_COLORS = isDarkMode 
    ? ['#818CF8', '#A5B4FC', '#C7D2FE', '#DDD6FE', '#F5D0FE'] 
    : ['#6366F1', '#8B5CF6', '#EC4899', '#F97316', '#14B8A6']
    
  // Lighter versions of colors for gradients
  const LIGHT_COLORS = isDarkMode
    ? ['#A5B4FC', '#C7D2FE', '#DDD6FE', '#F5D0FE', '#FBCFE8']
    : ['#818CF8', '#A78BFA', '#F472B6', '#FB923C', '#2DD4BF']

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
          {/* Definición de gradientes para los sectores */}
          <defs>
            {BASE_COLORS.map((color, index) => (
              <radialGradient
                key={`gradient-${index}`}
                id={`costCategoryGradient-${index}`}
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
                fill={`url(#costCategoryGradient-${index % BASE_COLORS.length})`} 
                stroke={isDarkMode ? '#1E293B' : '#fff'}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            formatter={(value, entry, index) => (
              <span style={{ color: isDarkMode ? '#CBD5E1' : '#475569' }}>
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
} 