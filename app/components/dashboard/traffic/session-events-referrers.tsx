"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { EmptyCard } from '@/app/components/ui/empty-card';
import { ExternalLink } from '@/app/components/ui/icons';

interface ReferrerData {
  referrer: string;
  count: number;
  percentage: string;
  fullUrl: string;
}

interface SessionEventsReferrersProps {
  siteId: string;
  startDate: Date;
  endDate: Date;
  data?: ReferrerData[];
  loading?: boolean;
  error?: string | null;
}

export function SessionEventsReferrers({ 
  siteId, 
  startDate, 
  endDate, 
  data: propData, 
  loading: propLoading, 
  error: propError 
}: SessionEventsReferrersProps) {
  const [internalData, setInternalData] = useState<ReferrerData[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Use prop data if provided, otherwise fetch internally
  const data = propData !== undefined ? propData : internalData;
  const loading = propLoading !== undefined ? propLoading : internalLoading;
  const error = propError !== undefined ? propError : internalError;

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
        params.append('limit', '10');
        
        console.log('Fetching referrers with params:', params.toString());
        const response = await fetch(`/api/traffic/session-events-referrers?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch referrers data');
        }
        
        const result = await response.json();
        console.log('Referrers response:', result);
        setInternalData(result.data || []);
      } catch (err) {
        setInternalError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching referrers:', err);
      } finally {
        setInternalLoading(false);
      }
    };

    fetchData();
  }, [siteId, startDate, endDate, propData]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Referrers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Header skeleton */}
            <div className="grid grid-cols-3 gap-4 pb-2 border-b">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-20"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-16 justify-self-end"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-6 justify-self-end"></div>
            </div>
            
            {/* Table rows skeleton */}
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="grid grid-cols-3 gap-4 items-center py-2">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"
                      style={{ 
                        width: `${Math.random() * 100 + 120}px`,
                        animationDelay: `${i * 0.1}s`
                      }}
                    />
                  </div>
                  <div className="justify-self-end">
                    <div 
                      className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse"
                      style={{ 
                        width: `${Math.random() * 20 + 40}px`,
                        animationDelay: `${i * 0.1 + 0.05}s`
                      }}
                    />
                  </div>
                  <div className="justify-self-end">
                    <div 
                      className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"
                      style={{ 
                        width: `${Math.random() * 15 + 25}px`,
                        animationDelay: `${i * 0.1 + 0.1}s`
                      }}
                    />
                  </div>
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
      <Card>
        <CardHeader>
          <CardTitle>Top Referrers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500 text-center py-8">
            Error: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Referrers</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyCard
            icon={<ExternalLink className="h-10 w-10 text-muted-foreground" />}
            title="No Referrers Found"
            description="No referrer data available for page visits in this time period"
            variant="fancy"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referrer</TableHead>
                <TableHead className="text-right">Events</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((referrer, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <span className="truncate max-w-[200px]" title={referrer.fullUrl}>
                        {referrer.referrer}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">
                      {referrer.count}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm text-gray-500">
                      {referrer.percentage}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
} 