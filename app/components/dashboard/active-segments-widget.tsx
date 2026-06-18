"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { format, subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useAuth } from "@/app/hooks/use-auth";
import { useWidgetContext } from "@/app/context/WidgetContext";
import { fetchWithRetry } from "@/app/utils/fetch-with-retry";

interface ActiveSegmentsWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

interface ActiveSegmentsData {
  actual: number;
  percentChange: number;
  periodType: string;
}

// Format period type for display
const formatPeriodType = (periodType: string): string => {
  switch (periodType) {
    case "daily": return "yesterday";
    case "weekly": return "last week";
    case "monthly": return "last month";
    case "quarterly": return "last quarter";
    case "yearly": return "last year";
    default: return "previous period";
  }
};

export function ActiveSegmentsWidget({ 
  startDate: propStartDate,
  endDate: propEndDate
}: ActiveSegmentsWidgetProps) {
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

  const { data: activeSegments, isLoading: isSWRisLoading, error } = useSWR(
    shouldExecuteWidgets && currentSite && currentSite.id !== "default"
      ? [
          'active-segments',
          currentSite.id,
          user?.id,
          startDate ? format(startDate, "yyyy-MM-dd") : null,
          endDate ? format(endDate, "yyyy-MM-dd") : null
        ]
      : null,
    async ([_, siteId, userId, start, end]) => {
      const params = new URLSearchParams();
      params.append("siteId", siteId as string);
      if (userId) {
        params.append("userId", userId as string);
      }
      if (start) params.append("startDate", start as string);
      if (end) params.append("endDate", end as string);
      
      const apiUrl = `/api/active-segments?${params.toString()}`;
      
      const response = await fetchWithRetry(
        fetch,
        apiUrl,
        { maxRetries: 3 }
      );
      
      if (!response) {
        return null;
      }
      
      const data = await response.json();

      if (data && typeof data.actual !== 'undefined') {
        return {
          actual: Number(data.actual),
          percentChange: Number(data.percentChange || 0),
          periodType: data.periodType || 'monthly'
        } as ActiveSegmentsData;
      } else {
        throw new Error("Invalid response format");
      }
    }
  );

  const isLoading = isSWRisLoading;
  const hasError = !!error;

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  // Custom status for error and special cases
  let customStatus = null;
  let formattedValue = null;
  let changeText = null;
  let isPositiveChange = undefined;

  if (hasError) {
    customStatus = <div className="text-sm text-red-500">Error loading segments data</div>;
  } else if (!currentSite || currentSite.id === "default") {
    formattedValue = "-";
    customStatus = <p className="text-xs text-muted-foreground">No site selected</p>;
  } else if (activeSegments && activeSegments.actual === 0) {
    formattedValue = "0";
    customStatus = <p className="text-xs text-muted-foreground">No active segments</p>;
  } else {
    formattedValue = activeSegments ? activeSegments.actual.toLocaleString() : "0";
    changeText = `${activeSegments?.percentChange || 0}% from ${formatPeriodType(activeSegments?.periodType || "monthly")}`;
    isPositiveChange = (activeSegments?.percentChange || 0) > 0;
  }

  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.activeSegments') || 'Active Segments'}
      tooltipText={`Number of active user segments for site: ${currentSite?.name || currentSite?.id}`}
      value={formattedValue}
      changeText={changeText || ""}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      customStatus={customStatus}
      showDatePicker={!propStartDate && !propEndDate}
      startDate={startDate}
      endDate={endDate}
      onDateChange={handleDateChange}
    />
  );
} 