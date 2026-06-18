"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { format, subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";
import { useWidgetContext } from "@/app/context/WidgetContext";
import { useLocalization } from "@/app/context/LocalizationContext";
import { fetchWithRetry } from "@/app/utils/fetch-with-retry";

interface RevenueWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface RevenueData {
  actual: number;
  percentChange: number;
  periodType: string;
}

// Format period type for display (t for i18n)
function formatPeriodType(periodType: string, t: (key: string) => string): string {
  switch (periodType) {
    case "daily": return t('dashboard.widgets.revenue.yesterday') || 'yesterday';
    case "weekly": return t('dashboard.widgets.revenue.lastWeek') || 'last week';
    case "monthly": return t('dashboard.widgets.revenue.lastMonth') || 'last month';
    case "quarterly": return t('dashboard.widgets.revenue.lastQuarter') || 'last quarter';
    case "yearly": return t('dashboard.widgets.revenue.lastYear') || 'last year';
    default: return t('dashboard.widgets.revenue.previousPeriod') || 'previous period';
  }
}

// Format currency for display
const formatCurrency = (value: number): string => {
  // Handle invalid numbers (NaN, null, undefined, etc.)
  if (value == null || isNaN(value) || !isFinite(value)) {
    return "$0";
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function RevenueWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: RevenueWidgetProps) {
  const { t } = useLocalization();
  const { currentSite } = useSite();
  const { user } = useAuth();
  const { shouldExecuteWidgets } = useWidgetContext();
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date());

  // Update local state when props change
  useEffect(() => {
    if (propStartDate) {
      setStartDate(propStartDate);
    }
    if (propEndDate) {
      setEndDate(propEndDate);
    }
  }, [propStartDate, propEndDate]);

  const { data: revenue, isLoading: isSWRisLoading } = useSWR(
    shouldExecuteWidgets && currentSite && currentSite.id !== "default"
      ? [
          'revenue',
          segmentId,
          currentSite.id,
          user?.id,
          startDate ? format(startDate, "yyyy-MM-dd") : null,
          endDate ? format(endDate, "yyyy-MM-dd") : null
        ]
      : null,
    async ([_, segId, siteId, userId, start, end]) => {
      const params = new URLSearchParams();
      params.append("segmentId", segId as string);
      params.append("siteId", siteId as string);
      if (userId) {
        params.append("userId", userId as string);
      }
      if (start) params.append("startDate", start as string);
      if (end) params.append("endDate", end as string);
      
      const response = await fetch(
        `/api/revenue?${params.toString()}`
      );
      
      if (!response) {
        return null;
      }
      const data = await response.json();
      
      return {
        actual: data.totalSales?.actual || 0,
        percentChange: data.totalSales?.percentChange || 0,
        periodType: data.periodType || "monthly"
      } as RevenueData;
    }
  );

  const isLoading = isSWRisLoading;

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const formattedValue = revenue ? formatCurrency(revenue.actual) : "$0";
  const changeText = `${revenue?.percentChange || 0}% from ${formatPeriodType(revenue?.periodType || "monthly", t)}`;
  const isPositiveChange = (revenue?.percentChange || 0) > 0;
  
  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.revenue') || 'Revenue'}
      tooltipText={t('dashboard.widgets.revenue.tooltip') || 'Total revenue for the selected period'}
      value={formattedValue}
      changeText={changeText}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      showDatePicker={!propStartDate && !propEndDate}
      startDate={startDate}
      endDate={endDate}
      onDateChange={handleDateChange}
      segmentBadge={segmentId !== "all"}
    />
  );
} 