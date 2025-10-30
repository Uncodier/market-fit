"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useRequestController } from "@/app/hooks/useRequestController";
import { useAuth } from "@/app/hooks/use-auth";
import { useSite } from "@/app/context/SiteContext";
import { useTheme } from "@/app/context/ThemeContext";
import { Skeleton } from "@/app/components/ui/skeleton";

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
  const [data, setData] = useState<MetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { currentSite } = useSite();
  const { fetchWithController } = useRequestController();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      if (!currentSite?.id || !user?.id) return;

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          siteId: currentSite.id,
          userId: user.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          segmentId: segmentId
        });

        const response = await fetchWithController(`/api/performance/metrics-overview?${params}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        setData({ chartData: result.chartData });
      } catch (err) {
        console.error("Error fetching leads/tasks metrics:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentSite?.id, user?.id, startDate, endDate, segmentId, fetchWithController]);

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

  if (error) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center">
        <p className="text-red-500">Error loading chart data: {error}</p>
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


