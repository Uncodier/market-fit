"use client"

import React, { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useTheme } from "@/app/context/ThemeContext"

// Dummy data for monthly sales
const data = [
  { 
    name: "Jan", 
    online: 18000,
    retail: 12500,
  },
  { 
    name: "Feb", 
    online: 19200,
    retail: 13000,
  },
  { 
    name: "Mar", 
    online: 22500,
    retail: 14500,
  },
  { 
    name: "Apr", 
    online: 25200,
    retail: 14800,
  },
  { 
    name: "May", 
    online: 28000,
    retail: 15500,
  },
  { 
    name: "Jun", 
    online: 32200,
    retail: 16200,
  },
]

export function MonthlySalesChart() {
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
  const colors = {
    text: isDarkMode ? "#CBD5E1" : "#9CA3AF",
    grid: isDarkMode ? "rgba(203, 213, 225, 0.1)" : "#f0f0f0",
    tooltipBackground: isDarkMode ? "#1E293B" : "white",
    tooltipBorder: isDarkMode ? "#475569" : "#e5e7eb",
    tooltipText: isDarkMode ? "#F8FAFC" : "#111827",
    online: isDarkMode ? "#34D399" : "#10B981", // Green
    onlineStart: isDarkMode ? "#6EE7B7" : "#34D399", // Lighter green for gradient
    retail: isDarkMode ? "#60A5FA" : "#3B82F6", // Blue
    retailStart: isDarkMode ? "#93C5FD" : "#60A5FA", // Lighter blue for gradient
    barHover: isDarkMode ? "rgba(52, 211, 153, 0.2)" : "rgba(16, 185, 129, 0.1)",
  }

  return (
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
            dataKey="name" 
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
            formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
            labelStyle={{ fontWeight: 'bold', color: colors.tooltipText }}
            contentStyle={{ 
              backgroundColor: colors.tooltipBackground, 
              border: `1px solid ${colors.tooltipBorder}`,
              borderRadius: '0.375rem', 
              boxShadow: isDarkMode 
                ? '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.3)' 
                : '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
            }}
            cursor={{ fill: colors.barHover }}
            itemStyle={{ color: colors.tooltipText }}
          />
          <Legend
            formatter={(value) => (
              <span className={isDarkMode ? 'text-slate-300' : 'text-gray-700'}>
                {value === 'online' ? 'Online Sales' : 'Retail Sales'}
              </span>
            )}
            iconType="circle"
            wrapperStyle={{ paddingTop: 10 }}
          />
          {/* Definición de gradientes para las barras */}
          <defs>
            <linearGradient id="onlineSalesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.onlineStart} />
              <stop offset="100%" stopColor={colors.online} />
            </linearGradient>
            <linearGradient id="retailSalesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.retailStart} />
              <stop offset="100%" stopColor={colors.retail} />
            </linearGradient>
          </defs>
          <Bar 
            dataKey="online" 
            fill="url(#onlineSalesGradient)" 
            radius={[4, 4, 0, 0]} 
            barSize={20}
            name="online"
            animationDuration={1500}
            animationEasing="ease-out"
          />
          <Bar 
            dataKey="retail" 
            fill="url(#retailSalesGradient)" 
            radius={[4, 4, 0, 0]} 
            barSize={20}
            name="retail"
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
} 