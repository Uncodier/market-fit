"use client"

import React, { useEffect, useState } from "react"
import { useTheme } from "@/app/context/ThemeContext"
import { useSite } from "@/app/context/SiteContext"
import { 
  differenceInDays, differenceInMonths, format, 
  addDays, addMonths, addQuarters, addYears,
  startOfDay, startOfMonth, startOfQuarter, startOfYear, 
  endOfMonth, endOfQuarter, endOfYear, endOfDay,
  isSameYear, isBefore, 
  subMonths, subYears, subQuarters
} from "date-fns"

interface ChartDataItem {
  name: string
  total: number | null
  date: Date
}

interface SaleData {
  id: string
  amount: number
  created_at: string
  segment_id?: string
  status: string
}

export function Overview({ startDate, endDate, segmentId = "all" }: { startDate?: Date, endDate?: Date, segmentId?: string }) {
  const { isDarkMode } = useTheme()
  const { currentSite } = useSite()
  const [chartData, setChartData] = useState<ChartDataItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    const fetchSalesData = async () => {
      if (!startDate || !endDate || !currentSite?.id || currentSite.id === "default") {
        // Default data if no dates are provided or site not selected
        setChartData([
          { name: "Jan", total: 1200, date: new Date(2023, 0, 1) },
          { name: "Feb", total: 1900, date: new Date(2023, 1, 1) },
          { name: "Mar", total: 1500, date: new Date(2023, 2, 1) },
          { name: "Apr", total: 1700, date: new Date(2023, 3, 1) },
          { name: "May", total: 2400, date: new Date(2023, 4, 1) },
          { name: "Jun", total: 2100, date: new Date(2023, 5, 1) },
          { name: "Jul", total: 2300, date: new Date(2023, 6, 1) },
          { name: "Aug", total: 2800, date: new Date(2023, 7, 1) },
          { name: "Sep", total: 3200, date: new Date(2023, 8, 1) },
          { name: "Oct", total: 2900, date: new Date(2023, 9, 1) },
          { name: "Nov", total: 3500, date: new Date(2023, 10, 1) },
          { name: "Dec", total: 3700, date: new Date(2023, 11, 1) }
        ])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      
      try {
      // Determine the interval type based on the date range
      const daysDiff = differenceInDays(endDate, startDate)
      const monthsDiff = differenceInMonths(endDate, startDate)
      
      let intervalType: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month'
      
      // Determine the appropriate interval type based on date range
      if (daysDiff <= 14) {
        intervalType = 'day'
      } else if (daysDiff <= 90) {
        intervalType = 'week'
      } else if (monthsDiff <= 24) {
        intervalType = 'month'
      } else {
        intervalType = 'quarter'
        }
        
        // Always use 12 intervals
        const TOTAL_INTERVALS = 12
        
        // Fetch all sales data for the period
        const params = new URLSearchParams()
        params.append("siteId", currentSite.id)
        params.append("startDate", format(startDate, "yyyy-MM-dd"))
        params.append("endDate", format(endDate, "yyyy-MM-dd"))
        if (segmentId && segmentId !== "all") {
          params.append("segmentId", segmentId)
        }
        
        const response = await fetch(`/api/sales?${params.toString()}`)
        if (!response.ok) throw new Error("Failed to fetch sales data")
        
        const salesData: SaleData[] = await response.json()
        
        // Generate intervals based on the type
        const intervals = generateIntervals(startDate, endDate, intervalType, TOTAL_INTERVALS)
        
        // Map sales to intervals
        const data = intervals.map(interval => {
          const { startDate: intervalStart, endDate: intervalEnd, name } = interval
          
          // Filter sales for this interval
          const salesInInterval = salesData.filter(sale => {
            const saleDate = new Date(sale.created_at)
            return saleDate >= intervalStart && saleDate <= intervalEnd
          })
          
          // Sum amounts
          const total = salesInInterval.reduce((sum, sale) => 
            sum + parseFloat(sale.amount.toString()), 0)
          
          return {
            name,
            total: salesInInterval.length > 0 ? total : null,
            date: intervalStart
          }
        })
        
        setChartData(data)
      } catch (error) {
        console.error("Error fetching sales data:", error)
        // Fallback to empty data
        setChartData([])
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchSalesData()
  }, [startDate, endDate, currentSite, segmentId])

  // Calculate intervals based on date range and type
  const generateIntervals = (
    start: Date, 
    end: Date, 
    intervalType: 'day' | 'week' | 'month' | 'quarter' | 'year',
    count: number
  ) => {
    const intervals = []
    
      if (intervalType === 'day') {
      // For days, center around the selected range
      const centerDay = new Date((start.getTime() + end.getTime()) / 2)
      const startInterval = addDays(centerDay, -Math.floor(count / 2))
        
      for (let i = 0; i < count; i++) {
        const intervalStart = addDays(startInterval, i)
        const intervalEnd = endOfDay(intervalStart)
        const rangeEnd = addDays(intervalStart, 1)
        const name = `${format(intervalStart, 'd')}-${format(rangeEnd, 'd')} ${format(intervalStart, 'MMM')}`
        
        intervals.push({
          startDate: intervalStart,
          endDate: intervalEnd,
          name
          })
        }
      } else if (intervalType === 'week') {
      // For weeks, center around the selected range
      const centerDay = new Date((start.getTime() + end.getTime()) / 2)
      const startInterval = addDays(centerDay, -Math.floor(count / 2) * 7)
        
      for (let i = 0; i < count; i++) {
        const intervalStart = addDays(startInterval, i * 7)
        const intervalEnd = endOfDay(addDays(intervalStart, 6))
        const rangeEnd = addDays(intervalStart, 6)
        const name = `${format(intervalStart, 'd')}-${format(rangeEnd, 'd')} ${format(intervalStart, 'MMM')}`
        
        intervals.push({
          startDate: intervalStart,
          endDate: intervalEnd,
          name
          })
        }
      } else if (intervalType === 'month') {
      // For months, show consecutive months
        let startInterval: Date
        
      if (isSameYear(start, end)) {
        // If both dates are in same year, show all months of that year
        startInterval = startOfYear(start)
        } else {
          // Otherwise, center around the selected range
        const centerMonth = new Date((start.getTime() + end.getTime()) / 2)
        startInterval = startOfMonth(subMonths(centerMonth, Math.floor(count / 2)))
        }
        
      for (let i = 0; i < count; i++) {
        const intervalStart = addMonths(startInterval, i)
        const intervalEnd = endOfMonth(intervalStart)
        const name = `${format(intervalStart, 'MMM')} ${format(intervalStart, 'yyyy')}`
        
        intervals.push({
          startDate: intervalStart,
          endDate: intervalEnd,
          name
          })
        }
      } else {
      // For quarters, show consecutive quarters
      const centerQuarter = new Date((start.getTime() + end.getTime()) / 2)
      const startInterval = startOfQuarter(subQuarters(centerQuarter, Math.floor(count / 2)))
        
      for (let i = 0; i < count; i++) {
        const intervalStart = addQuarters(startInterval, i)
        const intervalEnd = endOfQuarter(intervalStart)
        const name = `Q${Math.floor(intervalStart.getMonth() / 3) + 1} ${format(intervalStart, 'yyyy')}`
        
        intervals.push({
          startDate: intervalStart,
          endDate: intervalEnd,
          name
          })
        }
      }
      
    return intervals
  }

  // Encuentra el valor máximo para calcular las alturas relativas
  const maxValue = Math.max(...chartData.map(item => item.total || 0))
  
  // Formato de números para mostrar de forma legible
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES').format(num)
  }

  if (isLoading) {
    return (
      <div className="w-full h-[350px] flex flex-col pl-4 overflow-hidden">
        {/* Esqueleto para el eje Y con valores */}
        <div className="flex flex-1 relative">
          <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
            ))}
          </div>

          {/* Líneas de guía horizontales */}
          <div className="absolute left-14 right-4 top-0 bottom-0 flex flex-col justify-between pointer-events-none">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="border-t w-full h-0 border-slate-200 dark:border-slate-700"></div>
            ))}
          </div>

          {/* Esqueleto para las barras */}
          <div className="w-full ml-14 pr-4 h-full flex items-end space-x-1">
            {Array(12).fill(0).map((_, index) => (
              <div 
                key={index}
                className="flex-1 flex flex-col items-center justify-end h-full relative px-1"
              >
                <div 
                  className="w-full bg-slate-200 dark:bg-slate-700 rounded-t-sm animate-pulse"
                  style={{ 
                    height: `${Math.max(5, Math.random() * 70)}%`,
                    animationDelay: `${index * 0.05}s`
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Esqueleto para el eje X con etiquetas */}
        <div className="h-8 flex ml-14 pr-4 mt-2">
          {Array(12).fill(0).map((_, index) => (
            <div key={index} className="flex-1 flex justify-center">
              <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-[350px] flex flex-col pl-4">
      {/* Agregar ejes Y con valores */}
      <div className="flex flex-1 relative">
        {/* Eje Y con valores */}
        <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between py-4">
          <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>{formatNumber(maxValue)}</div>
          <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>{formatNumber(Math.round(maxValue * 0.75))}</div>
          <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>{formatNumber(Math.round(maxValue * 0.5))}</div>
          <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>{formatNumber(Math.round(maxValue * 0.25))}</div>
          <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>0</div>
        </div>

        {/* Líneas de guía horizontales */}
        <div className="absolute left-14 right-4 top-0 bottom-0 flex flex-col justify-between pointer-events-none">
          <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
          <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
          <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
          <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
          <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
        </div>

        {/* Contenedor de barras */}
        <div className="w-full ml-14 pr-4 h-full flex items-end space-x-1">
          {chartData.map((item, index) => {
            // Calculamos la altura relativa basada en el valor máximo
            const hasData = item.total !== null
            const height = hasData ? Math.max(5, ((item.total || 0) / maxValue) * 100) : 0
            
            return (
              <div 
                key={index} 
                className="flex-1 flex flex-col items-center justify-end h-full group relative px-1"
              >
                {/* Tooltip mejorado adaptado al tema */}
                {hasData && (
                  <div 
                    className={`
                      absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 
                      transition-opacity duration-200 rounded-md shadow-md p-2 
                      text-sm z-10 whitespace-nowrap translate-x-[-50%] left-1/2
                      ${isDarkMode ? 
                        "bg-slate-800 border border-slate-600" : 
                        "bg-white border border-gray-200"}
                    `}
                    style={{ 
                      boxShadow: isDarkMode 
                        ? '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.3)' 
                        : '0 1px 3px 0 rgba(0, 0, 0, 0.1)' 
                    }}
                  >
                    <p className={`font-semibold ${isDarkMode ? "text-slate-100" : "text-gray-900"}`}>{item.name}</p>
                    <p className={isDarkMode ? "text-indigo-300" : "text-indigo-600"}>
                      <span className="font-medium">Total:</span> {formatNumber(item.total || 0)}
                    </p>
                  </div>
                )}
                
                {/* Barra con animación al cargar */}
                {hasData ? (
                  <div 
                    className={`
                      w-full transition-all rounded-t-sm origin-bottom
                      ${isDarkMode ? "bg-indigo-400 hover:bg-indigo-300" : "bg-indigo-500 hover:bg-indigo-600"}
                    `}
                    style={{ 
                      height: `${height}%`,
                      animation: `growUp 1s ease-out forwards`,
                      animationDelay: `${index * 0.05}s`
                    }}
                  />
                ) : (
                  // Empty placeholder for no data
                  <div className="w-full h-0 border-t border-dashed border-slate-300 dark:border-slate-600 mt-[1px]" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Eje X con etiquetas de intervalo */}
      <div className="h-8 flex ml-14 pr-4 mt-2">
        {chartData.map((item, index) => (
          <div key={index} className={`flex-1 text-center text-xs font-medium ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
            {item.name}
          </div>
        ))}
      </div>

      {/* Estilos para animación */}
      <style jsx>{`
        @keyframes growUp {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
} 