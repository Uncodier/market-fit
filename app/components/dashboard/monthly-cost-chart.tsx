"use client"

import React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from "@/app/context/ThemeContext"

interface MonthlyDataItem {
  month: string;
  fixedCosts: number;
  variableCosts: number;
}

interface MonthlyCostChartProps {
  data: MonthlyDataItem[];
  isLoading?: boolean;
}

// Datos predeterminados
// Eliminados para evitar mostrar dummy data

export function MonthlyCostChart({ 
  data,
  isLoading = false 
}: MonthlyCostChartProps) {
  const { isDarkMode } = useTheme()
  
  // Colores adaptables según el tema
  const colors = {
    text: isDarkMode ? "#CBD5E1" : "#9CA3AF",
    grid: isDarkMode ? "rgba(203, 213, 225, 0.2)" : "#f0f0f0",
    tooltipBackground: isDarkMode ? "#1E293B" : "white",
    tooltipBorder: isDarkMode ? "#475569" : "#e5e7eb",
    tooltipText: isDarkMode ? "#F8FAFC" : "#111827",
    fixedCostsFill: isDarkMode ? "#818CF8" : "#6366F1", // Indigo para costos fijos
    fixedCostsStart: isDarkMode ? "#A5B4FC" : "#818CF8", // Color más claro para el gradiente
    variableCostsFill: isDarkMode ? "#F472B6" : "#EC4899", // Rosa para costos variables
    variableCostsStart: isDarkMode ? "#F9A8D4" : "#F472B6", // Color más claro para el gradiente
    barHover: isDarkMode ? "rgba(165, 180, 252, 0.4)" : "rgba(99, 102, 241, 0.1)",
  }

  // Formatear moneda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value)
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="w-full h-[300px] bg-slate-100 dark:bg-slate-800 rounded-md animate-pulse" />
    )
  }

  // Verificar si hay datos disponibles
  if (!data || data.length === 0) {
    return null
  }

  // Preparar datos para el gráfico - convertir 'month' a 'name' para el eje X
  const chartData = data.map(item => ({
    name: item.month,
    fixedCosts: item.fixedCosts,
    variableCosts: item.variableCosts
  }))

  return (
    <div className="w-full h-[300px]" style={{ minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
          barGap={2}
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
            tickFormatter={(value) => `$${value / 1000}k`}
          />
          <Tooltip 
            formatter={(value: number, name: string) => {
              const label = name === 'fixedCosts' ? 'Fixed Costs' : 'Variable Costs'
              return [formatCurrency(value), label]
            }}
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
          {/* Definición de gradientes para las barras */}
          <defs>
            <linearGradient id="fixedCostsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.fixedCostsStart} />
              <stop offset="100%" stopColor={colors.fixedCostsFill} />
            </linearGradient>
            <linearGradient id="variableCostsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.variableCostsStart} />
              <stop offset="100%" stopColor={colors.variableCostsFill} />
            </linearGradient>
          </defs>
          <Bar 
            dataKey="fixedCosts" 
            name="Fixed Costs"
            fill="url(#fixedCostsGradient)" 
            radius={[4, 4, 0, 0]} 
            barSize={20}
            minPointSize={8}
            isAnimationActive={false}
          />
          <Bar 
            dataKey="variableCosts" 
            name="Variable Costs"
            fill="url(#variableCostsGradient)" 
            radius={[4, 4, 0, 0]} 
            barSize={20}
            minPointSize={8}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
      
      {/* Leyenda */}
      <div className="flex justify-center space-x-4 mt-1">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded mr-1" style={{ 
            background: `linear-gradient(to bottom, ${colors.fixedCostsStart}, ${colors.fixedCostsFill})`
          }}></div>
          <span className={`text-xs ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}>Fixed Costs</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded mr-1" style={{ 
            background: `linear-gradient(to bottom, ${colors.variableCostsStart}, ${colors.variableCostsFill})`
          }}></div>
          <span className={`text-xs ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}>Variable Costs</span>
        </div>
      </div>
    </div>
  )
} 