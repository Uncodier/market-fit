"use client";

import { useState, useEffect } from 'react';
import { SessionEventsChart } from './session-events-chart';
import { SessionEventsReferrers } from './session-events-referrers';

interface SessionEventData {
  date: string;
  pageVisits: number;
  uniqueVisitors: number;
  label: string;
}

interface ReferrerData {
  referrer: string;
  count: number;
  percentage: string;
  fullUrl: string;
}

interface SessionEventsContainerProps {
  siteId: string;
  startDate: Date;
  endDate: Date;
  segmentId?: string;
}

export function SessionEventsContainer({ siteId, startDate, endDate, segmentId }: SessionEventsContainerProps) {
  const [chartData, setChartData] = useState<SessionEventData[]>([]);
  const [referrersData, setReferrersData] = useState<ReferrerData[]>([]);
  const [totals, setTotals] = useState<{pageVisits: number, uniqueVisitors: number}>({
    pageVisits: 0,
    uniqueVisitors: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!siteId || !startDate || !endDate) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const start = startDate ? startDate.toISOString().split('T')[0] : null;
        const end = endDate ? endDate.toISOString().split('T')[0] : null;
        
        const params = new URLSearchParams();
        params.append('siteId', siteId);
        if (start) params.append('startDate', start);
        if (end) params.append('endDate', end);
        if (segmentId && segmentId !== 'all') {
          params.append('segmentId', segmentId);
        }
        params.append('referrersLimit', '10');
        
        console.log('Fetching combined page visits data with params:', params.toString());
        console.log('[SessionEventsContainer] Date range:', { startDate, endDate, segmentId });
        const response = await fetch(`/api/traffic/session-events-combined?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch page visits data');
        }
        
        const result = await response.json();
        console.log('Combined page visits response:', result);
        console.log('[SessionEventsContainer] Totals received:', result.totals);
        
        setChartData(result.chartData || []);
        setReferrersData(result.referrersData || []);
        setTotals(result.totals || { pageVisits: 0, uniqueVisitors: 0 });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching combined page visits:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [siteId, startDate, endDate, segmentId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[500px]">
      <SessionEventsChart 
        siteId={siteId}
        startDate={startDate}
        endDate={endDate}
        data={chartData}
        loading={loading}
        error={error}
        totals={totals}
      />
      <SessionEventsReferrers 
        siteId={siteId}
        startDate={startDate}
        endDate={endDate}
        data={referrersData}
        loading={loading}
        error={error}
      />
    </div>
  );
} 