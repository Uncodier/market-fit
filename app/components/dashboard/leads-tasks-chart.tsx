"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useTheme } from "@/app/context/ThemeContext";
import { Skeleton } from "@/app/components/ui/skeleton";
import { usePerformanceSlice } from "@/app/hooks/use-dashboard-batches";

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
    text: isDarkMode ? "#CBD5E1" : "#9CA3AF",
    grid: isDarkMode ? "rgba(203, 213, 225, 0.2)" : "#f0f0f0",
    tooltipBackground: isDarkMode ? "#1E293B" : "white",
    tooltipBorder: isDarkMode ? "#475569" : "#e5e7eb",
    tooltipText: isDarkMode ? "#F8FAFC" : "#111827",
    leads: isDarkMode ? "#0EA5E9" : "#0284C7",
    tasks: isDarkMode ? "#F59E0B" : "#D97706",
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
        <p className="text-muted-foreground">No leads/tasks data available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} opacity={isDarkMode ? 0.6 : 1} />
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
              name === 'leadsCreated' ? 'Leads' : name === 'tasks' ? 'Tasks' : name
            ]}
            labelStyle={{ fontWeight: 'bold', color: colors.tooltipText }}
            contentStyle={{ backgroundColor: colors.tooltipBackground, border: `1px solid ${colors.tooltipBorder}`, borderRadius: '0.375rem' }}
            itemStyle={{ color: colors.tooltipText }}
            labelFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px', color: colors.text }} />
          <Line type="monotone" dataKey="leadsCreated" stroke={colors.leads} strokeWidth={2} dot={{ fill: colors.leads, strokeWidth: 2, r: 4 }} activeDot={{ r: 6, stroke: colors.leads, strokeWidth: 2 }} name="Leads" />
          <Line type="monotone" dataKey="tasks" stroke={colors.tasks} strokeWidth={2} dot={{ fill: colors.tasks, strokeWidth: 2, r: 4 }} activeDot={{ r: 6, stroke: colors.tasks, strokeWidth: 2 }} name="Tasks" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


