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
        setInternalTotals(result.totals || { pageVisits: 0, uniqueVisitors: 0 });
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

  if (loading) {
    return (
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle>Page Visits vs Unique Visitors</CardTitle>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-16 bg-muted rounded animate-pulse"></div>
              <div className="h-4 w-20 bg-muted rounded animate-pulse"></div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-8 w-16 bg-muted rounded animate-pulse"></div>
              <div className="h-4 w-24 bg-muted rounded animate-pulse"></div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1">
            {/* Simple skeleton that matches the actual chart structure */}
            <div className="w-full h-full flex flex-col">
              
              {/* Legend skeleton - simple and clean */}
              <div className="flex justify-center items-center space-x-6 pb-4 pt-2">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 bg-muted rounded-sm animate-pulse"></div>
                  <div className="h-3 w-16 bg-muted rounded animate-pulse"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 bg-muted rounded-sm animate-pulse"></div>
                  <div className="h-3 w-20 bg-muted rounded animate-pulse"></div>
                </div>
              </div>

              {/* Chart skeleton - mimics ResponsiveContainer structure */}
              <div className="flex-1 relative">
                
                {/* Y-axis skeleton */}
                <div className="absolute left-0 top-4 bottom-12 w-8 flex flex-col justify-between">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-3 w-6 bg-muted rounded animate-pulse"></div>
                  ))}
                </div>

                {/* Chart area skeleton */}
                <div className="ml-10 mr-4 h-full flex items-end justify-center pb-12 pt-4">
                  <div className="w-full h-full flex items-end justify-between">
                    {Array.from({ length: 7 }, (_, index) => (
                      <div key={index} className="flex space-x-1 items-end h-full" style={{ width: '12%' }}>
                        {/* Two bars side by side - no colors, just muted */}
                        <div 
                          className="bg-muted animate-pulse"
                          style={{ 
                            height: `${40 + (index * 10)}%`,
                            width: '6px'
                          }}
                        />
                        <div 
                          className="bg-muted animate-pulse"
                          style={{ 
                            height: `${30 + (index * 8)}%`,
                            width: '6px'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* X-axis skeleton */}
                <div className="absolute bottom-0 left-10 right-4 h-8 flex justify-between items-center">
                  {Array.from({ length: 7 }, (_, index) => (
                    <div key={index} className="h-3 w-8 bg-muted rounded animate-pulse"></div>
                  ))}
                </div>

              </div>
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
          <CardTitle className="text-base">Page Visits vs Unique Visitors</CardTitle>
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Page Visits vs Unique Visitors</CardTitle>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold">{totalPageVisits.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Page Visits</div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold">{totalUniqueVisitors.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Unique Visitors</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {data.length === 0 || (totalPageVisits === 0 && totalUniqueVisitors === 0) ? (
          <div className="flex-1 w-full h-full flex items-center justify-center">
            <EmptyCard
              icon={<BarChartIcon className="h-10 w-10 text-muted-foreground" />}
              title="No Events Found"
              description="No page visits recorded for this time period"
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