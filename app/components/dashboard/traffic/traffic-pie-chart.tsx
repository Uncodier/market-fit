"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";
import { useWidgetContext } from "@/app/context/WidgetContext";
import { useRequestController } from "@/app/hooks/useRequestController";
import { useTheme } from "@/app/context/ThemeContext";
import { PieChart } from "@/app/components/ui/icons";
import { EmptyCard } from "@/app/components/ui/empty-card";

interface DataItem {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface TrafficPieChartProps {
  endpoint: string;
  title?: string;
  emptyText?: string;
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
  showTotal?: boolean;
  onTotalUpdate?: (total: string) => void;
  preloadedData?: any[];
  isLoading?: boolean;
  error?: string | null;
  skipApiCall?: boolean;
}

export function TrafficPieChart({
  endpoint,
  title,
  emptyText = "No data available",
  segmentId = "all",
  startDate,
  endDate,
  showTotal = false,
  onTotalUpdate,
  preloadedData,
  isLoading: propIsLoading,
  error: propError,
  skipApiCall = false
}: TrafficPieChartProps) {
  const { isDarkMode } = useTheme();
  const { currentSite } = useSite();
  const { user } = useAuth();
  const { shouldExecuteWidgets } = useWidgetContext();
  const { fetchWithController } = useRequestController();
  const [data, setData] = useState<DataItem[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [internalIsLoading, setInternalIsLoading] = useState(true);
  const [internalHasError, setInternalHasError] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Use preloaded data if available, otherwise use internal state
  const isLoading = propIsLoading !== undefined ? propIsLoading : internalIsLoading;
  const hasError = propError !== undefined ? !!propError : internalHasError;

  // SVG dimensions
  const size = 280;
  const center = size / 2;
  const radius = 80;
  const innerRadius = 48;

  // Theme-adaptive color palette
  const colors = isDarkMode ? [
    "#818CF8", "#A5B4FC", "#C7D2FE", "#DDD6FE", "#F5D0FE",
    "#FBCFE8", "#FDE68A", "#FCD34D", "#A78BFA", "#60A5FA"
  ] : [
    "#6366F1", "#8B5CF6", "#EC4899", "#F97316", "#14B8A6",
    "#06B6D4", "#84CC16", "#F59E0B", "#EF4444", "#3B82F6"
  ];

  // Process preloaded data
  useEffect(() => {
    if (preloadedData !== undefined) {
      console.log(`[TrafficPieChart:${endpoint}] Using preloaded data, skipping API call:`, preloadedData);
      
      if (Array.isArray(preloadedData) && preloadedData.length > 0) {
        // Calculate total for percentage calculation
        const total = preloadedData.reduce((sum: number, item: any) => sum + item.value, 0);
        setTotalValue(total);

        // Process data with colors and percentages
        const processedData = preloadedData.map((item: any, index: number) => ({
          name: item.name,
          value: item.value,
          percentage: total > 0 ? (item.value / total) * 100 : 0,
          color: colors[index % colors.length]
        }));

        setData(processedData);
        
        if (onTotalUpdate) {
          onTotalUpdate(total.toLocaleString());
        }
      } else {
        setData([]);
        setTotalValue(0);
        if (onTotalUpdate) {
          onTotalUpdate("0");
        }
      }
      
      setInternalIsLoading(false);
      setInternalHasError(false);
      return;
    }
  }, [preloadedData, endpoint, onTotalUpdate, colors]);

  // Fetch data (only if no preloaded data provided AND skipApiCall is false)
  useEffect(() => {
    // Skip if preloaded data is provided OR skipApiCall is true
    if (preloadedData !== undefined || skipApiCall) {
      console.log(`[TrafficPieChart:${endpoint}] Skipping API call - preloadedData: ${preloadedData !== undefined}, skipApiCall: ${skipApiCall}`);
      return;
    }

    const fetchData = async () => {
      // Global widget protection
      if (!shouldExecuteWidgets) {
        console.log(`[TrafficPieChart:${endpoint}] Widget execution disabled by context`);
        return;
      }

      if (!currentSite || currentSite.id === "default" || !startDate || !endDate) {
        setInternalIsLoading(false);
        return;
      }

      setInternalIsLoading(true);
      setInternalHasError(false);

      try {
        const start = startDate ? format(startDate, "yyyy-MM-dd") : null;
        const end = endDate ? format(endDate, "yyyy-MM-dd") : null;

        const params = new URLSearchParams();
        params.append("siteId", currentSite.id);
        if (user?.id) {
          params.append("userId", user.id);
        }
        if (start) params.append("startDate", start);
        if (end) params.append("endDate", end);
        if (segmentId && segmentId !== "all") {
          params.append("segmentId", segmentId);
        }

        console.log(`[TrafficPieChart:${endpoint}] Making INDIVIDUAL API call (should not happen if batched correctly):`, params.toString());
        const response = await fetchWithController(`/api/traffic/${endpoint}?${params.toString()}`);

        // Handle null response (aborted request)
        if (response === null) {
          console.log(`[TrafficPieChart:${endpoint}] Request was aborted`);
          return;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Error ${response.status}: ${errorText}`);
        }

        const responseData = await response.json();
        console.log(`[TrafficPieChart:${endpoint}] Received data:`, responseData);

        if (responseData.data && Array.isArray(responseData.data)) {
          // Calculate total for percentage calculation
          const total = responseData.data.reduce((sum: number, item: any) => sum + item.value, 0);
          setTotalValue(total);

          // Process data with colors and percentages
          const processedData = responseData.data.map((item: any, index: number) => ({
            name: item.name,
            value: item.value,
            percentage: total > 0 ? (item.value / total) * 100 : 0,
            color: colors[index % colors.length]
          }));

          setData(processedData);
          
          if (onTotalUpdate) {
            onTotalUpdate(total.toLocaleString());
          }
        } else {
          setData([]);
          setTotalValue(0);
          if (onTotalUpdate) {
            onTotalUpdate("0");
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error(`[TrafficPieChart:${endpoint}] Error fetching data:`, error);
        }
        setInternalHasError(true);
      } finally {
        setInternalIsLoading(false);
      }
    };

    console.log(`[TrafficPieChart:${endpoint}] WARNING: Making individual API call - this should not happen if batching works correctly`);
    fetchData();
  }, [shouldExecuteWidgets, currentSite, user, startDate, endDate, segmentId, endpoint, fetchWithController, onTotalUpdate, preloadedData, skipApiCall]);

  // Calculate angles for pie slices
  const createPieSlice = (item: DataItem, index: number, startAngle: number, endAngle: number) => {
    const x1 = center + radius * Math.cos((startAngle * Math.PI) / 180);
    const y1 = center + radius * Math.sin((startAngle * Math.PI) / 180);
    const x2 = center + radius * Math.cos((endAngle * Math.PI) / 180);
    const y2 = center + radius * Math.sin((endAngle * Math.PI) / 180);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    const pathData = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');

    return (
      <path
        key={index}
        d={pathData}
        fill={`url(#trafficPieGradient-${index})`}
        stroke={isDarkMode ? '#1E293B' : '#fff'}
        strokeWidth="2"
        className="transition-all duration-300 hover:brightness-110 cursor-pointer pie-slice-animate"
        style={{ 
          animationDelay: `${index * 0.05}s`,
          transformOrigin: `${center}px ${center}px`
        }}
        onMouseEnter={() => setHoveredIndex(index)}
        onMouseLeave={() => setHoveredIndex(null)}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[200px] animate-pulse">
        <div className="h-32 w-32 rounded-full bg-gray-200 dark:bg-gray-700"></div>
      </div>
    );
  }

  if (hasError || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <EmptyCard 
          icon={<PieChart className="h-6 w-6 text-muted-foreground" />}
          title="No data"
          description={emptyText}
          variant="fancy"
          showShadow={false}
          contentClassName="py-6"
        />
      </div>
    );
  }

  let currentAngle = -90; // Start from top

  return (
    <div className="w-full h-64 relative pie-chart-container">
      <svg width={size} height={size} className="mx-auto">
        {/* Gradient definitions */}
        <defs>
          {data.map((item, index) => {
            const baseColor = item.color;
            // Extract RGB components from hex color
            const r = parseInt(baseColor.slice(1, 3), 16);
            const g = parseInt(baseColor.slice(3, 5), 16);
            const b = parseInt(baseColor.slice(5, 7), 16);
            
            // Create slightly lighter and darker versions for gradient
            const lighterColor = `rgba(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)}, 0.9)`;
            const darkerColor = `rgba(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)}, 1)`;
            
            return (
              <radialGradient
                key={`gradient-${index}`}
                id={`trafficPieGradient-${index}`}
                cx="50%"
                cy="50%"
                r="70%"
                fx="50%"
                fy="50%"
              >
                <stop offset="0%" stopColor={lighterColor} />
                <stop offset="100%" stopColor={darkerColor} />
              </radialGradient>
            );
          })}
        </defs>

        {/* Pie slices */}
        {data.length === 1 ? (
          // Special case for single item - render as full circle
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill={`url(#trafficPieGradient-0)`}
            stroke={isDarkMode ? '#1E293B' : '#fff'}
            strokeWidth="2"
            className="transition-all duration-300 hover:brightness-110 cursor-pointer pie-slice-animate"
            style={{ 
              animationDelay: '0s',
              transformOrigin: `${center}px ${center}px`
            }}
            onMouseEnter={() => setHoveredIndex(0)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ) : (
          // Multiple items - render as pie slices
          data.map((item, index) => {
            const sliceAngle = (item.percentage / 100) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + sliceAngle;
            const slice = createPieSlice(item, index, startAngle, endAngle);
            currentAngle += sliceAngle;
            return slice;
          })
        )}
        
        {/* Center circle for donut effect */}
        <circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill={isDarkMode ? '#1E293B' : '#fff'}
          stroke={isDarkMode ? '#1E293B' : '#fff'}
          strokeWidth="2"
          className="pie-center-animate"
        />
        
        {/* Center text */}
        {showTotal && (
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dy="0.35em"
            className={`text-sm font-semibold pie-text-animate ${isDarkMode ? 'fill-slate-200' : 'fill-gray-700'}`}
          >
            {totalValue.toLocaleString()}
          </text>
        )}
        
        {/* Center percentage for single item */}
        {data.length === 1 && (
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dy="0.35em"
            className={`text-lg font-bold pie-text-animate ${isDarkMode ? 'fill-slate-200' : 'fill-gray-700'}`}
          >
            100%
          </text>
        )}
      </svg>
      
      {/* Legend */}
      <div className="absolute top-0 right-0 max-w-[120px] space-y-1">
        {data.slice(0, 5).map((item, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 text-xs cursor-pointer transition-all duration-300 pie-legend-animate ${
              hoveredIndex === index ? 'opacity-100 scale-105' : 'opacity-70'
            }`}
            style={{ animationDelay: `${index * 0.05 + 0.1}s` }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1 min-w-0">
              <div className={`font-medium truncate ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`} title={item.name}>
                {item.name}
              </div>
              <div className={isDarkMode ? 'text-slate-400' : 'text-gray-500'}>
                {item.percentage.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
        {data.length > 5 && (
          <div className={`text-xs pl-4 pie-legend-animate ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}
               style={{ animationDelay: `${Math.min(5, data.length) * 0.05 + 0.1}s` }}>
            +{data.length - 5} more
          </div>
        )}
      </div>
      
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pie-slice-enter {
          from {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          to {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        
        @keyframes pie-center-enter {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes pie-text-enter {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pie-legend-enter {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .pie-slice-animate {
          animation: pie-slice-enter 0.6s ease-out forwards;
          opacity: 0;
        }
        
        .pie-center-animate {
          animation: pie-center-enter 0.4s ease-out 0.1s forwards;
          opacity: 0;
        }
        
        .pie-text-animate {
          animation: pie-text-enter 0.5s ease-out 0.2s forwards;
          opacity: 0;
        }
        
        .pie-legend-animate {
          animation: pie-legend-enter 0.4s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
} 