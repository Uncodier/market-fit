"use client";

import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useRequestController } from "@/app/hooks/useRequestController";
import { useAuth } from "@/app/hooks/use-auth";
import { useSite } from "@/app/context/SiteContext";
import { useTheme } from "@/app/context/ThemeContext";
import { Skeleton } from "@/app/components/ui/skeleton";
import { fetchWithRetry } from "@/app/utils/fetch-with-retry";

interface PerformanceMetricsChartProps {
  startDate: Date;
  endDate: Date;
  segmentId?: string;
}

interface ChartDataPoint {
  date: string;
  conversations: number;
  engagement: number;
  // tasks moved to separate chart
  meetings: number;
  sales: number;
}

interface MetricsData {
  chartData: ChartDataPoint[];
  breakdown: {
    conversations: number;
    engagement: number;
    // tasks moved to separate chart
    meetings: number;
    sales: number;
  };
}

export function PerformanceMetricsChart({ 
  startDate, 
  endDate, 
  segmentId = "all" 
}: PerformanceMetricsChartProps) {
  const [data, setData] = useState<MetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { currentSite } = useSite();
  const { fetchWithController } = useRequestController();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      if (!currentSite?.id || !user?.id) return;

      setIsLoading(true);

      const params = new URLSearchParams({
        siteId: currentSite.id,
        userId: user.id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        segmentId: segmentId
      });

      const response = await fetchWithRetry(
        fetchWithController,
        `/api/performance/metrics-overview?${params}`,
        { maxRetries: 3 }
      );

      if (!response) {
        // All retries failed or request was cancelled - show empty state
        setIsLoading(false);
        setData(null);
        return;
      }

      const result = await response.json();
      setData(result);
      setIsLoading(false);
    };

    fetchData();
  }, [currentSite?.id, user?.id, startDate, endDate, segmentId, fetchWithController]);

  // Colors for the chart
  const colors = {
    text: isDarkMode ? "#CBD5E1" : "#9CA3AF",
    grid: isDarkMode ? "rgba(203, 213, 225, 0.2)" : "#f0f0f0",
    tooltipBackground: isDarkMode ? "#1E293B" : "white",
    tooltipBorder: isDarkMode ? "#475569" : "#e5e7eb",
    tooltipText: isDarkMode ? "#F8FAFC" : "#111827",
    conversations: isDarkMode ? "#3B82F6" : "#2563EB",
    engagement: isDarkMode ? "#10B981" : "#059669",
    meetings: isDarkMode ? "#8B5CF6" : "#7C3AED",
    sales: isDarkMode ? "#EF4444" : "#DC2626",
  };

  if (isLoading) {
    return (
      <div className="w-full h-[300px]">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  if (!data || !data.chartData || data.chartData.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center">
        <p className="text-muted-foreground">No performance metrics data available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data.chartData}
          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            vertical={false} 
            stroke={colors.grid} 
            opacity={isDarkMode ? 0.6 : 1}
          />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: colors.text }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false} 
            tick={{ fontSize: 12, fill: colors.text }}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip 
            formatter={(value: number, name: string) => [
              value.toLocaleString(), 
              name === 'conversations' ? 'Conversations' :
              name === 'engagement' ? 'Engagement' :
              name === 'meetings' ? 'Meetings' :
              name === 'sales' ? 'Sales' : name
            ]}
            labelStyle={{ fontWeight: 'bold', color: colors.tooltipText }}
            contentStyle={{ 
              backgroundColor: colors.tooltipBackground, 
              border: `1px solid ${colors.tooltipBorder}`,
              borderRadius: '0.375rem', 
              boxShadow: isDarkMode 
                ? '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.3)' 
                : '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
            }}
            itemStyle={{ color: colors.tooltipText }}
            labelFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              });
            }}
          />
          <Legend 
            wrapperStyle={{ 
              paddingTop: '20px',
              color: colors.text
            }}
          />
          <Line 
            type="monotone"
            dataKey="conversations" 
            stroke={colors.conversations}
            strokeWidth={2}
            dot={{ fill: colors.conversations, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: colors.conversations, strokeWidth: 2 }}
            name="Conversations"
            animationDuration={1500}
            animationEasing="ease-out"
          />
          <Line 
            type="monotone"
            dataKey="engagement" 
            stroke={colors.engagement}
            strokeWidth={2}
            dot={{ fill: colors.engagement, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: colors.engagement, strokeWidth: 2 }}
            name="Engagement"
            animationDuration={1500}
            animationEasing="ease-out"
          />
          <Line 
            type="monotone"
            dataKey="meetings" 
            stroke={colors.meetings}
            strokeWidth={2}
            dot={{ fill: colors.meetings, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: colors.meetings, strokeWidth: 2 }}
            name="Meetings"
            animationDuration={1500}
            animationEasing="ease-out"
          />
          <Line 
            type="monotone"
            dataKey="sales" 
            stroke={colors.sales}
            strokeWidth={2}
            dot={{ fill: colors.sales, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: colors.sales, strokeWidth: 2 }}
            name="Sales"
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
