"use client"

import React, { useEffect, useState } from "react"
import { useTheme } from "@/app/context/ThemeContext"
import { useSite } from "@/app/context/SiteContext"
import { useWidgetContext } from "@/app/context/WidgetContext"
import { 
  differenceInDays, differenceInMonths, format, 
  addDays, addMonths, addQuarters, addYears,
  startOfDay, startOfMonth, startOfQuarter, startOfYear, 
  endOfMonth, endOfQuarter, endOfYear, endOfDay,
  isSameYear, isBefore, 
  subMonths, subYears, subQuarters, subDays
} from "date-fns"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { BarChart } from "@/app/components/ui/icons"

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

export function Overview({ startDate: propStartDate, endDate: propEndDate, segmentId = "all" }: { startDate?: Date, endDate?: Date, segmentId?: string }) {
  const { isDarkMode } = useTheme()
  const { currentSite } = useSite()
  const { shouldExecuteWidgets } = useWidgetContext()
  const [chartData, setChartData] = useState<ChartDataItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30))
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date())
  
  // Update local state when props change
  useEffect(() => {
    if (propStartDate) {
      setStartDate(propStartDate);
    }
    if (propEndDate) {
      setEndDate(propEndDate);
    }
  }, [propStartDate, propEndDate]);
  
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    
    const fetchSalesData = async () => {
      // Global widget protection
      if (!shouldExecuteWidgets) {
        console.log("[Overview] Widget execution disabled by context");
        return;
      }

      if (!currentSite || currentSite.id === "default") return;
      
      // Always start with loading state
      if (isMounted) {
        setIsLoading(true)
      }
      
      try {
        // Ensure we're using valid dates - defensive measure
        const now = new Date();
        const currentYear = now.getFullYear();
        
        // Create safe copies of dates
        let safeStartDate = new Date(startDate);
        let safeEndDate = new Date(endDate);
        
        // Validate and fix dates if needed
        if (safeStartDate.getFullYear() > currentYear) {
          console.warn(`[Overview] Future year in startDate: ${safeStartDate.toISOString()}`);
          safeStartDate.setFullYear(currentYear - 1);
        }
        
        if (safeEndDate.getFullYear() > currentYear) {
          console.warn(`[Overview] Future year in endDate: ${safeEndDate.toISOString()}`);
          safeEndDate = now;
        }
        
        if (safeStartDate > now) {
          console.warn(`[Overview] Future startDate: ${safeStartDate.toISOString()}`);
          safeStartDate = new Date(now);
          safeStartDate.setMonth(now.getMonth() - 1);
        }
        
        if (safeEndDate > now) {
          console.warn(`[Overview] Future endDate: ${safeEndDate.toISOString()}`);
          safeEndDate = now;
        }

        // Determine the interval type based on the date range
        const daysDiff = differenceInDays(safeEndDate, safeStartDate)
        const monthsDiff = differenceInMonths(safeEndDate, safeStartDate)
        
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
        params.append("startDate", safeStartDate.toISOString())
        params.append("endDate", safeEndDate.toISOString())
        if (segmentId && segmentId !== "all") {
          params.append("segmentId", segmentId)
        }
        
        console.log("[Overview] Fetching sales data with params:", Object.fromEntries(params.entries()));
        
        // Use standard fetch instead of fetchWithController
        const response = await fetch(`/api/sales?${params.toString()}`, {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        // Check if component unmounted
        if (!isMounted) {
          console.log("[Overview] Component unmounted, ignoring response");
          return;
        }
        
        if (!response.ok) {
          console.error(`[Overview] API response not OK: ${response.status} ${response.statusText}`);
          throw new Error(`Failed to fetch sales data: ${response.status} ${response.statusText}`);
        }
        
        const responseJson = await response.json();
        
        // Handle new API response format
        let salesData: SaleData[];
        
        // Check if the response has the new format with a data field and debug info
        if (responseJson.data && Array.isArray(responseJson.data)) {
          console.log(`[Overview] Received ${responseJson.data.length} sales records`);
          console.log(`[Overview] Debug info from API:`, responseJson.debug);
          salesData = responseJson.data;
        } else if (Array.isArray(responseJson)) {
          // Handle old format for backward compatibility
          console.log(`[Overview] Received ${responseJson.length} sales records (old format)`);
          salesData = responseJson;
        } else {
          console.error(`[Overview] Unexpected API response format:`, responseJson);
          salesData = [];
        }
        
        // If component unmounted during fetch, don't continue
        if (!isMounted) return;
        
        // Log first few sales for debugging
        if (salesData.length > 0) {
          console.log(`[Overview] First 3 sales:`, salesData.slice(0, 3));
        } else {
          console.log(`[Overview] No sales data returned for the period`);
        }
        
        // Generate intervals based on the type
        console.log(`[Overview] Generating ${TOTAL_INTERVALS} intervals of type '${intervalType}'`);
        const intervals = generateIntervals(safeStartDate, safeEndDate, intervalType, TOTAL_INTERVALS);
        console.log(`[Overview] Generated intervals:`, intervals.map(i => ({
          name: i.name,
          startDate: format(i.startDate, 'yyyy-MM-dd'),
          endDate: format(i.endDate, 'yyyy-MM-dd')
        })));
        
        // Map sales to intervals
        const data = intervals.map(interval => {
          const { startDate: intervalStart, endDate: intervalEnd, name } = interval;
          
          // Filter sales for this interval
          const salesInInterval = salesData.filter(sale => {
            const saleDate = new Date(sale.created_at);
            return saleDate >= intervalStart && saleDate <= intervalEnd;
          });
          
          // Log for debugging
          if (salesInInterval.length > 0) {
            console.log(`[Overview] Interval '${name}' has ${salesInInterval.length} sales`);
          }
          
          // Sum amounts
          const total = salesInInterval.reduce((sum, sale) => 
            sum + parseFloat(sale.amount.toString()), 0);
          
          return {
            name,
            total: salesInInterval.length > 0 ? total : null,
            date: intervalStart
          };
        });
        
        // Log overview of chart data
        console.log(`[Overview] Generated chart data:`, data.map(item => ({
          name: item.name,
          total: item.total
        })));
        
        if (isMounted) {
          setChartData(data);
          console.log(`[Overview] Chart data set with ${data.length} intervals`);
        }
      } catch (error) {
        // Ignore AbortError as it's expected during cleanup
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log("[Overview] Request was aborted");
          return;
        }
        
        console.error("Error fetching sales data:", error)
        // Fallback to empty data
        if (isMounted) {
          setChartData([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }
    
    fetchSalesData()
    
    // Cleanup function
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [shouldExecuteWidgets, propStartDate, propEndDate, segmentId, currentSite]);

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

  // Check if there's no data or all values are null
  const hasData = chartData.length > 0 && chartData.some(item => item.total !== null);
  
  if (!hasData) {
    return (
      <div className="w-full h-[350px] flex items-center justify-center">
        <EmptyCard
          icon={<BarChart className="h-8 w-8 text-muted-foreground" />}
          title="No data available"
          description="There is no sales data available for the selected period."
          showShadow={false}
          contentClassName="py-12"
        />
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

        {/* Definiciones de gradientes para barras */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isDarkMode ? "#818cf8" : "#6366f1"} /> {/* indigo-400 o indigo-500 */}
              <stop offset="100%" stopColor={isDarkMode ? "#6366f1" : "#4f46e5"} /> {/* indigo-500 o indigo-600 */}
            </linearGradient>
            <linearGradient id="barGradientHover" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isDarkMode ? "#a5b4fc" : "#818cf8"} /> {/* indigo-300 o indigo-400 */}
              <stop offset="100%" stopColor={isDarkMode ? "#818cf8" : "#6366f1"} /> {/* indigo-400 o indigo-500 */}
            </linearGradient>
          </defs>
        </svg>

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
                
                {/* Barra con animación al cargar y gradiente */}
                {hasData ? (
                  <div 
                    className="w-full transition-all rounded-t-sm origin-bottom group-hover:scale-x-105"
                    style={{ 
                      height: `${height}%`,
                      animation: `growUp 1s ease-out forwards`,
                      animationDelay: `${index * 0.05}s`,
                      background: isDarkMode 
                        ? "linear-gradient(to bottom, #818cf8, #6366f1)" 
                        : "linear-gradient(to bottom, #6366f1, #4f46e5)",
                      boxShadow: 'rgba(0, 0, 0, 0.05) 0px 1px 2px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = isDarkMode 
                        ? "linear-gradient(to bottom, #a5b4fc, #818cf8)" 
                        : "linear-gradient(to bottom, #818cf8, #6366f1)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = isDarkMode 
                        ? "linear-gradient(to bottom, #818cf8, #6366f1)" 
                        : "linear-gradient(to bottom, #6366f1, #4f46e5)";
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