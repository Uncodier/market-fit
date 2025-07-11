"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { EmptyCard } from '@/app/components/ui/empty-card';
import { BarChart as BarChartIcon } from '@/app/components/ui/icons';
import { useTheme } from '@/app/context/ThemeContext';

interface SessionEventData {
  date: string;
  pageVisits: number;
  uniqueVisitors: number;
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
  const [internalTotals, setInternalTotals] = useState<{pageVisits: number, uniqueVisitors: number}>({
    pageVisits: 0,
    uniqueVisitors: 0
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
        
        console.log('Fetching page visits with params:', params.toString());
        const response = await fetch(`/api/traffic/session-events?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch page visits data');
        }
        
        const result = await response.json();
        console.log('Page visits response:', result);
        
        // Transform old format to new format if needed
        const transformedData = (result.data || []).map((item: any) => ({
          date: item.date,
          pageVisits: item.events || 0,
          uniqueVisitors: 0, // Will be populated by combined API
          label: item.label
        }));
        
        setInternalData(transformedData);
        setInternalTotals({
          pageVisits: transformedData.reduce((sum: number, item: any) => sum + item.pageVisits, 0),
          uniqueVisitors: 0
        });
      } catch (err) {
        setInternalError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching page visits:', err);
      } finally {
        setInternalLoading(false);
      }
    };

    fetchData();
  }, [siteId, startDate, endDate, propData]);

  const totalPageVisits = totals.pageVisits;
  const totalUniqueVisitors = totals.uniqueVisitors;

  if (loading) {
    return (
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle>Page Visits vs Unique Visitors</CardTitle>
          <div className="h-8 flex items-center space-x-3">
            {/* Skeleton for totals */}
            <div className="flex items-center space-x-1">
              <div className="h-4 w-6 bg-blue-200 dark:bg-blue-800 rounded animate-pulse"></div>
              <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
            </div>
            <div className="flex items-center space-x-1">
              <div className="h-4 w-6 bg-green-200 dark:bg-green-800 rounded animate-pulse"></div>
              <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="w-full h-full flex flex-col overflow-hidden">
            {/* Legend skeleton */}
            <div className="flex justify-center items-center space-x-6 pb-4 pt-2">
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 bg-blue-300 dark:bg-blue-600 rounded-sm animate-pulse"></div>
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 bg-green-300 dark:bg-green-600 rounded-sm animate-pulse"></div>
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              </div>
            </div>

            {/* Chart area */}
            <div className="flex flex-1 relative pl-12">
              {/* Y-axis skeleton */}
              <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between py-2">
                {[35, 28, 42, 31, 25].map((width, i) => (
                  <div 
                    key={i} 
                    className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"
                    style={{ 
                      width: `${width}px`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  ></div>
                ))}
              </div>

              {/* Grid lines skeleton */}
              <div className="absolute left-12 right-4 top-0 bottom-8 flex flex-col justify-between pointer-events-none">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="border-t w-full h-0 border-slate-100 dark:border-slate-600 opacity-50"></div>
                ))}
              </div>

              {/* Dual bars skeleton */}
              <div className="w-full ml-2 mr-4 h-full flex items-end justify-between pb-8">
                {[65, 45, 80, 35, 70, 55, 90, 40, 60, 75].map((height, index) => (
                  <div 
                    key={index}
                    className="flex space-x-1 h-full flex-col justify-end items-center"
                    style={{ width: '8%' }}
                  >
                    {/* Page visits bar (blue) */}
                    <div 
                      className="bg-blue-200 dark:bg-blue-700 rounded-t-sm animate-pulse"
                      style={{ 
                        height: `${height}%`,
                        width: '45%',
                        animationDelay: `${index * 0.1}s`
                      }}
                    />
                    {/* Unique visitors bar (green) */}
                    <div 
                      className="bg-green-200 dark:bg-green-700 rounded-t-sm animate-pulse"
                      style={{ 
                        height: `${Math.max(20, height - 15)}%`,
                        width: '45%',
                        animationDelay: `${index * 0.1 + 0.05}s`
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* X-axis labels skeleton */}
            <div className="h-8 flex justify-between pl-12 pr-4">
              {[30, 35, 28, 32, 40, 33, 29, 36, 31, 34].map((width, index) => (
                <div 
                  key={index} 
                  className="flex justify-center"
                  style={{ width: '8%' }}
                >
                  <div 
                    className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"
                    style={{ 
                      width: `${width}px`,
                      animationDelay: `${index * 0.05 + 0.3}s`
                    }}
                  ></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 flex-shrink-0">
          <CardTitle>Page Visits vs Unique Visitors</CardTitle>
          <div className="h-8 flex items-center">
            <div className="text-2xl font-bold">
              0
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center">
          <div className="text-red-500 text-center">
            Error: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 flex-shrink-0">
        <CardTitle>Page Visits vs Unique Visitors</CardTitle>
        <div className="h-8 flex items-center space-x-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-blue-600 dark:text-blue-400">PV:</span> {totalPageVisits.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-green-600 dark:text-green-400">UV:</span> {totalUniqueVisitors.toLocaleString()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {data.length === 0 || (totalPageVisits === 0 && totalUniqueVisitors === 0) ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyCard
              icon={<BarChartIcon className="h-10 w-10 text-muted-foreground" />}
              title="No Events Found"
              description="No page visits recorded for this time period"
              variant="fancy"
            />
          </div>
        ) : (
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={data}
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
                    name === 'pageVisits' ? 'Page Visits' : 'Unique Visitors'
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
                  height={36}
                  iconType="rect"
                  wrapperStyle={{ 
                    paddingBottom: "20px",
                    fontSize: "12px",
                    color: colors.text
                  }}
                />
                {/* Definición de gradientes */}
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
                  name="Page Visits"
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
                <Bar 
                  dataKey="uniqueVisitors" 
                  fill="url(#uniqueVisitorsGradient)"
                  radius={[4, 4, 0, 0]}
                  barSize={15}
                  name="Unique Visitors"
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
      
      {/* Estilos para animaciones */}
      <style jsx global>{`
        @keyframes kip-fade-in {
          from { 
            opacity: 0; 
            transform: translateY(10px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        
        .kip-fade-in {
          animation: kip-fade-in 0.6s ease-out forwards;
        }
      `}</style>
    </Card>
  );
} 