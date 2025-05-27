"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { useTheme } from "@/app/context/ThemeContext"
import { TrendingUp } from "@/app/components/ui/icons"

interface ProjectionData {
  year: string;
  actual?: number;
  projected: number;
  optimistic?: number;
  conservative?: number;
}

interface RevenueProjectionsChartProps {
  startYear?: number;
  endYear?: number;
  data?: ProjectionData[];
}

export function RevenueProjectionsChart({ 
  startYear = 2025,
  endYear = 2028,
  data
}: RevenueProjectionsChartProps) {
  const { isDarkMode } = useTheme()
  
  // Generate default projection data if not provided
  const defaultData: ProjectionData[] = [
    { year: "2025", projected: 2500000, optimistic: 2800000, conservative: 2200000 },
    { year: "2026", projected: 3200000, optimistic: 3700000, conservative: 2900000 },
    { year: "2027", projected: 4100000, optimistic: 4800000, conservative: 3700000 },
    { year: "2028", projected: 5200000, optimistic: 6200000, conservative: 4700000 },
  ]
  
  const projectionData = data || defaultData.filter(item => {
    const year = parseInt(item.year)
    return year >= startYear && year <= endYear
  })
  
  // Calculate max value for scaling
  const maxValue = Math.max(...projectionData.flatMap(item => [
    item.projected,
    item.optimistic || 0,
    item.conservative || 0
  ]))
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
      notation: value >= 1000000 ? 'compact' : 'standard',
      compactDisplay: 'short'
    }).format(value)
  }
  
  // Calculate dimensions
  const chartWidth = 100
  const chartHeight = 250
  const padding = { top: 20, right: 10, bottom: 40, left: 10 }
  const graphWidth = chartWidth - padding.left - padding.right
  const graphHeight = chartHeight - padding.top - padding.bottom
  
  // Create SVG path for area chart
  const createPath = (data: ProjectionData[], valueKey: keyof ProjectionData) => {
    const points = data.map((item, index) => {
      const x = (index / (data.length - 1)) * graphWidth
      const value = item[valueKey] as number || 0
      const y = graphHeight - (value / maxValue) * graphHeight
      return `${x},${y}`
    })
    
    const pathData = `M ${points.join(' L ')}`
    const areaData = `${pathData} L ${graphWidth},${graphHeight} L 0,${graphHeight} Z`
    
    return { pathData, areaData }
  }
  
  const projectedPath = createPath(projectionData, 'projected')
  const optimisticPath = createPath(projectionData, 'optimistic')
  const conservativePath = createPath(projectionData, 'conservative')
  
  // Theme colors
  const colors = {
    text: isDarkMode ? "#94a3b8" : "#64748b",
    gridLine: isDarkMode ? "rgba(148, 163, 184, 0.1)" : "rgba(100, 116, 139, 0.1)",
    projected: isDarkMode ? "#8b5cf6" : "#7c3aed",
    optimistic: isDarkMode ? "#10b981" : "#059669",
    conservative: isDarkMode ? "#f59e0b" : "#d97706",
    cardBg: isDarkMode ? "#1e293b" : "#ffffff",
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Revenue Projections</CardTitle>
            <CardDescription>
              Expected revenue growth from {startYear} to {endYear}
            </CardDescription>
          </div>
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full">
          {/* SVG Chart */}
          <svg 
            viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
            className="w-full h-auto max-h-[300px]"
            style={{ minHeight: '250px' }}
          >
            {/* Grid lines */}
            <g>
              {[0, 25, 50, 75, 100].map((percent) => {
                const y = padding.top + (percent / 100) * graphHeight
                return (
                  <line
                    key={percent}
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + graphWidth}
                    y2={y}
                    stroke={colors.gridLine}
                    strokeDasharray="3 3"
                  />
                )
              })}
            </g>
            
            {/* Area fills */}
            <g transform={`translate(${padding.left}, ${padding.top})`}>
              {/* Conservative area */}
              <path
                d={conservativePath.areaData}
                fill={colors.conservative}
                opacity="0.1"
              />
              
              {/* Optimistic area */}
              <path
                d={optimisticPath.areaData}
                fill={colors.optimistic}
                opacity="0.1"
              />
              
              {/* Lines */}
              <path
                d={conservativePath.pathData}
                fill="none"
                stroke={colors.conservative}
                strokeWidth="2"
                strokeDasharray="5 5"
                opacity="0.6"
              />
              
              <path
                d={optimisticPath.pathData}
                fill="none"
                stroke={colors.optimistic}
                strokeWidth="2"
                strokeDasharray="5 5"
                opacity="0.6"
              />
              
              <path
                d={projectedPath.pathData}
                fill="none"
                stroke={colors.projected}
                strokeWidth="3"
              />
              
              {/* Data points */}
              {projectionData.map((item, index) => {
                const x = (index / (projectionData.length - 1)) * graphWidth
                const y = graphHeight - (item.projected / maxValue) * graphHeight
                
                return (
                  <g key={item.year}>
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      fill={colors.projected}
                      stroke={colors.cardBg}
                      strokeWidth="2"
                    />
                    {/* Value label */}
                    <text
                      x={x}
                      y={y - 10}
                      textAnchor="middle"
                      fontSize="11"
                      fill={colors.text}
                      className="font-medium"
                    >
                      {formatCurrency(item.projected)}
                    </text>
                  </g>
                )
              })}
            </g>
            
            {/* X-axis labels (years) */}
            <g transform={`translate(${padding.left}, ${padding.top + graphHeight})`}>
              {projectionData.map((item, index) => {
                const x = (index / (projectionData.length - 1)) * graphWidth
                
                return (
                  <text
                    key={item.year}
                    x={x}
                    y={20}
                    textAnchor="middle"
                    fontSize="12"
                    fill={colors.text}
                    className="font-medium"
                  >
                    {item.year}
                  </text>
                )
              })}
            </g>
          </svg>
          
          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: colors.projected }}
              />
              <span className="text-xs text-muted-foreground">Projected</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full opacity-60" 
                style={{ backgroundColor: colors.optimistic }}
              />
              <span className="text-xs text-muted-foreground">Optimistic</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full opacity-60" 
                style={{ backgroundColor: colors.conservative }}
              />
              <span className="text-xs text-muted-foreground">Conservative</span>
            </div>
          </div>
          
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Expected Growth</p>
              <p className="text-sm font-semibold text-primary">
                {Math.round(((projectionData[projectionData.length - 1].projected - projectionData[0].projected) / projectionData[0].projected) * 100)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">CAGR</p>
              <p className="text-sm font-semibold text-primary">
                {Math.round(Math.pow(projectionData[projectionData.length - 1].projected / projectionData[0].projected, 1 / (projectionData.length - 1)) * 100 - 100)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Target {endYear}</p>
              <p className="text-sm font-semibold text-primary">
                {formatCurrency(projectionData[projectionData.length - 1].projected)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 