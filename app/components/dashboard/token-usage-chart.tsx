"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
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
        <AreaChart
          data={data.chartData}
          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
        >
          <defs>
            <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.inputLine} stopOpacity={0.25} />
              <stop offset="95%" stopColor={colors.inputLine} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.outputLine} stopOpacity={0.25} />
              <stop offset="95%" stopColor={colors.outputLine} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            labelStyle={{ color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}
            contentStyle={{ 
              backgroundColor: isDarkMode ? '#1f2937' : '#fff',
              border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
            }}
            itemStyle={{ color: isDarkMode ? '#f3f4f6' : '#111827', fontWeight: 600 }}
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
            iconType="circle"
          />
          <Area 
            type="monotone"
            dataKey="inputTokens" 
            stroke={colors.inputLine}
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorInput)"
            dot={false}
            activeDot={{ r: 6, strokeWidth: 0 }}
            name="Input Tokens"
            animationDuration={1500}
            animationEasing="ease-out"
          />
          <Area 
            type="monotone"
            dataKey="outputTokens" 
            stroke={colors.outputLine}
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorOutput)"
            dot={false}
            activeDot={{ r: 6, strokeWidth: 0 }}
            name="Output Tokens"
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
