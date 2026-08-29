"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useTheme } from "@/app/context/ThemeContext";
import { Skeleton } from "@/app/components/ui/skeleton";
import { usePerformanceSlice } from "@/app/hooks/use-dashboard-batches";

interface TokenUsageChartProps {
  startDate: Date;
  endDate: Date;
  segmentId?: string;
}

interface ChartDataPoint {
  date: string;
  commands: number;
  instanceLogs: number;
  inputTokens: number;
  outputTokens: number;
}

interface TokensData {
  chartData: ChartDataPoint[];
  breakdown: {
    commands: number;
    instanceLogs: number;
  };
}

export function TokenUsageChart({ 
  startDate, 
  endDate, 
  segmentId = "all" 
}: TokenUsageChartProps) {
  const { data, isLoading } = usePerformanceSlice<TokensData>(
    "tokens",
    startDate,
    endDate,
    segmentId
  );
  const { isDarkMode } = useTheme();

  // Colors for the chart
  const colors = {
    text: isDarkMode ? "#CBD5E1" : "#9CA3AF",
    grid: isDarkMode ? "rgba(203, 213, 225, 0.2)" : "#f0f0f0",
    tooltipBackground: isDarkMode ? "#1E293B" : "white",
    tooltipBorder: isDarkMode ? "#475569" : "#e5e7eb",
    tooltipText: isDarkMode ? "#F8FAFC" : "#111827",
    inputLine: isDarkMode ? "#3B82F6" : "#2563EB",
    outputLine: isDarkMode ? "#10B981" : "#059669",
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
        <p className="text-muted-foreground">No token usage data available</p>
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
              name === 'inputTokens' ? 'Input Tokens' : 'Output Tokens'
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
            dataKey="inputTokens" 
            stroke={colors.inputLine}
            strokeWidth={2}
            dot={{ fill: colors.inputLine, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: colors.inputLine, strokeWidth: 2 }}
            name="Input Tokens"
            animationDuration={1500}
            animationEasing="ease-out"
          />
          <Line 
            type="monotone"
            dataKey="outputTokens" 
            stroke={colors.outputLine}
            strokeWidth={2}
            dot={{ fill: colors.outputLine, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: colors.outputLine, strokeWidth: 2 }}
            name="Output Tokens"
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
