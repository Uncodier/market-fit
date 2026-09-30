"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { ReportChartFrame } from '../report-chart-frame';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { EmptyCard } from '@/app/components/ui/empty-card';
import { BarChart as BarChartIcon } from '@/app/components/ui/icons';
import { useTheme } from '@/app/context/ThemeContext';
import { Skeleton } from '@/app/components/ui/skeleton';

interface SessionEventData {
  date: string;
  pageVisits: number;
  uniqueVisitors: number;
  referralVisits?: number;
  label: string;
}

interface SessionEventsChartProps {
  siteId: string;
  startDate: Date;
  endDate: Date;
  data?: SessionEventData[];
  loading?: boolean;
  error?: string | null;
  totals?: {
    pageVisits: number;
    uniqueVisitors: number;
    referralVisits?: number;
  };
}

export function SessionEventsChart({ 
  siteId, 
  startDate, 
  endDate, 
  data: propData, 
  loading: propLoading, 
  error: propError,
  totals: propTotals 
}: SessionEventsChartProps) {
  const { isDarkMode } = useTheme();
  const [internalData, setInternalData] = useState<SessionEventData[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [internalTotals, setInternalTotals] = useState<{
    pageVisits: number;
    uniqueVisitors: number;
    referralVisits?: number;
  }>({
    pageVisits: 0,
    uniqueVisitors: 0,
    referralVisits: 0,
  });

  // Use prop data if provided, otherwise fetch internally
  const data = propData !== undefined ? propData : internalData;
  const loading = propLoading !== undefined ? propLoading : internalLoading;
  const error = propError !== undefined ? propError : internalError;
  const totals = propTotals !== undefined ? propTotals : internalTotals;

  // Theme-adaptive colors
  const colors = {
    text: isDarkMode ? "#CBD5E1" : "#9CA3AF",
    grid: isDarkMode ? "rgba(203, 213, 225, 0.1)" : "#f0f0f0",
    tooltipBackground: isDarkMode ? "#1E293B" : "white",
    tooltipBorder: isDarkMode ? "#475569" : "#e5e7eb",
    tooltipText: isDarkMode ? "#F8FAFC" : "#111827",
    // Page visits - Blue/Indigo
    pageVisitsFill: isDarkMode ? "#818CF8" : "#6366F1",
    pageVisitsStart: isDarkMode ? "#A5B4FC" : "#818CF8",
    // Unique visitors - Green
    uniqueVisitorsFill: isDarkMode ? "#34D399" : "#10B981",
    uniqueVisitorsStart: isDarkMode ? "#6EE7B7" : "#34D399",
    // External referral pageviews — line (amber)
    referralLine: isDarkMode ? "#FBBF24" : "#D97706",
    barHover: isDarkMode ? "rgba(129, 140, 248, 0.2)" : "rgba(99, 102, 241, 0.1)",
  };

  useEffect(() => {
    // Only fetch if no prop data is provided
    if (propData !== undefined) return;

    const fetchData = async () => {
      if (!siteId || !startDate || !endDate) return;
      
      setInternalLoading(true);
      setInternalError(null);
      
      try {
        const start = startDate ? startDate.toISOString().split('T')[0] : null;
        const end = endDate ? endDate.toISOString().split('T')[0] : null;
        
        const params = new URLSearchParams();
        params.append('siteId', siteId);
        if (start) params.append('startDate', start);
        if (end) params.append('endDate', end);
        params.append('referrersLimit', '10');
        
        console.log('Fetching combined page visits data with params:', params.toString());
        const response = await fetch(`/api/traffic/session-events-combined?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch page visits data');
        }
        
        const result = await response.json();
        console.log('Combined page visits response:', result);
        
        // Use the combined data directly
        setInternalData(result.chartData || []);
        setInternalTotals(
          result.totals || { pageVisits: 0, uniqueVisitors: 0, referralVisits: 0 }
        );
      } catch (err) {
        setInternalError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching combined page visits:', err);
      } finally {
        setInternalLoading(false);
      }
    };

    fetchData();
  }, [siteId, startDate, endDate, propData]);

  const totalPageVisits = totals.pageVisits;
  const totalUniqueVisitors = totals.uniqueVisitors;
  const totalReferralVisits = totals.referralVisits ?? 0;

  const chartSeries = data.map((row) => ({
    ...row,
    referralVisits: row.referralVisits ?? 0,
  }));

  if (error && !loading) {
    return (
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 flex-shrink-0">
          <CardTitle className="text-base">Visits & referral trend</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center">
          <div role="alert" className="text-red-500 text-center">
            Error: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-report-panel="sessions-trend" className="flex h-full min-w-0 flex-col" aria-busy={loading}>
      <CardHeader className="flex flex-col gap-3 space-y-0 p-4 pb-3 sm:p-5 sm:pb-3">
        <CardTitle className="text-base">Visits & referral trend</CardTitle>
        <div className="grid grid-cols-3 items-start gap-3">
          {([["Page visits", totalPageVisits], ["Unique visitors", totalUniqueVisitors], ["Referral visits", totalReferralVisits]] as const).map(([label, total]) => (
            <div key={label} className="min-w-0">
              <div className="text-xl font-bold leading-8 tabular-nums break-words sm:text-2xl sm:leading-8">
                {loading ? <Skeleton aria-hidden="true" className="h-8 w-16 max-w-full motion-reduce:animate-none" /> : total.toLocaleString()}
              </div>
              <div className="text-xs leading-4 text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-4 pb-4 sm:px-5 sm:pb-5">
        <ReportChartFrame className="h-[320px] min-w-0 w-full sm:h-[360px]">
        {loading ? <div aria-hidden="true" className="flex h-full flex-col gap-4">
          <div className="flex justify-center gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-3 w-16 motion-reduce:animate-none" />)}</div>
          <div className="flex flex-1 items-end gap-3 border-b border-l px-4 pb-3 pt-4">
            {["h-1/3", "h-2/3", "h-1/2", "h-3/4", "h-1/3", "h-5/6"].map((height, i) => <Skeleton key={i} className={`min-w-0 flex-1 motion-reduce:animate-none ${height}`} />)}
          </div>
        </div> : data.length === 0 ||
        (totalPageVisits === 0 && totalUniqueVisitors === 0 && totalReferralVisits === 0) ? (
          <div className="w-full h-full flex items-center justify-center">
            <EmptyCard
              icon={<BarChartIcon className="h-10 w-10 text-muted-foreground" />}
              title="No Events Found"
              description="No page visits recorded for this time period"
              showShadow={false} variant="simple" contentClassName="min-h-0 py-6"
            />
          </div>
        ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartSeries}
                margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                barGap={2}
                barCategoryGap={20}
              >
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  vertical={false} 
                  stroke={colors.grid} 
                  opacity={isDarkMode ? 0.3 : 1}
                />
                <XAxis 
                  dataKey="label" 
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: colors.text }}
                />
                <YAxis 
                  fontSize={12} 
                  axisLine={false}
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: colors.text }}
                />
                <Tooltip 
                  formatter={(value, name) => [
                    value, 
                    name
                  ]}
                  labelFormatter={(label) => `Date: ${label}`}
                  labelStyle={{ fontWeight: 'bold', color: colors.tooltipText }}
                  contentStyle={{ 
                    backgroundColor: colors.tooltipBackground, 
                    border: `1px solid ${colors.tooltipBorder}`,
                    borderRadius: '0.375rem', 
                    boxShadow: isDarkMode 
                      ? '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.3)' 
                      : '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                  }}
                  cursor={{ fill: colors.barHover }}
                  itemStyle={{ color: colors.tooltipText }}
                />
                <Legend
                  verticalAlign="top"
                  height={42}
                  iconType="rect"
                  wrapperStyle={{
                    paddingBottom: "20px",
                    fontSize: "12px",
                    color: colors.text,
                  }}
                />
                {/* Theme-adaptive series gradients. */}
                <defs>
                  <linearGradient id="pageVisitsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.pageVisitsStart} />
                    <stop offset="100%" stopColor={colors.pageVisitsFill} />
                  </linearGradient>
                  <linearGradient id="uniqueVisitorsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.uniqueVisitorsStart} />
                    <stop offset="100%" stopColor={colors.uniqueVisitorsFill} />
                  </linearGradient>
                </defs>
                <Bar
                  dataKey="pageVisits"
                  fill="url(#pageVisitsGradient)"
                  radius={[4, 4, 0, 0]}
                  barSize={15}
                  name="Page visits"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="uniqueVisitors"
                  fill="url(#uniqueVisitorsGradient)"
                  radius={[4, 4, 0, 0]}
                  barSize={15}
                  name="Unique visitors"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="referralVisits"
                  name="Referral visits"
                  stroke={colors.referralLine}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  legendType="line"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
        )}
        </ReportChartFrame>
      </CardContent>
    </Card>
  );
} 