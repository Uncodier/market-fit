"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useTheme } from "@/app/context/ThemeContext";
import { usePerformanceSlice } from "@/app/hooks/use-dashboard-batches";
import { ReportChartLoading } from "./report-visual-loading";
import { ReportState } from "./report-state";
import { activityDate, compactActivityCount } from "./activity-chart-format";

interface PerformanceMetricsChartProps {
  startDate: Date;
  endDate: Date;
  segmentId?: string;
  showConversations?: boolean;
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
  segmentId = "all",
  showConversations = false
}: PerformanceMetricsChartProps) {
  const { data, isLoading } = usePerformanceSlice<MetricsData>(
    "metrics-overview",
    startDate,
    endDate,
    segmentId
  );
  const { isDarkMode } = useTheme();

  // Colors for the chart
  const colors = {
    text: isDarkMode ? "#CBD5E1" : "#6B7280",
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
    return <ReportChartLoading />;
  }

  if (!data || !data.chartData || data.chartData.length === 0) {
    return <ReportState state="empty" message="No activity was recorded for these filters. Try another date range or segment." />;
  }

  return (
    <div role="img" aria-label="Daily engagement, meetings and sales counts" className="h-[300px] w-full min-w-0 sm:h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data.chartData}
          margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
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
              tickMargin={10}
              minTickGap={36}
              interval="preserveStartEnd"
              padding={{ left: 8, right: 8 }}
              tickFormatter={(value) => activityDate(value)}
            />
            <YAxis 
              axisLine={false}
              tickLine={false} 
              tick={{ fontSize: 12, fill: colors.text }}
              width={44}
              allowDecimals={false}
              domain={[0, 'auto']}
              tickFormatter={compactActivityCount}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                value.toLocaleString("en-US"),
                name === 'conversations' ? 'Conversations' :
                name === 'engagement' ? 'Engagement' :
                name === 'meetings' ? 'Meetings' :
                name === 'sales' ? 'Sales' : name
              ]}
              labelStyle={{ color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}
              contentStyle={{ 
                backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
              }}
              itemStyle={{ color: isDarkMode ? '#f3f4f6' : '#111827', fontWeight: 600 }}
              labelFormatter={(value) => `${activityDate(String(value), true)} (UTC)`}
            />
            <Legend 
              wrapperStyle={{ 
                paddingTop: '16px',
                fontSize: 12,
                color: colors.text
              }}
              iconType="circle"
            />
            {showConversations && (
              <Line 
                type="linear"
                dataKey="conversations" 
                stroke={colors.conversations}
                strokeWidth={2}
                dot={data.chartData.length <= 14 ? { r: 3, strokeWidth: 0 } : false}
                connectNulls={false}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="Conversations"
                isAnimationActive={false}
              />
            )}
            <Line 
              type="linear"
              dataKey="engagement" 
              stroke={colors.engagement}
              strokeWidth={2}
              dot={data.chartData.length <= 14 ? { r: 3, strokeWidth: 0 } : false}
              connectNulls={false}
              activeDot={{ r: 6, strokeWidth: 0 }}
              name="Engagement"
              isAnimationActive={false}
            />
            <Line 
              type="linear"
              dataKey="meetings" 
              stroke={colors.meetings}
              strokeWidth={2}
              dot={data.chartData.length <= 14 ? { r: 3, strokeWidth: 0 } : false}
              connectNulls={false}
              activeDot={{ r: 6, strokeWidth: 0 }}
              name="Meetings"
              isAnimationActive={false}
            />
            <Line 
              type="linear"
              dataKey="sales" 
              stroke={colors.sales}
              strokeWidth={2}
              dot={data.chartData.length <= 14 ? { r: 3, strokeWidth: 0 } : false}
              connectNulls={false}
              activeDot={{ r: 6, strokeWidth: 0 }}
              name="Sales"
              isAnimationActive={false}
            />
          </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
