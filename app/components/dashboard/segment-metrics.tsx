import * as React from "react"
import { useTheme } from "@/app/context/ThemeContext"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { format } from "date-fns"
import { useState } from "react"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { BarChart } from "@/app/components/ui/icons"

interface SegmentMetricsProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface SegmentData {
  name: string
  value: number
  delta: number
  color: string
}

const baseColors = [
  "#6366f1", // Indigo
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#10b981", // Emerald
  "#ef4444", // Red
  "#3b82f6", // Blue
]

// Versiones más claras para modo oscuro
const lightVariants = [
  "#818CF8", // Indigo-400
  "#F472B6", // Pink-400
  "#2DD4BF", // Teal-400
  "#FBBF24", // Amber-400
  "#A78BFA", // Purple-400
  "#34D399", // Emerald-400
  "#F87171", // Red-400
  "#60A5FA", // Blue-400
]

export function SegmentMetrics({ segmentId = "all", startDate, endDate }: SegmentMetricsProps) {
  const { isDarkMode } = useTheme()
  const { currentSite } = useSite()
  const { user } = useAuth()
  const [segments, setSegments] = useState<SegmentData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  
  // Fetch segment metrics data
  React.useEffect(() => {
    const fetchSegmentMetrics = async () => {
      if (!currentSite || currentSite.id === "default" || !startDate || !endDate) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setHasError(false);
      
      try {
        const params = new URLSearchParams();
        params.append("siteId", currentSite.id);
        if (user?.id) {
          params.append("userId", user.id);
        }
        params.append("startDate", format(startDate, "yyyy-MM-dd"));
        params.append("endDate", format(endDate, "yyyy-MM-dd"));
        if (segmentId && segmentId !== "all") {
          params.append("segmentId", segmentId);
        }
        
        console.log(`[SegmentMetrics] Fetching data with params:`, Object.fromEntries(params.entries()));
        
        const response = await fetch(`/api/segments/metrics?${params.toString()}`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[SegmentMetrics] API error ${response.status}: ${errorText}`);
          throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`[SegmentMetrics] Received data:`, data);
        
        if (!data.segments || !Array.isArray(data.segments) || data.segments.length === 0) {
          console.error("[SegmentMetrics] No segment data found in response");
          setHasError(true);
          setSegments([]);
          return;
        }
        
        // Map API data to component format
        const segmentData = data.segments.map((segment: any, index: number) => ({
          name: segment.name,
          value: segment.value,
          delta: segment.delta,
          color: baseColors[index % baseColors.length]
        }));
        
        setSegments(segmentData);
      } catch (error) {
        console.error("Error fetching segment metrics:", error);
        setHasError(true);
        setSegments([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSegmentMetrics();
  }, [segmentId, startDate, endDate, currentSite, user]);
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center p-3 rounded-lg animate-pulse">
            <div className="w-full pr-4">
              <div className="flex justify-between mb-1.5">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-full"></div>
            </div>
            <div className="ml-2 min-w-16 flex items-center justify-end">
              <div className="h-6 w-14 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  if (hasError || segments.length === 0) {
    return (
      <EmptyCard 
        icon={<BarChart className="h-8 w-8 text-muted-foreground" />}
        title="No segment data available"
        description="There is no segment data available for the selected period."
      />
    );
  }
  
  return (
    <div className="space-y-6">
      {segments.map((segment, index) => (
        <div className="flex items-center p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors" key={segment.name}>
          <div className="w-full pr-4">
            <div className="flex justify-between mb-1.5">
              <p className="text-sm font-medium leading-none">{segment.name}</p>
              <p className="text-sm font-medium">{segment.value}%</p>
            </div>
            <div className={`h-3 w-full rounded-full ${isDarkMode ? "bg-slate-700/50" : "bg-muted"}`}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${segment.value}%`,
                  backgroundColor: isDarkMode ? lightVariants[index % lightVariants.length] : segment.color
                }}
              />
            </div>
          </div>
          <div className="ml-2 min-w-16 flex items-center justify-end">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
              segment.delta > 0 
                ? (isDarkMode ? "bg-green-950/40 text-green-400" : "bg-green-50 text-green-600") 
                : (isDarkMode ? "bg-red-950/40 text-red-400" : "bg-red-50 text-red-600")
            }`}>
              {segment.delta > 0 ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m18 15-6-6-6 6"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              )}
              <span>{Math.abs(segment.delta)}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 