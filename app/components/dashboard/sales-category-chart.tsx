"use client"

import React, { useEffect, useState } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { useTheme } from "@/app/context/ThemeContext"

// Dummy data for sales categories
const data = [
  { name: "Product A", value: 35000 },
  { name: "Product B", value: 25000 },
  { name: "Product C", value: 18000 },
  { name: "Product D", value: 12000 },
  { name: "Others", value: 10000 },
]

// Calculate total
const total = data.reduce((sum, item) => sum + item.value, 0)

export function SalesCategoryChart() {
  // Get theme state
  const { isDarkMode } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Mounted effect para asegurar que el componente solo se renderice en el cliente
  useEffect(() => {
    setMounted(true)
  }, [])
  
  if (!mounted) {
    return <div className="w-full h-[300px] flex items-center justify-center">Loading chart...</div>
  }
  
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
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <p className="font-medium">{data.name}</p>
          <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
            ${data.value.toLocaleString()}
          </p>
          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
            {percentage}% of total
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          {/* Definición de gradientes para los sectores */}
          <defs>
            {BASE_COLORS.map((color, index) => (
              <radialGradient
                key={`gradient-${index}`}
                id={`salesCategoryGradient-${index}`}
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
            dataKey="value"
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={`url(#salesCategoryGradient-${index % BASE_COLORS.length})`} 
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
  )
} 