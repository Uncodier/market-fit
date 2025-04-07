"use client"

import React, { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useTheme } from "@/app/context/ThemeContext"

// Dummy data for monthly costs
const data = [
  { 
    name: "Jan", 
    fixedCosts: 12000,
    variableCosts: 8500,
  },
  { 
    name: "Feb", 
    fixedCosts: 12000,
    variableCosts: 9200,
  },
  { 
    name: "Mar", 
    fixedCosts: 12000,
    variableCosts: 10500,
  },
  { 
    name: "Apr", 
    fixedCosts: 13500,
    variableCosts: 11200,
  },
  { 
    name: "May", 
    fixedCosts: 13500,
    variableCosts: 14000,
  },
  { 
    name: "Jun", 
    fixedCosts: 13500,
    variableCosts: 13200,
  },
]

export function MonthlyCostChart() {
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
    fixedCosts: isDarkMode ? "#818CF8" : "#6366F1", // Indigo
    variableCosts: isDarkMode ? "#FB7185" : "#EC4899", // Pink
    barHover: isDarkMode ? "rgba(129, 140, 248, 0.2)" : "rgba(99, 102, 241, 0.1)",
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
                {value === 'fixedCosts' ? 'Fixed Costs' : 'Variable Costs'}
              </span>
            )}
          />
          <Bar 
            dataKey="fixedCosts" 
            fill={colors.fixedCosts} 
            radius={[4, 4, 0, 0]} 
            barSize={20}
            name="fixedCosts"
            animationDuration={1500}
            animationEasing="ease-out"
          />
          <Bar 
            dataKey="variableCosts" 
            fill={colors.variableCosts} 
            radius={[4, 4, 0, 0]} 
            barSize={20}
            name="variableCosts"
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
} 