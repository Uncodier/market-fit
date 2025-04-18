"use client"

import React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from "@/app/context/ThemeContext"

// Datos para mostrar en el gráfico
const data = [
  { name: "Jan", total: 1200 },
  { name: "Feb", total: 1900 },
  { name: "Mar", total: 1500 },
  { name: "Apr", total: 1700 },
  { name: "May", total: 2400 },
  { name: "Jun", total: 2100 },
  { name: "Jul", total: 2300 },
  { name: "Aug", total: 2800 },
  { name: "Sep", total: 3200 },
  { name: "Oct", total: 2900 },
  { name: "Nov", total: 3500 },
  { name: "Dec", total: 3700 }
]

// Componente cliente puro para Recharts
export function OverviewClient() {
  // Obtener el estado del tema
  const { isDarkMode } = useTheme()
  
  // Colores adaptables según el tema
  const colors = {
    text: isDarkMode ? "#CBD5E1" : "#9CA3AF",
    grid: isDarkMode ? "rgba(203, 213, 225, 0.2)" : "#f0f0f0",
    tooltipBackground: isDarkMode ? "#1E293B" : "white",
    tooltipBorder: isDarkMode ? "#475569" : "#e5e7eb",
    tooltipText: isDarkMode ? "#F8FAFC" : "#111827",
    barFill: isDarkMode ? "#818CF8" : "#6366F1", // Un tono más claro de indigo para modo oscuro
    barHover: isDarkMode ? "#A5B4FC" : "rgba(99, 102, 241, 0.1)",
  }

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            vertical={false} 
            stroke={colors.grid} 
            opacity={isDarkMode ? 0.6 : 1}
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
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip 
            formatter={(value: number) => [value.toLocaleString(), 'Total']}
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
          <Bar 
            dataKey="total" 
            fill={colors.barFill} 
            radius={[4, 4, 0, 0]} 
            barSize={40}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
} 