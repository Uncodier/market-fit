"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { EmptyCard } from '@/app/components/ui/empty-card';
import { ExternalLink } from '@/app/components/ui/icons';
import { useLocalization } from '@/app/context/LocalizationContext';
import { ReportTableLoading } from '../report-visual-loading';

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
  const { t } = useLocalization();
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

  if (error && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.traffic.topReferrers') || 'Top Referrers'}</CardTitle>
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
    <Card data-report-panel="sessions-referrers" className="flex h-full min-w-0 flex-col" aria-busy={loading}>
      <CardHeader className="flex-shrink-0 p-4 pb-3 sm:p-5 sm:pb-3">
        <CardTitle className="text-base">{t('dashboard.traffic.topReferrers') || 'Top Referrers'}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-w-0 flex flex-col px-4 pb-4 sm:px-5 sm:pb-5">
        {loading ? <ReportTableLoading label="Loading referrers" /> : data.length === 0 ? (
          <div className="flex-1 w-full flex items-center justify-center">
            <EmptyCard
              icon={<ExternalLink className="h-10 w-10 text-muted-foreground" />}
              title={t('dashboard.traffic.noReferrers') || 'No Referrers Found'}
              description={t('dashboard.traffic.noReferrersDesc') || 'No referrer data available for page visits in this time period'}
              showShadow={false} variant="simple" contentClassName="min-h-0 py-8"
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('dashboard.traffic.referrer') || 'Referrer'}</TableHead>
                <TableHead className="text-right">{t('dashboard.traffic.events') || 'Events'}</TableHead>
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