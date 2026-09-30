"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useTheme } from "@/app/context/ThemeContext";
import { usePerformanceSlice } from "@/app/hooks/use-dashboard-batches";
import { ReportChartLoading } from "./report-visual-loading";
import { ReportState } from "./report-state";
import { activityDate, compactActivityCount } from "./activity-chart-format";

interface LeadsTasksChartProps {
  startDate: Date;
  endDate: Date;
  segmentId?: string;
}

interface ChartDataPoint {
  date: string;
  leadsCreated: number;
  tasks: number;
}

interface MetricsData {
  chartData: ChartDataPoint[];
}

export function LeadsTasksChart({ startDate, endDate, segmentId = "all" }: LeadsTasksChartProps) {
  const { data, isLoading } = usePerformanceSlice<MetricsData>(
    "metrics-overview",
    startDate,
    endDate,
    segmentId
  );
  const { isDarkMode } = useTheme();

  const colors = {
    text: isDarkMode ? "#CBD5E1" : "#6B7280",
    grid: isDarkMode ? "rgba(203, 213, 225, 0.2)" : "#f0f0f0",
    tooltipBackground: isDarkMode ? "#1E293B" : "white",
    tooltipBorder: isDarkMode ? "#475569" : "#e5e7eb",
    tooltipText: isDarkMode ? "#F8FAFC" : "#111827",
    leads: isDarkMode ? "#0EA5E9" : "#0284C7",
    tasks: isDarkMode ? "#F59E0B" : "#D97706",
  };

  if (isLoading) {
    return <ReportChartLoading />;
  }

  if (!data || !data.chartData || data.chartData.length === 0) {
    return <ReportState state="empty" message="No lead or task activity was recorded for these filters. Try another date range or segment." />;
  }

  return (
    <div role="img" aria-label="Daily leads created and task counts" className="h-[300px] w-full min-w-0 sm:h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.leads} stopOpacity={0.25} />
              <stop offset="95%" stopColor={colors.leads} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.tasks} stopOpacity={0.25} />
              <stop offset="95%" stopColor={colors.tasks} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} opacity={isDarkMode ? 0.6 : 1} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: colors.text }}
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
              name === 'leadsCreated' ? 'Leads' : name === 'tasks' ? 'Tasks' : name
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
          <Legend wrapperStyle={{ paddingTop: '16px', fontSize: 12, color: colors.text }} iconType="circle" />
          <Area type="linear" dataKey="leadsCreated" stroke={colors.leads} strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)"
            dot={data.chartData.length <= 14 ? { r: 3, strokeWidth: 0 } : false} connectNulls={false} isAnimationActive={false} activeDot={{ r: 5, strokeWidth: 0 }} name="Leads" />
          <Area type="linear" dataKey="tasks" stroke={colors.tasks} strokeWidth={2} fillOpacity={1} fill="url(#colorTasks)"
            dot={data.chartData.length <= 14 ? { r: 3, strokeWidth: 0 } : false} connectNulls={false} isAnimationActive={false} activeDot={{ r: 5, strokeWidth: 0 }} name="Tasks" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}


